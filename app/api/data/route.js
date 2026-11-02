import {cashCheckout,reorderPreview,freshness} from '../../../lib/partners.js';
import {prepareCart} from '../../../lib/cart.js';
import { catalog } from "../../../lib/catalog.js";
import { mockPayments } from "../../../lib/modes.js";
import { refundMock } from "../../../lib/mock-payment.js";
import { canSell, sellerActions } from "../../../lib/roles.js";
import { chargeCardPayment } from "../../../lib/card-payments.js";
import { env } from "cloudflare:workers";
import {
  getAppUser,
  throttle,
  sameOrigin,
  phoneVerified,
} from "../../../lib/auth.js";
import { expireOrders, splitTotal } from "../../../lib/commerce.js";
import {
  schemaMissing,
  SCHEMA_HINT,
  logError,
} from "../../../lib/db-errors.js";
import { growthAction, growthData } from "../../../lib/growth.js";
import { paymentConfig, paymentUrl } from "../../../lib/payments.js";
import { capitalize } from "../../../lib/format.js";
export const dynamic = "force-dynamic";
const json = (v, s = 200) =>
  Response.json(v, { status: s, headers: { "Cache-Control": "no-store" } });
const fail = (m) => {
  throw new Error(m);
};
async function user() {
  const u = await getAppUser();
  return u
    ? env.DB.prepare("SELECT * FROM users WHERE id=?").bind(u.userId).first()
    : null;
}
export async function GET(req) {
  try {
    await expireOrders(env.DB);
    const me = await user();
    const catalogRequest =
      req && new URL(req.url).searchParams.get("catalog") === "1";
    const products = catalogRequest
      ? { results: [] }
      : await env.DB.prepare(
          `SELECT p.*,u.verified seller_verified,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE product=p.id AND hidden=0) rating,(SELECT COUNT(*) FROM reviews WHERE product=p.id AND hidden=0) review_count FROM products p JOIN users u ON u.id=p.owner WHERE (p.active=1 AND u.selling_paused=0 AND (p.best_before IS NULL OR p.best_before>${Date.now()})) OR p.owner=? OR ?='admin' ORDER BY p.created DESC`,
        )
          .bind(me?.id || "", me?.role || "")
          .all();
    let orders = [];
    if (me)
      orders = (
        await env.DB.prepare(
          `SELECT o.*,p.title,p.shop,p.address,p.lat,p.lng,p.until,p.image,p.owner,u.name buyerName,(SELECT phone FROM app_accounts WHERE owner=o.buyer) buyerPhone FROM orders o JOIN products p ON p.id=o.product JOIN users u ON u.id=o.buyer WHERE (COALESCE(o.provider,'')!='demo' OR ${env.DEMO_MODE === "true" ? 1 : 0}) AND (o.buyer=? OR p.owner=? OR ?='admin') ORDER BY o.created DESC`,
        )
          .bind(me.id, me.id, me.role)
          .all()
      ).results;
    const extra = await growthData(env.DB, me);
    const page =
      req && new URL(req.url).searchParams.get("catalog") === "1"
        ? await catalog(env.DB, new URL(req.url).searchParams)
        : null;
    return json({
      ...extra,
      demo: mockPayments(env),
      me,
      products: page?.products || products.results,
      pagination: page
        ? { page: page.page, pages: page.pages, total: page.total }
        : null,
      orders: orders.map((o) => ({
        ...o,
        ...JSON.parse(o.snapshot || "{}"),
        items: JSON.parse(o.cart_items || "[]"),
        code: o.buyer === me?.id ? o.code : undefined,
        buyerPhone:
          o.owner === me?.id && ["paid", "test", "cash_due", "cash_paid"].includes(o.payment_state)
            ? o.buyerPhone
            : undefined,
      })),
      now: Date.now(),
    });
  } catch (e) {
    logError("GET /api/data", e);
    if (schemaMissing(e)) return json({ error: SCHEMA_HINT }, 503);
    return json({ error: "Ma’lumotlarni yuklab bo‘lmadi" }, 500);
  }
}
export async function POST(req) {
  try {
    if (!sameOrigin(req))
      return json({ error: "Origin ruxsat etilmagan" }, 403);
    const me = await user();
    if (!me) return json({ error: "Avval hisobingizga kiring" }, 401);
    await expireOrders(env.DB);
    const b = await req.json();
    if (
      [
        "quickDay",
        "create",
        "checkout",
        "demoCheckout",
        "restock",
        "editProduct",
        "replaceImage",
      ].includes(b.action) &&
      env.SMS_REQUIRED === "true" &&
      !(await phoneVerified(env.DB, me.id))
    )
      return json(
        { error: "Avval telefonni SMS bilan tasdiqlang / Подтвердите телефон" },
        403,
      );
    if (
      sellerActions.has(b.action) &&
      !canSell(me.role) &&
      !(me.role === "admin" && ["collect", "toggle"].includes(b.action))
    )
      return json({ error: "Bu amal faqat sotuvchi uchun" }, 403);
    if(me.selling_paused && ['create','quickDay','restock','editProduct','replaceImage','toggle'].includes(b.action))return json({error:'Yangi savdo vaqtincha to‘xtatilgan. Mavjud buyurtmalarni topshirishingiz mumkin.'},403);
    if(b.action==='reorderPreview')return json(await reorderPreview(env.DB,me,b.id));
    if(b.action==='checkout'&&b.provider==='cash')return json(await cashCheckout(env.DB,me,b));
    const growth = await growthAction(env.DB, me, b);
    if (growth) return json(growth);
    const str = (v, n = 250) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= n
        ? v.trim()
        : fail("Maydonlarni to‘liq va to‘g‘ri kiriting");
    const int = (v, min, max) =>
      Number.isSafeInteger(Number(v)) && Number(v) >= min && Number(v) <= max
        ? Number(v)
        : fail("Son noto‘g‘ri");
    if(b.action==='quickDay') {
      if(me.role!=='seller')return json({error:'Faqat sotuvchi'},403);
      const p=await env.DB.prepare('SELECT * FROM products WHERE id=? AND owner=?').bind(str(b.id),me.id).first();
      if(!p||!['approved','legacy'].includes(p.image_status))fail('Tasdiqlangan mahsulotni tanlang');
      const qty=int(b.qty,1,10000),price=int(b.price,100,p.original-1),until=Number(b.until),id=str(b.requestId,80);
      if(!Number.isFinite(until)||until<=Date.now()+600000||until>Date.now()+86400000)fail('Olish muddatini kelgusi 24 soat ichida belgilang');
      const prior=await env.DB.prepare('SELECT id,actor,product FROM stock_events WHERE id=?').bind(id).first();
      if(prior){if(prior.actor!==me.id||prior.product!==p.id)fail('So‘rov mos emas');return json({ok:true,message:'Bugungi taklif avval saqlangan'});}
      const fresh=freshness(b,until);
      await env.DB.batch([env.DB.prepare('INSERT INTO stock_events(id,product,actor,qty,created) VALUES(?,?,?,?,?)').bind(id,p.id,me.id,qty,Date.now()),env.DB.prepare('UPDATE products SET price=?,until=?,prepared_at=?,best_before=?,active=1 WHERE id=? AND owner=?').bind(price,until,fresh.prepared,fresh.best,p.id,me.id)]);
      return json({ok:true,message:'Bugungi taklif tayyor'});
    }
    if (b.action === "create") {
      const p = b.product;
      const id = b.requestId || crypto.randomUUID();
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(id))
        fail("So‘rov identifikatori noto‘g‘ri");
      const prior = await env.DB.prepare(
        "SELECT id,owner FROM products WHERE id=?",
      )
        .bind(id)
        .first();
      if (prior) {
        if (prior.owner !== me.id) return json({ error: "Ruxsat yo‘q" }, 403);
        return json({
          ok: true,
          id,
          message: "Mahsulot avval joylangan. Ikkinchi e’lon yaratilmadi.",
        });
      }
      const price = int(p.price, 100, 100000000);
      const original = int(p.original, price + 1, 100000000);
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180
      )
        fail("Xaritadan manzil belgilang");
      if (!p.image?.startsWith("/api/image?id="))
        fail("Mahsulot rasmini yuklang");
      const key = p.image.split("=")[1];
      if (!key.startsWith(me.id + "/") || !(await env.BUCKET.head(key)))
        fail("Rasm topilmadi");
      const imageReview = await env.DB.prepare(
        "SELECT status,note FROM image_checks WHERE key=? AND owner=?",
      )
        .bind(key, me.id)
        .first();
      if (!imageReview || imageReview.status === "rejected")
        fail("Rasmni qayta yuklang");
      const images = Array.isArray(p.images)
        ? [...new Set([p.image, ...p.images])]
        : [p.image];
      if (images.length > 3) fail("3 tagacha rasm");
      for (const image of images) {
        const k = String(image).slice(14);
        if (
          !String(image).startsWith("/api/image?id=") ||
          !k.startsWith(me.id + "/") ||
          !(await env.BUCKET.head(k))
        )
          fail("Rasm sizga tegishli emas");
        const c = await env.DB.prepare(
          "SELECT status FROM image_checks WHERE key=? AND owner=?",
        )
          .bind(k, me.id)
          .first();
        if (!c || c.status === "rejected") fail("Rasm rad etilgan");
        if (c.status !== "approved") imageReview.status = "pending";
      }
      const city = p.city || "Toshkent";
      if (
        !(await env.DB.prepare("SELECT name FROM cities WHERE name=?")
          .bind(city)
          .first())
      )
        fail("Shahar noto‘g‘ri");
      const until = Number(p.until);
      if (
        !Number.isFinite(until) ||
        until <= Date.now() ||
        until > Date.now() + 30 * 86400000
      )
        fail("Olib ketish vaqtini kelgusi 30 kun ichida belgilang");
      const fresh=freshness(p,until);
      await env.DB.prepare(
        "INSERT INTO products(id,owner,title,shop,category,image,price,original,stock,address,lat,lng,allergens,storage,until,active,image_status,image_note,created,city,images,prepared_at,best_before) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          me.id,
          capitalize(str(p.title, 100)),
          str(p.shop, 100),
          str(p.category, 50),
          p.image,
          price,
          original,
          int(p.stock, 1, 10000),
          str(p.address, 500),
          p.lat,
          p.lng,
          str(p.allergens),
          str(p.storage),
          until,
          imageReview.status === "approved" ? 1 : 0,
          imageReview.status,
          imageReview.note,
          Date.now(),
          city,
          JSON.stringify(images),
          fresh.prepared, fresh.best,
        )
        .run();
      if (Number.isSafeInteger(b.draftVersion) && b.draftVersion > 0)
        await env.DB.prepare(
          "DELETE FROM listing_drafts WHERE id=? AND owner=? AND version=?",
        )
          .bind(id, me.id, b.draftVersion)
          .run();
      return json({
        ok: true,
        id,
        message:
          imageReview.status === "approved"
            ? "Mahsulot joylandi"
            : "Mahsulot saqlandi. Rasm admin tekshiruvini kutmoqda",
      });
    }
    if (b.action === "replaceImage") {
      const p = await env.DB.prepare("SELECT * FROM products WHERE id=?")
        .bind(str(b.id))
        .first();
      if (!p || p.owner !== me.id) return json({ error: "Ruxsat yo‘q" }, 403);
      const image = str(b.image, 250);
      if (!image.startsWith("/api/image?id=")) fail("Rasm noto‘g‘ri");
      const key = image.slice(14);
      const check = await env.DB.prepare(
        "SELECT * FROM image_checks WHERE key=? AND owner=?",
      )
        .bind(key, me.id)
        .first();
      if (
        !check ||
        check.status === "rejected" ||
        !(await env.BUCKET.head(key))
      )
        fail("Rasmni qayta yuklang");
      const result = await env.DB.prepare(
        "UPDATE products SET image=?,image_status=?,image_note=?,active=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM orders WHERE product=? AND status IN ('reserved','pending_payment'))",
      )
        .bind(
          image,
          check.status,
          check.note,
          check.status === "approved" ? 1 : 0,
          p.id,
          p.id,
        )
        .run();
      if (!result.meta.changes) fail("Faol buyurtma bor. Avval uni yakunlang");
      return json({ ok: true, message: check.note });
    }
    if (b.action === "reviewImage") {
      if (me.role !== "admin") return json({ error: "Faqat admin uchun" }, 403);
      if (typeof b.approved !== "boolean") fail("Amal noto‘g‘ri");
      const reviewed = await env.DB.prepare(
        "UPDATE products SET image_status=?,image_note=?,active=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM orders WHERE product=? AND status IN ('reserved','pending_payment'))",
      )
        .bind(
          b.approved ? "approved" : "rejected",
          b.approved
            ? "Rasm admin tomonidan tekshirildi"
            : "Iltimos, mahsulotning aniq va to‘g‘ri rasmini yuklang",
          b.approved ? 1 : 0,
          str(b.id),
          str(b.id),
        )
        .run();
      if (!reviewed.meta.changes)
        fail("Mahsulot topilmadi yoki faol buyurtma bor");
      return json({ ok: true });
    }
    if (b.action === "reserve")
      return json(
        {
          error:
            "10% to‘lov bosqichidan foydalaning. Click va Payme hali ulanmagan.",
        },
        409,
      );
    if (b.action === "checkout") {
      let cart=null;
      if(b.items){
        const prior=await env.DB.prepare('SELECT * FROM orders WHERE id=? AND buyer=?').bind(String(b.requestId||''),me.id).first();
        if(prior){
          const items=JSON.parse(prior.cart_items||'[]');
          const normalized=v=>JSON.stringify(v.map(i=>[i.id,i.qty]).sort((a,b)=>a[0].localeCompare(b[0])));
          if(!Array.isArray(b.items)||!items.length||normalized(items)!==normalized(b.items))fail('So‘rov mos emas');
          cart={items,total:prior.price,until:Math.min(...items.map(i=>i.until))};
        }else cart=await prepareCart(env.DB,b.items,me.id);
      }
      if(cart){b.id=cart.items[0].id;b.qty=1;}
      const mock = mockPayments(env),
        method = b.provider;
      if (mock && b.provider === "card") b.provider = "payme";
      if (
        b.provider === "card" &&
        !(await throttle(env.DB, "card-pay:" + me.id, 20, 60000))
      )
        return json({ error: "Bir oz kuting" }, 429);
      if (
        !paymentConfig(env)[b.provider] ||
        !["payme", "click", "card"].includes(b.provider)
      )
        return json(
          { error: "To‘lov xizmati hali sozlanmagan. Pul olinmadi." },
          503,
        );
      if (b.acceptTerms !== true) fail("Olib ketish shartini tasdiqlang");
      if (
        mock &&
        method === "card" &&
        !(await env.DB.prepare(
          "SELECT id FROM demo_wallet WHERE id=? AND owner=?",
        )
          .bind(String(b.cardId || ""), me.id)
          .first())
      )
        return json({ error: "O‘z sinov kartangizni tanlang" }, 400);
      if (
        b.provider === "card" &&
        !(await env.DB.prepare(
          "SELECT id FROM saved_cards WHERE id=? AND owner=?",
        )
          .bind(String(b.cardId || ""), me.id)
          .first())
      )
        return json({ error: "Avval o‘z kartangizni qo‘shing" }, 400);
      const qty = int(b.qty, 1, 1000),
        id = str(b.requestId, 80);
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(id))
        fail("So‘rov identifikatori noto‘g‘ri");
      let o = await env.DB.prepare("SELECT * FROM orders WHERE id=?")
        .bind(id)
        .first();
      if (o) {
        if (
          o.buyer !== me.id ||
          o.product !== b.id ||
          o.qty !== qty ||
          o.provider !== b.provider || (cart && JSON.stringify(cart.items.map(p=>[p.id,p.qty])) !== JSON.stringify(JSON.parse(o.cart_items||"[]").map(p=>[p.id,p.qty])))
        )
          fail("So‘rov mos emas");
        if (
          b.provider !== "card" &&
          (o.status !== "pending_payment" ||
            o.payment_state !== "unpaid" ||
            o.hold_until <= Date.now())
        )
          fail("Buyurtma faol emas. Yangi buyurtma oching");
      } else {
        const p = await env.DB.prepare("SELECT * FROM products WHERE id=?")
          .bind(str(b.id))
          .first();
        if (
          !p ||
          !p.active ||
          p.stock < qty ||
          p.until < Date.now() + 10 * 60000
        )
          fail(
            "Qoldiq yetarli emas yoki mahsulot muddati tugashiga juda oz qoldi",
          );
        const now = Date.now(),
          deposit = splitTotal(cart?.total ?? p.price, qty).deposit;
        await env.DB.prepare(
          "INSERT INTO orders(id,buyer,product,qty,price,code,status,created,payment_state,provider,deposit,hold_until,snapshot,terms_at,is_mock,mock_method,cart_items) VALUES(?,?,?,?,?,?,'pending_payment',?,'unpaid',?,?,?,?,?,?,?,?)",
        )
          .bind(
            id,
            me.id,
            p.id,
            qty,
            cart?.total ?? p.price,
            crypto.randomUUID().slice(0, 8).toUpperCase(),
            now,
            b.provider,
            deposit,
            now + 5 * 60000,
            JSON.stringify({
              title: cart ? cart.items.map(i=>i.title).join(", ") : p.title,
              shop: p.shop,
              address: p.address,
              image: p.image,
              allergens: p.allergens,
              storage: p.storage,
              prepared_at:p.prepared_at,best_before:p.best_before,
              lat: p.lat,
              lng: p.lng,
              until: cart?.until ?? p.until,
            }),
            now,
            mock ? 1 : 0,
            mock ? method : null,
            JSON.stringify(cart?.items || []),
          )
          .run();
        o = { id, deposit };
      }
      if (mock)
        return json({
          ok: true,
          id,
          redirect: "/mock-payment?id=" + encodeURIComponent(id),
        });
      if (b.provider === "card")
        return json(await chargeCardPayment(env, me.id, id, b.cardId));
      return json({
        ok: true,
        id,
        redirect: paymentUrl(
          env,
          b.provider,
          id,
          o.deposit,
          new URL(req.url).origin,
        ),
      });
    }
    if (b.action === "demoCheckout")
      return json({ error: "Yangi checkout oqimidan foydalaning" }, 410);
    if (b.action === "schedule") {
      const o = await env.DB.prepare(
        "SELECT o.*,p.until FROM orders o JOIN products p ON p.id=o.product WHERE o.id=?",
      )
        .bind(str(b.id))
        .first();
      if (!o || o.buyer !== me.id) return json({ error: "Ruxsat yo‘q" }, 403);
      if (
        o.status !== "reserved" ||
        !["paid", "test", "cash_due", "cash_paid"].includes(o.payment_state) ||
        o.pickup_selected
      )
        fail(
          "Olib ketish vaqti allaqachon belgilangan yoki buyurtma faol emas",
        );
      const at = Number(b.pickupAt),
        now = Date.now();
      if (
        !Number.isSafeInteger(at) ||
        at < now + 5 * 60000 - 2000 ||
        at > Math.min((o.paid_at || o.created) + 120 * 60000, o.until)
      )
        fail(
          "Vaqt hozirdan kamida 5 daqiqa keyin, to‘lovdan 2 soat ichida va e’lon muddatidan oldin bo‘lsin",
        );
      const changed = await env.DB.prepare(
        "UPDATE orders SET pickup_at=?,pickup_selected=1 WHERE id=? AND status='reserved' AND pickup_selected=0 AND pickup_at>?",
      )
        .bind(at, o.id, now)
        .run();
      if (!changed.meta.changes) fail("Buyurtma holati o‘zgardi");
      return json({ ok: true });
    }
    if (
      b.action === "collect" &&
      !(await throttle(env.DB, "collect:" + me.id, 10, 60000))
    )
      return json({ error: "Bir oz kuting / Подождите" }, 429);
    if (b.action === "cancel" || b.action === "collect") {
      const o = await env.DB.prepare(
        "SELECT o.*,p.owner FROM orders o JOIN products p ON p.id=o.product WHERE o.id=?",
      )
        .bind(str(b.id))
        .first();
      if (!o) fail("Buyurtma topilmadi");
      if (b.action === "cancel") {
        if (o.buyer !== me.id && o.owner !== me.id && me.role !== "admin")
          return json({ error: "Ruxsat yo‘q" }, 403);
        await env.DB.prepare(
          "UPDATE orders SET status='cancelled',payment_state=CASE WHEN payment_state='paid' THEN 'refund_due' WHEN payment_state='test' THEN 'refund_due' ELSE payment_state END WHERE id=? AND status IN ('reserved','pending_payment')",
        )
          .bind(o.id)
          .run();
        if (o.is_mock && ["test", "paid"].includes(o.payment_state))
          await refundMock(env, o.id);
      } else {
        if (o.owner !== me.id && me.role !== "admin")
          return json({ error: "Ruxsat yo‘q" }, 403);
        if (o.pickup_at && o.pickup_at <= Date.now())
          fail("Olib ketish muddati tugagan");
        if (o.status !== "reserved" || !["paid","test","cash_due","legacy"].includes(o.payment_state)) fail("Buyurtma allaqachon yakunlangan yoki qaytarish kutilmoqda");
        if (String(b.code).trim().toUpperCase() !== o.code)
          fail("Topshirish kodi noto‘g‘ri");
        if(o.provider==='cash'&&b.cashReceived!==true)fail('To‘liq naqd pulni olganingizni tasdiqlang');
        await env.DB.prepare("UPDATE orders SET status='collected',payment_state=CASE WHEN provider='cash' THEN 'cash_paid' ELSE payment_state END,paid_at=CASE WHEN provider='cash' THEN ? ELSE paid_at END WHERE id=? AND status='reserved' AND pickup_at>?").bind(Date.now(),o.id,Date.now()).run();
      }
      return json({ ok: true });
    }
    if (b.action === "toggle") {
      const p = await env.DB.prepare("SELECT * FROM products WHERE id=?")
        .bind(str(b.id))
        .first();
      if (!p || (p.owner !== me.id && me.role !== "admin"))
        return json({ error: "Ruxsat yo‘q" }, 403);
      if (!["approved", "legacy"].includes(p.image_status))
        fail("Rasm avval admin tomonidan tasdiqlanishi kerak");
      await env.DB.prepare("UPDATE products SET active=? WHERE id=?")
        .bind(p.active ? 0 : 1, p.id)
        .run();
      return json({ ok: true });
    }
    return json({ error: "Noma’lum amal" }, 400);
  } catch (e) {
    logError("POST /api/data", e);
    if (schemaMissing(e)) return json({ error: SCHEMA_HINT }, 503);
    return json(
      {
        error: /stock|constraint/i.test(e.message)
          ? "Mahsulot qoldig‘i yetarli emas"
          : e.message?.startsWith("D1")
            ? "Amal bajarilmadi. Qayta urinib ko‘ring"
            : e.message,
      },
      400,
    );
  }
}

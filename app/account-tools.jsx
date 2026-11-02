"use client";
import {Translated} from "./language";

import Link from "next/link";
import { useEffect, useState } from "react";
export function AccountTools() {
  const [msg, M] = useState(""),
    [phone, P] = useState(null),
    [sms, S] = useState(null),
    [code, C] = useState("");
  useEffect(() => {
    fetch("/api/phone").then(r => r.json()).then(P).catch(() => M("Telefon holati yuklanmadi"));
  }, []);
  async function verify(action) {
    try {
      const r = await fetch("/api/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          code
        })
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      S(d);
      if (d.verified) P({
        ...phone,
        verified: true
      });
    } catch (e) {
      M(e.message);
    }
  }
  async function remove() {
    if (!confirm("Hisob va shaxsiy ma’lumotlar o‘chirilsinmi? / Удалить аккаунт и персональные данные?")) return;
    const r = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        confirm: "DELETE"
      })
    });
    const d = await r.json();
    if (!r.ok) M(d.error);else location.assign("/");
  }
  return <section className="approval-panel">
      <h2><Translated>{"Hisob xavfsizligi / \u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C"}</Translated></h2>
      {phone && !phone.verified && <>
          <button onClick={() => verify("send")}><Translated>{"Telefonni tasdiqlash / \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0442\u0435\u043B\u0435\u0444\u043E\u043D"}</Translated></button>
          {sms?.mockCode && <p>SINOV SMS: {sms.mockCode}</p>}
          <label>
            SMS
            <input value={code} onChange={e => C(e.target.value)} maxLength={6} />
          </label>
          <button onClick={() => verify("verify")}><Translated>{"Tasdiqlash / \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C"}</Translated></button>
        </>}
      <Link href="/api/account" download><Translated>{"Ma\u2019lumotlarni eksport / \u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u0430\u043D\u043D\u044B\u0445"}</Translated></Link>
      <button className="secondary" onClick={remove}><Translated>{"Hisobni o\u2018chirish / \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442"}</Translated></button>
      <p role="status">{msg}</p>
    </section>;
}
const labels = {
  new_order: "Yangi buyurtma / Новый заказ",
  paid: "To‘lov tasdiqlandi / Оплата подтверждена",
  pickup_soon: "Olib ketish vaqti yaqin / Скоро получение",
  cancelled: "Bekor qilindi / Отменён",
  collected: "Topshirildi / Выдан",
  refunded: "Qaytarildi / Возврат",
  seller_approved: "Sotuvchi tasdiqlandi / Продавец подтверждён",
  seller_rejected: "Sotuvchi rad etildi / Продавец отклонён",
  review: "Yangi sharh / Новый отзыв",
  expired: "Muddati tugadi / Срок истёк",
  payment_expired: "To‘lov muddati tugadi / Срок оплаты истёк"
};
export function Notifications() {
  const [items, I] = useState([]),
    [msg, M] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      I(d.notifications);
    } catch (e) {
      M(e.message);
    }
  }
  useEffect(() => {
    queueMicrotask(load);
  }, []);
  return <section className="approval-panel">
      <h2><Translated>{"Bildirishnomalar / \u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"}</Translated></h2>
      <button onClick={load}><Translated>{"Yangilash / \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C"}</Translated></button>
      <button onClick={async () => {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          all: true
        })
      });
      load();
    }}><Translated>{"Barchasi o\u2018qildi / \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E \u0432\u0441\u0451"}</Translated></button>
      {items.length ? items.map(n => <p key={n.id} style={{
      fontWeight: n.read_at ? 400 : 700
    }}>
            {labels[n.kind] || n.kind} · {new Date(n.created).toLocaleString()}{" "}
            <Link href="/?view=orders">↗</Link>
          </p>) : <p><Translated>{"Hozircha yo\u2018q / \u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E"}</Translated></p>}
      <p role="status">{msg}</p>
    </section>;
}
export function ReportButton({
  kind,
  target
}) {
  const [msg, M] = useState("");
  return <>
      <button className="text-link" onClick={async () => {
      const reason = prompt("Shikoyat sababi / Причина жалобы");
      if (!reason) return;
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind,
          target,
          reason
        })
      });
      const d = await r.json();
      M(r.ok ? "Yuborildi / Отправлено" : d.error);
    }}><Translated>{"Shikoyat / \u041F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C\u0441\u044F"}</Translated></button>
      <small role="status">{msg}</small>
    </>;
}
export function AdminQueues() {
  const [reports, R] = useState([]),
    [refunds, F] = useState([]),
    [msg, M] = useState("");
  async function load() {
    try {
      const [a, b] = await Promise.all(["/api/reports", "/api/refunds"].map(async u => {
        const r = await fetch(u);
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      }));
      R(a.reports);
      F(b.orders);
    } catch (e) {
      M(e.message);
    }
  }
  useEffect(() => {
    queueMicrotask(load);
  }, []);
  async function act(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    M(d.error || "Saqlandi / Сохранено");
    load();
  }
  return <section className="approval-panel">
      <h2><Translated>{"Shikoyat va qaytarish / \u0416\u0430\u043B\u043E\u0431\u044B \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u044B"}</Translated></h2>
      {reports.map(r => <p key={r.id}>
          {r.kind}: {r.reason} · {r.status}{" "}
          {r.status === "pending" && <button onClick={() => act("/api/reports", {
        action: "resolve",
        id: r.id
      })}><Translated>{"Ko\u2018rib chiqildi / \u0420\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E"}</Translated></button>}
        </p>)}
      {refunds.map(o => <article className="partner-form" key={o.id}><b>#{o.receipt_no||o.id.slice(0,8)} · {o.provider==='cash'?o.price*o.qty:o.deposit} UZS</b><p>{o.payment_state==='refunded'?'Pul qaytarilgan / Деньги возвращены':'Qaytarish kutilmoqda / Ожидает возврата'}</p>{o.reference&&<p>{o.reference}</p>}{o.payment_state.includes('refund_due')&&(o.is_mock&&o.provider!=='cash'?<button onClick={()=>act('/api/refunds',{id:o.id})}>Qaytarishni sinash / Проверить возврат</button>:<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);act('/api/refunds',{id:o.id,reference:f.get('reference'),confirmed:f.get('confirmed')==='on'});}}><p>Pulni avval xaridorga qaytaring. Bu forma amalga oshirilgan qaytarishni hisobga oladi, bank o‘tkazmasini bajarmaydi. / Сначала верните деньги покупателю; форма фиксирует возврат и не переводит деньги.</p><label>Hujjat raqami / Номер документа<input name="reference" required minLength={5} maxLength={300}/></label><label className="check"><input name="confirmed" type="checkbox" required/>Pul qaytarildi / Деньги возвращены</label><button>Qaytarishni qayd qilish / Записать возврат</button></form>)}</article>)}
      <p role="status">{msg}</p>
    </section>;
}
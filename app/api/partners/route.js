import {env} from 'cloudflare:workers';
import {getAppUser,sameOrigin} from '../../../lib/auth.js';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const text=(v,max=500)=>String(v||'').trim().slice(0,max);
export async function GET(req){try{
 const q=new URL(req.url).searchParams;
 if(q.has('owner')){const p=await env.DB.prepare('SELECT b.id,b.name FROM partner_businesses b JOIN users u ON u.id=b.owner WHERE b.owner=? AND b.enabled=1 AND u.selling_paused=0').bind(q.get('owner')).first();return json({cash:!!p,name:p?.name});}
 const u=await getAppUser();if(!u||!['admin','seller'].includes(u.role))return json({error:'Ruxsat yo‘q'},403);
 const businesses=(await env.DB.prepare("SELECT b.*,u.name seller,u.selling_paused,COALESCE((SELECT SUM(amount) FROM partner_ledger l WHERE l.partner_id=b.id),0) balance,COALESCE((SELECT SUM(amount) FROM partner_ledger l WHERE l.partner_id=b.id AND l.kind='commission'),0) accrued,COALESCE((SELECT -SUM(amount) FROM partner_ledger l WHERE l.partner_id=b.id AND l.kind='settlement'),0) settled,COALESCE((SELECT -SUM(amount) FROM partner_ledger l WHERE l.partner_id=b.id AND l.kind='refund'),0) reversed,(SELECT COUNT(*) FROM orders o WHERE o.partner_id=b.id AND o.status='collected') completed FROM partner_businesses b LEFT JOIN users u ON u.id=b.owner WHERE ?='admin' OR b.owner=? ORDER BY b.created DESC").bind(u.role,u.userId).all()).results;
 const selected=q.get('id');const allowed=businesses.some(b=>b.id===selected);
 const ledger=selected&&allowed?(await env.DB.prepare('SELECT l.*,u.name actor_name FROM partner_ledger l LEFT JOIN users u ON u.id=l.actor WHERE l.partner_id=? ORDER BY l.created DESC LIMIT 200').bind(selected).all()).results:[];
 const orders=selected&&allowed?(await env.DB.prepare('SELECT o.id,o.receipt_no,o.price,o.qty,o.status,o.payment_state,o.created,o.commission_due,o.commission_rate,o.pickup_at FROM orders o WHERE partner_id=? ORDER BY created DESC LIMIT 200').bind(selected).all()).results:[];
 const sellers=u.role==='admin'?(await env.DB.prepare("SELECT id,name,business_name,selling_paused FROM users WHERE role='seller' ORDER BY name").all()).results:[];
 const events=u.role==='admin'?(await env.DB.prepare('SELECT e.*,u.name actor_name FROM admin_events e LEFT JOIN users u ON u.id=e.actor ORDER BY created DESC LIMIT 50').all()).results:[];
 return json({businesses,ledger,orders,sellers,events});
 }catch{return json({error:'Hisob yuklanmadi. Migratsiyalarni tekshiring.'},500);}}
export async function POST(req){try{
 if(!sameOrigin(req))return json({error:'Origin'},403);const u=await getAppUser();if(u?.role!=='admin')return json({error:'Faqat admin'},403);
 const b=await req.json(),now=Date.now(),db=env.DB;
 if(b.action==='save'){
  const id=text(b.id,80)||crypto.randomUUID(),name=text(b.name,100),contact=text(b.contact,100),address=text(b.address),owner=text(b.owner,100)||null,rate=Number(b.rate_bps);
  if(!name||!contact||!address||!Number.isSafeInteger(rate)||rate<0||rate>10000)throw Error('Nom, aloqa, manzil va komissiyani to‘g‘ri kiriting');
  if(owner&&!await db.prepare("SELECT id FROM users WHERE id=? AND role='seller'").bind(owner).first())throw Error('Ro‘yxatdan o‘tgan sotuvchini tanlang');
  const prior=await db.prepare('SELECT * FROM partner_businesses WHERE id=?').bind(id).first();
  if(prior&&prior.owner!==owner&&await db.prepare('SELECT id FROM orders WHERE partner_id=? LIMIT 1').bind(id).first())throw Error('Buyurtmasi bor hamkorning sotuvchi hisobini almashtirib bo‘lmaydi');
  await db.batch([db.prepare('INSERT INTO partner_businesses(id,owner,name,contact,address,rate_bps,enabled,created,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,name=excluded.name,contact=excluded.contact,address=excluded.address,rate_bps=excluded.rate_bps,enabled=excluded.enabled,updated=excluded.updated').bind(id,owner,name,contact,address,rate,b.enabled===false?0:1,now,now),db.prepare('INSERT INTO admin_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'partner_save',JSON.stringify({name,owner,rate,enabled:b.enabled!==false,previous:prior?{rate:prior.rate_bps,enabled:prior.enabled}:null}),now)]);
  return json({ok:true,id});
 }
 if(b.action==='settle'){
  const id=text(b.requestId,80),partner=text(b.id,80),amount=Number(b.amount),reference=text(b.reference,300);
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(id)||!Number.isSafeInteger(amount)||amount<=0||reference.length<4||b.confirmed!==true)throw Error('Qabul qilingan summa, kassa hujjati va tasdiqni kiriting');
  const prior=await db.prepare('SELECT * FROM partner_ledger WHERE id=?').bind(id).first();
  if(prior){if(prior.kind!=='settlement'||prior.partner_id!==partner||prior.amount!==-amount||prior.reference!==reference)throw Error('So‘rov mos emas');return json({ok:true});}
  const result=await db.prepare("INSERT INTO partner_ledger(id,partner_id,kind,amount,actor,reference,created) SELECT ?,id,'settlement',?,?,?,? FROM partner_businesses WHERE id=? AND ?>0 AND ?<=COALESCE((SELECT SUM(amount) FROM partner_ledger WHERE partner_id=?),0)").bind(id,-amount,u.userId,reference,now,partner,amount,amount,partner).run();
  if(!result.meta.changes)throw Error('Summa mavjud komissiya qarzidan katta yoki hamkor topilmadi');return json({ok:true});
 }
 if(b.action==='restrict'){
  const id=text(b.id,100),reason=text(b.reason,1000);if(reason.length<5||typeof b.paused!=='boolean')throw Error('Sababini yozing');
  if(!await db.prepare("SELECT id FROM users WHERE id=? AND role='seller'").bind(id).first())throw Error('Sotuvchi topilmadi');
  await db.batch([db.prepare('UPDATE users SET selling_paused=? WHERE id=?').bind(b.paused?1:0,id),db.prepare('UPDATE products SET active=0 WHERE owner=? AND ?=1').bind(id,b.paused?1:0),db.prepare('INSERT INTO admin_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,b.paused?'seller_pause':'seller_resume',reason,now)]);return json({ok:true});
 }
 throw Error('Noma’lum amal');
 }catch(e){return json({error:/UNIQUE/.test(e.message)?'Bu sotuvchi boshqa hamkorga biriktirilgan':e.message},400);}}

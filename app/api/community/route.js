import {env} from 'cloudflare:workers';
import {getAppUser,sameOrigin} from '../../../lib/auth.js';
export async function GET(){const u=await getAppUser();if(!u)return Response.json({follows:[],waiting:[],claims:[]});return Response.json({follows:(await env.DB.prepare('SELECT seller,hour FROM shop_follows WHERE owner=?').bind(u.userId).all()).results,waiting:(await env.DB.prepare('SELECT product FROM waitlist WHERE owner=?').bind(u.userId).all()).results,claims:(await env.DB.prepare(u.role==='admin'?'SELECT * FROM quality_claims ORDER BY created DESC LIMIT 200':'SELECT * FROM quality_claims WHERE owner=? ORDER BY created DESC').bind(...(u.role==='admin'?[]:[u.userId])).all()).results},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req){try{
 if(!sameOrigin(req))return Response.json({error:'Origin'},{status:403});const u=await getAppUser();if(!u)return Response.json({error:'Hisobga kiring'},{status:401});const b=await req.json(),now=Date.now();
 if(b.action==='follow'){
  const seller=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='seller'").bind(String(b.seller)).first();if(!seller)throw Error('Do‘kon topilmadi');
  if(b.enabled===false)await env.DB.prepare('DELETE FROM shop_follows WHERE owner=? AND seller=?').bind(u.userId,seller.id).run();
  else {const hour=Number(b.hour??18);if(!Number.isInteger(hour)||hour<0||hour>23)throw Error('Soat noto‘g‘ri');await env.DB.prepare('INSERT INTO shop_follows(owner,seller,hour) VALUES(?,?,?) ON CONFLICT(owner,seller) DO UPDATE SET hour=excluded.hour').bind(u.userId,seller.id,hour).run();}
 }else if(b.action==='wait'){
  const item=await env.DB.prepare('SELECT id FROM products WHERE id=? AND active=1').bind(String(b.id)).first();if(!item)throw Error('Taklif topilmadi');
  await env.DB.prepare('INSERT OR IGNORE INTO waitlist VALUES(?,?,?)').bind(u.userId,item.id,now).run();
 }else if(b.action==='claim'){
  const order=await env.DB.prepare("SELECT id FROM orders WHERE id=? AND buyer=? AND status IN ('reserved','collected')").bind(String(b.id),u.userId).first();if(!order)throw Error('Buyurtma topilmadi');
  const reason=String(b.reason||'').trim();if(reason.length<10||reason.length>2000)throw Error('Muammoni 10–2000 belgi bilan yozing');
  await env.DB.prepare('INSERT INTO quality_claims(id,order_id,owner,reason,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(order_id) DO NOTHING').bind(crypto.randomUUID(),order.id,u.userId,reason,now,now).run();
 }else if(b.action==='resolve'&&u.role==='admin'){
  if(!['approved','rejected'].includes(b.status)||String(b.reply||'').trim().length<5)throw Error('Qaror izohini kiriting');
  const claim=await env.DB.prepare("SELECT * FROM quality_claims WHERE id=? AND status='pending'").bind(String(b.id)).first();if(!claim)throw Error('Murojaat allaqachon ko‘rilgan');
  await env.DB.batch([env.DB.prepare("UPDATE quality_claims SET status=?,reply=?,updated=? WHERE id=? AND status='pending'").bind(b.status,String(b.reply).slice(0,1000),now,claim.id),env.DB.prepare("UPDATE orders SET status=CASE WHEN status IN ('reserved','pending_payment') THEN 'cancelled' ELSE status END,payment_state=CASE WHEN payment_state='cash_paid' THEN 'cash_refund_due' WHEN payment_state IN ('paid','test') THEN 'refund_due' ELSE payment_state END WHERE id=? AND ?='approved'").bind(claim.order_id,b.status),env.DB.prepare("INSERT OR REPLACE INTO notifications(id,owner,kind,entity,created) VALUES(?,?,'claim_updated',?,?)").bind(crypto.randomUUID(),claim.owner,claim.order_id,now)]);
 }else throw Error('Noma’lum amal');return Response.json({ok:true});
 }catch(e){return Response.json({error:e.message},{status:400});}}

import {env} from 'cloudflare:workers';
import {getAppUser,sameOrigin} from '../../../lib/auth.js';
import {refundMock} from '../../../lib/mock-payment.js';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getAppUser();if(u?.role!=='admin')return json({error:'Faqat admin'},403);return json({orders:(await env.DB.prepare("SELECT o.id,o.receipt_no,o.price,o.qty,o.deposit,o.payment_state,o.is_mock,o.provider,r.reference,r.created refunded_at FROM orders o LEFT JOIN refund_records r ON r.order_id=o.id WHERE payment_state IN ('refund_due','cash_refund_due','refunded') ORDER BY o.created DESC LIMIT 200").all()).results});}
export async function POST(req){try{
 if(!sameOrigin(req))return json({error:'Origin'},403);const u=await getAppUser();if(u?.role!=='admin')return json({error:'Faqat admin'},403);const b=await req.json();
 const o=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(String(b.id)).first();if(!o)throw Error('Topilmadi');
 if(o.is_mock&&o.provider!=='cash')return json(await refundMock(env,o.id));
 const reference=String(b.reference||'').trim();if(b.confirmed!==true||reference.length<5||reference.length>300)throw Error('Xaridorga pul qaytarilganini tasdiqlang va hujjat raqamini kiriting');
 const amount=o.provider==='cash'?o.price*o.qty:o.deposit;
 const prior=await env.DB.prepare('SELECT * FROM refund_records WHERE order_id=?').bind(o.id).first();if(prior){if(prior.reference!==reference)throw Error('Qaytarish avval boshqa hujjat bilan qayd etilgan');return json({ok:true});}
 if(!['refund_due','cash_refund_due'].includes(o.payment_state))throw Error('Buyurtma qaytarish navbatida emas');
 const now=Date.now();
 await env.DB.batch([env.DB.prepare("INSERT INTO refund_records(order_id,amount,actor,reference,created) SELECT id,?,?,?,? FROM orders WHERE id=? AND payment_state IN ('refund_due','cash_refund_due')").bind(amount,u.userId,reference,now,o.id),env.DB.prepare('INSERT INTO admin_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,o.id,'refund_record',JSON.stringify({amount,reference}),now)]);
 return json({ok:true,message:'Tashqarida amalga oshirilgan qaytarish hisobga olindi. Sayt bank o‘tkazmasini bajarmadi.'});
 }catch(e){return json({error:e.message},400);}}

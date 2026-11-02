import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../lib/auth.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req){
 const me=await getAppUser();
 if(!me)return json({error:'Hisobga kiring'},401);
 if(!['admin','seller'].includes(me.role))return json({error:'Ruxsat yo‘q'},403);
 const q=new URL(req.url).searchParams;
 const page=Math.max(1,Math.min(100000,parseInt(q.get('page'),10)||1)),size=25;
 const kind=q.get('kind')||'activity';
 try{
 if(kind==='users'){
  if(me.role!=='admin')return json({error:'Faqat admin'},403);
  const search='%'+String(q.get('q')||'').slice(0,100)+'%',role=['member','seller','admin'].includes(q.get('role'))?q.get('role'):'';
  const where="u.role!='deleted' AND (u.name LIKE ? OR u.business_name LIKE ?) AND (?='' OR u.role=?)";
  const params=[search,search,role,role];
  const total=await env.DB.prepare('SELECT COUNT(*) n FROM users u WHERE '+where).bind(...params).first();
  const rows=await env.DB.prepare(`SELECT u.id,u.name,u.role,u.created,u.verified,u.verification,u.business_name,(SELECT COUNT(*) FROM products p WHERE p.owner=u.id) products,(SELECT COUNT(*) FROM orders o WHERE o.buyer=u.id) purchases FROM users u WHERE ${where} ORDER BY u.created DESC,u.id LIMIT ? OFFSET ?`).bind(...params,size,(page-1)*size).all();
  return json({users:rows.results,page,pages:Math.max(1,Math.ceil(total.n/size)),total:total.n});
 }
 if(kind!=='activity')return json({error:'Noto‘g‘ri bo‘lim'},400);
 const rows=await env.DB.prepare("SELECT e.id,e.qty,e.created,p.title,p.shop,u.name actor FROM stock_events e JOIN products p ON p.id=e.product JOIN users u ON u.id=e.actor WHERE (p.owner=? OR ?='admin') ORDER BY e.created DESC LIMIT 100").bind(me.userId,me.role).all();
 return json({events:rows.results});
 }catch{return json({error:'Ma’lumot yuklanmadi. Qayta urinib ko‘ring.'},500);}
}

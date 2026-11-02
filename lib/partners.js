import {prepareCart} from './cart.js';
export function freshness(p,until,now=Date.now()){
 const prepared=p.prepared_at===''||p.prepared_at==null?null:Number(p.prepared_at),best=p.best_before===''||p.best_before==null?null:Number(p.best_before);
 if(prepared===null&&best===null)return {prepared:null,best:null};
 if(!Number.isSafeInteger(prepared)||!Number.isSafeInteger(best)||prepared>now+300000||prepared<=0||best<=prepared||best<=now||until>best)throw Error('Tayyorlangan vaqt va iste’mol muddatini tekshiring. Olish muddati iste’mol muddatidan kech bo‘lmasin.');
 return {prepared,best};
}
export async function cashCheckout(db,me,b){
 if(b.acceptTerms!==true)throw Error('Olib ketish shartini tasdiqlang');
 const id=String(b.requestId||'');if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))throw Error('So‘rov identifikatori noto‘g‘ri');
 const input=b.items||[{id:b.id,qty:Number(b.qty)}];
 const prior=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
 if(prior){const norm=v=>JSON.stringify(v.map(p=>[p.id,p.qty]).sort((a,b)=>a[0].localeCompare(b[0])));if(prior.buyer!==me.id||prior.provider!=='cash'||!Array.isArray(input)||norm(input)!==norm(JSON.parse(prior.cart_items)))throw Error('So‘rov mos emas');return {ok:true,id,receiptReady:true};}
 const count=await db.prepare("SELECT COUNT(*) n FROM orders WHERE buyer=? AND provider='cash' AND status='reserved'").bind(me.id).first();if(count.n>=3)throw Error('Avval faol naqd buyurtmalaringizni olib keting yoki bekor qiling');
 const cart=await prepareCart(db,input,me.id),p=cart.items[0],now=Date.now();
 const partner=await db.prepare('SELECT b.* FROM partner_businesses b JOIN users u ON u.id=b.owner WHERE b.owner=? AND b.enabled=1 AND u.selling_paused=0').bind(p.owner).first();
 if(!partner)throw Error('Ushbu do‘kon uchun naqd to‘lov yoqilmagan');
 await db.prepare("INSERT INTO orders(id,buyer,product,qty,price,code,status,created,payment_state,provider,deposit,pickup_at,snapshot,terms_at,is_mock,cart_items,partner_id,commission_rate,commission_due) VALUES(?,?,?,1,?,?,'reserved',?,'cash_due','cash',0,?,?,?,0,?,?,?,?)").bind(id,me.id,p.id,cart.total,crypto.randomUUID().slice(0,8).toUpperCase(),now,Math.min(now+30*60000,cart.until),JSON.stringify({title:cart.items.map(p=>p.title).join(', '),shop:p.shop,address:p.address,image:p.image,allergens:p.allergens,storage:p.storage,lat:p.lat,lng:p.lng,prepared_at:p.prepared_at,best_before:p.best_before,until:cart.until}),now,JSON.stringify(cart.items),partner.id,partner.rate_bps,Math.ceil(cart.total*partner.rate_bps/10000)).run();
 return {ok:true,id,receiptReady:true,message:'Bron tayyor. To‘liq summa do‘konda naqd to‘lanadi.'};
}
export async function reorderPreview(db,me,id){
 const o=await db.prepare('SELECT * FROM orders WHERE id=? AND buyer=?').bind(String(id),me.id).first();if(!o)throw Error('Buyurtma topilmadi');
 const old=JSON.parse(o.cart_items||'[]');if(!old.length)old.push({id:o.product,qty:o.qty,price:o.price});
 const items=[],changes=[];
 for(const row of old){const p=await db.prepare('SELECT p.*,u.selling_paused FROM products p JOIN users u ON u.id=p.owner WHERE p.id=?').bind(row.id).first();if(!p||!p.active||p.stock<1||p.until<Date.now()+600000||p.selling_paused||(p.best_before&&p.best_before<=Date.now())){changes.push((row.title||'Mahsulot')+': hozir mavjud emas');continue;}const qty=Math.min(row.qty,p.stock);items.push({...p,qty});if(qty!==row.qty||p.price!==row.price)changes.push(p.title+': narx yoki miqdor yangilandi');}
 return {items,changes};
}

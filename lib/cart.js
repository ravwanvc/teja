export async function prepareCart(db,items,buyer,now=Date.now()) {
 if(!Array.isArray(items)||!items.length||items.length>20)throw Error('Savatda 1–20 xil mahsulot bo‘lishi kerak');
 const result=[];let seller;
 for(const item of items){
  if(typeof item.id!=='string'||!Number.isInteger(item.qty)||item.qty<1||item.qty>1000||result.some(p=>p.id===item.id))throw Error('Savat miqdori noto‘g‘ri');
  const p=await db.prepare('SELECT p.*,u.selling_paused FROM products p JOIN users u ON u.id=p.owner WHERE p.id=?').bind(item.id).first();
  if(!p||!p.active||p.selling_paused||(p.best_before&&p.best_before<=now)||p.stock<item.qty||p.until<now+600000)throw Error('Mahsulot tugagan yoki olish vaqti yetarli emas');
  if(p.owner===buyer)throw Error('O‘z mahsulotingizni xarid qila olmaysiz');
  if(seller&&seller!==p.owner)throw Error('Bitta buyurtma — bitta do‘kon');
  seller=p.owner;result.push({id:p.id,title:p.title,price:p.price,original:p.original,qty:item.qty,until:p.until,image:p.image,owner:p.owner,shop:p.shop,address:p.address,lat:p.lat,lng:p.lng,allergens:p.allergens,storage:p.storage,prepared_at:p.prepared_at,best_before:p.best_before});
 }
 result.sort((a,b)=>a.until-b.until||a.id.localeCompare(b.id));
 return {items:result,total:result.reduce((s,p)=>s+p.price*p.qty,0),until:Math.min(...result.map(p=>p.until))};
}

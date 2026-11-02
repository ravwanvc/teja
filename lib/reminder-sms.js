export const remindersConfigured=env=>env.REMINDER_SMS_READY==='true'&&env.SMS_MODE==='live'&&!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_MESSAGING_SERVICE_SID);
// At most one submission per order. An ambiguous timeout is kept for reconciliation,
// never blindly retried: the provider may already have accepted the message.
export async function sendPickupSms(env,now=Date.now()){
 if(!remindersConfigured(env))return {submitted:0,configured:false};
 const db=env.DB,rows=(await db.prepare("SELECT o.id,o.pickup_at,a.phone FROM orders o JOIN app_accounts a ON a.owner=o.buyer JOIN reminder_preferences r ON r.owner=o.buyer WHERE r.sms=1 AND a.phone_verified=1 AND o.is_mock=0 AND o.status='reserved' AND o.pickup_at>? AND o.pickup_at<=? AND NOT EXISTS(SELECT 1 FROM reminder_deliveries d WHERE d.order_id=o.id) LIMIT 25").bind(now,now+900000).all()).results;
 let submitted=0;
 for(const o of rows){
  const claim=await db.prepare("INSERT OR IGNORE INTO reminder_deliveries(order_id,state,created,updated) VALUES(?,'submitting',?,?)").bind(o.id,now,now).run();if(!claim.meta.changes)continue;
  try{
   const when=new Date(o.pickup_at).toLocaleTimeString('uz-UZ',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit'});
   const r=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(env.TWILIO_ACCOUNT_SID)+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:o.phone,MessagingServiceSid:env.TWILIO_MESSAGING_SERVICE_SID,Body:'TEJA: buyurtmangizni '+when+' gacha olib keting. Ulgurmasangiz Hisobim > Buyurtmalar bo‘limida bekor qiling.'}),signal:AbortSignal.timeout(10000)});
   const payload=await r.json();if(!r.ok||!payload.sid){await db.prepare("UPDATE reminder_deliveries SET state='failed',error=?,updated=? WHERE order_id=?").bind('HTTP '+r.status,now,o.id).run();continue;}
   await db.prepare("UPDATE reminder_deliveries SET state='submitted',provider_id=?,updated=? WHERE order_id=?").bind(payload.sid,now,o.id).run();submitted++;
  }catch{await db.prepare("UPDATE reminder_deliveries SET state='unknown',error='Tasdiq olinmadi; provayder jurnalini tekshiring',updated=? WHERE order_id=?").bind(now,o.id).run();}
 }
 return {submitted,configured:true};
}

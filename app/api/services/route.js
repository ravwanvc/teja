import { mockPayments } from "../../../lib/modes.js";
import { env } from "cloudflare:workers";
import { currentUser } from "../../../lib/auth.js";
import { paymentConfig } from "../../../lib/payments.js";
export async function GET() {
  if ((await currentUser())?.role !== "admin")
    return Response.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  const payments = paymentConfig(env);
  return Response.json(
    {
      modes: {
        payments: mockPayments(env) ? "mock" : "live",
        sms: env.SMS_MODE || "mock",
      },
      services: [{name:"Olib ketish SMS eslatmasi",configured:env.REMINDER_SMS_READY==="true"&&env.SMS_MODE==="live"&&!!env.TWILIO_MESSAGING_SERVICE_SID,keys:["REMINDER_SMS_READY","TWILIO_MESSAGING_SERVICE_SID"],note:"Xaridor roziligi va tasdiqlangan raqam kerak. Worker jadvalini har daqiqaga sozlang."},{name:"Google Maps — oddiy xarita",configured:true,keys:[],note:"Internet orqali tanlangan do‘kon manzili ko‘rinadi. Google ichidagi joy tavsiyalarini boshqarib bo‘lmaydi."},{name:"Google Maps — narxli belgilar",configured:!!env.GOOGLE_MAPS_BROWSER_KEY,keys:["GOOGLE_MAPS_BROWSER_KEY"],note:"Maps JavaScript API yoqilgan, billing ulangan va browser kaliti domenlarga cheklangan bo‘lishi kerak."},
        {
          name: "Payme to‘lovi",
          configured: payments.payme,
          keys: [
            "PAYME_MERCHANT_ID",
            "PAYME_MERCHANT_KEY",
            "PAYMENT_CALLBACKS_READY",
          ],
          note: "Callback: /api/payments/payme. Hisob maydoni: order_id.",
        },
        {
          name: "Click to‘lovi",
          configured: payments.click,
          keys: [
            "CLICK_MERCHANT_ID",
            "CLICK_SERVICE_ID",
            "CLICK_SECRET_KEY",
            "PAYMENT_CALLBACKS_READY",
          ],
          note: "Prepare / Complete: /api/payments/click.",
        },
        {
          name: "Saqlangan kartadan to‘lov",
          configured: payments.card,
          keys: [
            "PAYME_SUBSCRIBE_ID",
            "PAYME_SUBSCRIBE_KEY",
            "SUBSCRIBE_PAYMENTS_READY",
          ],
          note: "10% to‘lov serverda yaratiladi va Payme javobi bilan tasdiqlanadi. Virtual terminal kerak.",
        },
        {
          name: "Bank kartalari",
          configured: !!(env.PAYME_SUBSCRIBE_ID && env.PAYME_SUBSCRIBE_KEY),
          keys: ["PAYME_SUBSCRIBE_ID", "PAYME_SUBSCRIBE_KEY"],
          note: "Payme Subscribe: token va bank SMS tasdig‘i. Visa ulanmagan.",
        },
        {
          name: "Telefon SMS",
          configured: !!(
            env.TWILIO_ACCOUNT_SID &&
            env.TWILIO_AUTH_TOKEN &&
            env.TWILIO_VERIFY_SERVICE_SID
          ),
          keys: [
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_VERIFY_SERVICE_SID",
          ],
          note: "Twilio Verify. +998 raqamlarga jo‘natish provayderda ruxsat etilishi kerak.",
        },
        {
          name: "Rasm tahlili",
          configured: !!(env.GEMINI_API_KEY && env.GEMINI_MODEL),
          keys: ["GEMINI_API_KEY", "GEMINI_MODEL"],
          note: "Gemini. Mos rasmlar avtomatik o‘tadi. Noaniq natijada rasm saqlanadi va admin tekshiruvini kutadi.",
        },
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

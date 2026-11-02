# Cloudflare joylash

Bu fayl yo‘riqnoma; mazkur ish davomida production deploy bajarilmadi.

1. Alohida test Cloudflare account/project, D1 va R2 yarating. Mock bazani live bazadan ajrating. D1 backup oling.
2. `npx wrangler login`, `npx wrangler d1 create teja`, `npx wrangler r2 bucket create teja-images`.
3. `vite.config.ts` dagi D1 `database_id` placeholderini, `database_name`, R2 `bucket_name` va Worker nomini egangiz yaratgan resurslarga moslang. Lokal migratsiya skriptidagi IDni productionga almashtirmang: lokal va remote bazani chalkashtirmang.
4. `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. Build yaratgan `dist/server/wrangler.json` konfiguratsiyasidagi `DB`, `BUCKET`, `migrations_dir` ni tekshiring. `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json`. Oldin DB backup va mavjud migration ledgerni tekshiring; eski SQLlarni qayta bajarib yubormang.
6. `PAYMENTS_MODE=mock`, `SMS_MODE=mock`, `PUBLIC_SITE_URL=https://...` ni Worker vars sifatida sozlang. Kalitlarni `wrangler secret put NAME --config dist/server/wrangler.json` orqali alohida kiriting; `.env` yuklamang.
7. Cron trigger `*/5 * * * *` qo‘shing. `scheduled` expired buyurtmalar, 30 daqiqalik reminder va o‘chirilgan R2 obyektlari navbatini ishlaydi. Cron aniq sekundda yetkazishni kafolatlamaydi.
8. `npx wrangler deploy --config dist/server/wrangler.json`. TLS, D1/R2 binding, /api/auth, /api/products va receipt egasi tekshiruvini test qiling.
9. CDN/Worker loglarda telefon, OTP, kartalar, bearer yoki cookie qiymatlarini yozmang. R2 obyektlari uchun ommaviy r2.dev endpointni yoqmang; ilova `/api/image` orqali xizmat qiladi.
10. Real provayder callbacklari private preview himoyasidan tashqarida bo‘lishi kerak; merchant sozlamalari va imzo tekshiruvlarini tekshiring. `LIVE_GO_LIVE.md` dagi barcha blockerlar yopilmaguncha livega o‘tmang.

Rollback: oldingi Worker buildini qaytaring. DB migratsiyasini SQLni o‘chirib “rollback” qilmang; backup va oldinga tuzatish migratsiyasidan foydalaning. 0008 qo‘shimcha jadvallar/ustunlar va yangi callback triggeri kiritadi.

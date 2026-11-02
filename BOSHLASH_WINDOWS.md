# Windowsda boshlash

1. ZIPni alohida papkaga chiqaring.
2. Faqat ko‘rish uchun `teja\public\teja-preview.html`ni brauzerda oching.
3. To‘liq loyiha uchun `teja` papkasida PowerShell oching:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db:migrate:local
npm run dev
```

Mavjud `.env` bo‘lsa nusxalash buyrug‘i bilan ustiga yozmang. Terminaldagi Local URLni oching. Admin kerak bo‘lsa boshqa terminalda `npm run admin:setup` bajaring. Sozlamalar o‘zgargach dev serverni qayta ishga tushiring.

Oddiy Google Maps previewda internet bilan ko‘rinadi. Narxli xarita belgilari, SMS va haqiqiy to‘lovlarni ulash tartibi `README.md`da. Preview uchun haqiqiy karta yoki parol kiritmang; namuna ma’lumotlari yetarli.

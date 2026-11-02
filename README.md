# TEJA — yangilangan loyiha

TEJA ortiqcha oziq-ovqatni chegirmada topish, bir do‘kondan savat tuzish va belgilangan vaqtda olib ketish uchun mo‘ljallangan.

## Avval ko‘rib chiqish

`public/teja-preview.html` faylini Chrome yoki Edge bilan oching. Hech narsa o‘rnatish shart emas. Preview ushbu loyihaning React komponentlaridan yig‘ilgan, ammo server o‘rniga brauzerdagi namuna ma’lumotlaridan foydalanadi. Yuqoridagi Xaridor / Sotuvchi / Admin / Mehmon tugmalari orqali ko‘rinishlarni almashtiring. Bu tugmalar haqiqiy saytga qo‘shilmagan.

Preview xarita sahifasidan ochiladi. Google Maps internet orqali yuklanadi; API kalitisiz tanlangan do‘kon manzili ko‘rsatiladi. Xarid qilish, savat, chek, profil rasmi, til va rang rejimi hamda admin/sotuvchi panellarini sinash mumkin. Previewdagi rasm yuklash (2 MB gacha), mahsulot joylash, qoralama, tasdiqlash, qoldiq tarixi brauzer xotirasida simulyatsiya qilinadi. Haqiqiy pul yoki SMS yo‘q; rol almashish va “Yangilash” tugmalari faqat preview uchun. To‘liq sayt server, D1 va R2 orqali ishlaydi.

## Windows — PowerShell

ZIPni oching, `teja` papkasida terminal oching:

```powershell
node --version
npm --version
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run db:migrate:local
npm run dev
```

Terminal chiqargan mahalliy manzilni oching. Portable rejimda odatda `http://localhost:5173`.

Mavjud bazani yangilashda `.wrangler/state` papkasini saqlang va `npm run db:migrate:local` bajaring. Yangi migratsiya `0010_partner_cash.sql`; migrator mavjud mahalliy bazani zaxiralaydi. Serverning masofaviy D1 bazasi uchun migratsiyalar alohida qo‘llanadi.

Adminni sozlash:

```powershell
npm run admin:setup
npm run admin:check
```

Build va tekshiruv:

```powershell
npm test
npm run typecheck
npm run check:project
npm run build
npm start
```

`npm start` build bo‘lmasa yaratadi va mahalliy migratsiyalarni tekshiradi. `npm ci` uchun internet kerak. `node_modules`, `.wrangler`, haqiqiy kalitlar va eski build ZIPga kiritilmagan. Node >=22.13 talab qilinadi; testlar ushbu muhitdagi Node 24 bilan bajarilgan. Windowsda alohida tekshirilmagan.

## Sozlamalar

- `SMS_REQUIRED=false`: kirish — telefon va parol. Ro‘yxatdan o‘tishda SMS shart emas.
- `SMS_REQUIRED=true`: ro‘yxatdan o‘tish va savdo amallari uchun telefonni tasdiqlash kerak. Oddiy login baribir telefon va parol bilan; admin uchun mavjud 2FA saqlangan.
- Parolni tiklash har doim SMS tekshiruvini talab qiladi: telefon → SMS → bir martalik reset tokeni → yangi parol va takrorlash. Token 5 daqiqalik, hash ko‘rinishida saqlanadi. Parol o‘zgargach eski sessiyalar bekor qilinadi.
- `SMS_MODE=mock`: sinov kodi ekranda ko‘rinadi. `SMS_MODE=live`: Twilio Verify kalitlarini kiriting. Haqiqiy +998 SMS jo‘natilishi provayder bilan sinovdan o‘tkazilishi kerak.
- `GOOGLE_MAPS_BROWSER_KEY`: Maps JavaScript API kaliti. Google Cloud’da kerakli API, billing va HTTP referrer cheklovlarini sozlang. Bu browser kaliti; server sirlari o‘rnida ishlatmang. Kalit bo‘lmasa yoki API ishlamasa, oddiy Google Maps iframe ko‘rinishiga o‘tadi. Internet kerak. Oddiy xarita bitta tanlangan manzilni ko‘rsatadi; narxli bir nechta markerlar API kaliti bilan ishlaydi. Google ichidagi tavsiyalar va reklama ko‘rinishini oddiy iframe orqali boshqarib bo‘lmaydi. O‘z joylashuvi uchun brauzer ruxsati va HTTPS kerak (localhost istisno).
- `PAYMENTS_MODE=mock`: Click/Payme oqimlari pul yechmasdan sinov qilinadi. Live uchun merchant rekvizitlari va callbacklar zarur. `PAYMENT_CALLBACKS_READY=true`ni faqat provayder tekshiruvidan keyin yoqing.

## Admin va sotuvchi panellari

Admin: umumiy holat, barcha mahsulotlar va kategoriya filtri, barcha buyurtmalar, sotuvchi tasdiqlash, foydalanuvchi qidiruvi va sahifalash, rasm/sifat/shikoyat tekshiruvi, savdo CSV, qoldiq tarixi va xizmat sozlamalari holati. Foydalanuvchilar bo‘limi ro‘yxat va qidiruv uchun; hisobni bloklash yoki admin tayinlash qo‘shilmagan.

Sotuvchi: o‘z mahsulotlari, yangi e’lon/qoralama, kunlik tezkor forma, o‘z savdo buyurtmalari, QR yoki kod bilan topshirish, hisobot, oxirgi 100 ta qoldiq qo‘shish tarixi va biznes tasdiqlash arizasi.

Umumiy holatdagi summalar 7/30/90 kunlik tanlovga mos, grafik oxirgi 7 kunni ko‘rsatadi. Moliyaviy ko‘rsatkichlar test to‘lovlarini hisoblamaydi. CSV va savdo hisoboti barcha davr uchun. Savat miqdori mahsulotlar miqdorining yig‘indisi sifatida hisoblanadi.

## Muhim chegaralar

Bildirishnomalar saytdagi inboxga yoziladi. Sayt ochiq paytda yangilanadi; FCM/APNs, brauzer push yoki Telegram jo‘natilishi ulanmagan. Kuzatilgan do‘kon takliflari tanlangan soatdan keyin inbox so‘ralganda paydo bo‘ladi, fon rejimida aniq daqiqada push yuborilmaydi.

QR skaner kamera va BarcodeDetector qo‘llab-quvvatlanadigan xavfsiz brauzerda ishlaydi; oddiy kod kiritish doim mavjud. QR generatsiyasi uchun serverga yoki tashqi QR xizmatiga topshirish kodi yuborilmaydi.

Sifat murojaati va admin qarori saqlanadi. Ma’qullangan oldindan to‘lov `refund_due` navbatiga tushadi. Admin amalda bajarilgan bank/naqd qaytarishni hujjat bilan qayd etadi. Naqd buyurtmada to‘liq summa qaytariladi va komissiya bekor qilinadi. Onlayn buyurtmada bu qayd oldindan to‘lovga tegishli; joyidagi 90% sotuvchi bilan hal qilinadi. Avtomatik bank o‘tkazmasi bajarilmaydi. Chek — buyurtma tasdig‘i, fiskal chek emas.

UZ/RU asosiy foydalanuvchi oqimlarida mavjud. Eski yordamchi/admin matnlarining ayrimlari ikki tilda yonma-yon, server xatolarining ayrimlari o‘zbek tilida qolgan.

`ISHGA_TUSHIRISH.md` — haqiqiy ishga tushirish chegaralari. `YANGILANISHLAR.md` — o‘zgarishlar va tekshiruvlar. `BIZNES_SINOV.md` — to‘qqizta muammo bo‘yicha amaliy yechim va pilot rejasi.


## Hamkor do‘kon va to‘liq naqd to‘lov

`HAMKORLIK.md` faylida admin → sotuvchi → xaridor oqimi, komissiya, qaytarish va taqdimot ssenariysi bor.

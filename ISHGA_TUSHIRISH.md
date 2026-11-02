# TEJA: ko‘rish va haqiqiy ishga tushirish

## Hozir ko‘rish

`public/teja-preview.html`ni Chrome yoki Edge’da oching. Xarita internet bilan chiqadi. Yuqoridan Xaridor / Sotuvchi / Admin tanlang. Faylni qayta ochganda demo o‘zgarishlari brauzerda saqlanadi. “Yangilash” faqat preview ma’lumotlarini tozalaydi. Preview ichiga haqiqiy parol yoki to‘lov ma’lumoti kiritmang.

## Serverli sayt

`BOSHLASH_WINDOWS.md` bo‘yicha o‘rnating. Barcha 11 ta migratsiya qo‘llanadi. Adminni `npm run admin:setup` bilan yarating. Tayyor namuna admin paroli ZIPga qo‘shilmagan.

Mahalliy loyiha tayyorlandi; bu ZIPni yuklash internetdagi saytni avtomatik yangilamaydi. Ishlab turgan sayt ma’lumotlarini ko‘chirishdan oldin D1 bazasi va R2 fayllari zaxirasini oling. Mavjud sayt identifikatori saqlangan; yangi hosting uchun uning identifikatorini o‘zboshimchalik bilan ishlatmang.

## Ishga tushirish uchun qolgan ulanishlar

| Xizmat | Hozirgi holat | Haqiqiy ishga tushirish |
|---|---|---|
| Oddiy Google xarita | API kalitisiz internet bilan ko‘rinadi | Do‘kon koordinatalarini tekshiring; Google ichidagi tavsiya/reklamalarni yashirish kafolati yo‘q |
| Barcha narxli markerlar | Maps JavaScript API adapteri bor | GOOGLE_MAPS_BROWSER_KEY, API, billing va domen cheklovlari |
| SMS va parol tiklash | Twilio Verify adapteri va sinov rejimi bor | Twilio hisob rekvizitlari, +998 ruxsati, SMS_MODE=live, haqiqiy jo‘natish sinovi |
| Payme/Click | Callbacklar va sinovlar bor | Merchant rekvizitlari, ochiq HTTPS callbacklar, provayder bilan to‘lov/cancel sinovi |
| Pul qaytarish | Murojaat va refund_due navbati ishlaydi | Admin tashqarida amalga oshirilgan qaytarishni hujjat bilan qayd etadi. Sayt bank o‘tkazmasini bajarmaydi |
| Rasm | R2 saqlash, admin tekshiruv navbati bor | R2 binding; avtomatik rasm tahlili kerak bo‘lsa alohida AI kaliti |
| Bildirishnoma | Sayt ichidagi xabarlar | Fon push/SMS jo‘natish bu relizda yo‘q |

Xizmatlar kalitlari admin sozlamalarida ko‘rsatilmaydi. “Sozlangan” — rekvizit mavjud, provayder bilan jonli sinov o‘tdi degani emas. Haqiqiy to‘lovlarni ochishdan oldin PAYMENTS_MODE=live va SMS_MODE=live holatini tekshiring, test rejimini ommaviy savdo uchun ishlatmang.

Preview to‘liq backend o‘rnini bosmaydi. Live bank refundi va tashqi xizmatlar tekshirilmaguncha loyihani “100% ishlab chiqarishga tayyor” deb hisoblamang. Windowsdagi o‘rnatish ushbu Linux muhitida tekshirilmagan.

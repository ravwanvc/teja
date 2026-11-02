# Amalga oshirilgan o‘zgarishlar

- Header: Takliflar, xaridor uchun alohida Xaritadan izlash, rolga mos panel, Buyurtmalarim, Hisobim, til, rang, inbox va savat.
- Leaflet/MapLibre paketlari, importlari va loaderi olib tashlandi. Google Maps JavaScript integratsiyasi va Google yo‘nalish havolalari qoldi. Yandex havolalari olib tashlandi.
- Yagona login/ro‘yxatdan o‘tish, ism-familiya, telefon-parol; SMS bilan bosqichli parol tiklash va eski sessiyalarni bekor qilish.
- Profil rasmini serverga yuklash: JPG/PNG/WebP, 2 MB, autentifikatsiya va fayl turi tekshiruvi.
- Bir do‘kon savati: server narxlari, atomik qoldiq nazorati, yagona oldindan to‘lov va chek, bir martalik qoldiq qaytarish.
- Xaridor va sotuvchining barcha buyurtmalari, qidiruv, holat filtri, chekdagi mahsulotlar ro‘yxati; oldingi 500 ta buyurtma cheklovi olib tashlandi.
- Lokal yaratiladigan QR va qo‘lda kod; mos brauzerlarda kamera skaneri.
- Do‘konni kuzatish va soat tanlash; qoldiq bo‘shasa inbox xabari.
- Olish muddati va sotuvchi yozgan tarkib bo‘yicha filtrlar; allergen haqida ma’lumot bo‘lmasa aniqlashtirish tavsiyasi.
- Kundalik tezkor sotuvchi formasi; narx, qo‘shimcha qoldiq va olish muddati.
- Sifat murojaati, admin qarori va oldindan to‘lovni qaytarish navbati.
- UZ/RU asosiy sahifalar, yorug‘/qorong‘i rejim, ixcham va moslashuvchan dizayn.
- Shu React interfeysidan yig‘iladigan mustaqil HTML preview (xarita uchun internet kerak) (`npm run preview:export`).

## Tekshiruv doirasi

`npm test` — mavjud regression testlari va yangi `customer-experience.mjs`: atomik savat, server narxi, takroriy so‘rov, qoldiqdan ortiq sotmaslik, qoldiqni bir marta qaytarish, do‘kon chegarasi, follow/waitlist, murojaat egasi, SMS tasdig‘idan keyingi reset va token replay himoyasi.

`npm run typecheck`, `npm run check:project`, `npm run build` bajariladi. Brauzerda preview ochilishi, savat → sinov to‘lovi → chek → buyurtma/QR oqimi tekshirildi. Barcha telefonlar va barcha brauzerlarda sinov o‘tkazilgan deb hisoblamang.

Google Mapsning haqiqiy kaliti, real SMS, real merchant to‘lovi, bank refundi va kamera orqali haqiqiy QR skani ushbu muhitda tekshirilmagan. Bu uchun tegishli kalit, ruxsat va qurilma kerak. Sayt ichidagi bildirishnomalar ishlaydi. Ixtiyoriy SMS eslatma transporti qo‘shildi; jonli kalit, xaridor roziligi va Worker jadvali kerak. Fon push ulanmagan. Ayrim eski yordamchi matnlar ikki tilda yoki o‘zbek tilida qolgan.

Eski tarixiy hujjatlar `docs/archive` ichida, joriy holat uchun ushbu fayl va README asosiy manba.


## 2026-11-01 — xarita va boshqaruv panellari

- API kaliti bo‘lmaganda yoki yuklash xatosida Google Maps iframe ko‘rinadi. Xarita haqiqiy Google xizmatidan yuklanadi; mahalliy chizilgan soxta xarita emas.
- Taklif tanlash, manzilni almashtirish, xarita qidiruvi, masofa filtri, yo‘nalish va taklifni ochish.
- Admin va sotuvchi uchun alohida bo‘limli navigatsiya, 7/30/90 kunlik natijalar, 7 kunlik grafik va tezkor ishlar.
- Foydalanuvchilar ro‘yxati: admin ruxsati, 25 tadan sahifalash, ism/do‘kon va rol bo‘yicha qidiruv. Telefon, parol yoki tokenlar qaytmaydi.
- Qoldiq qo‘shish tarixi: sotuvchiga faqat o‘z do‘koni, adminga umumiy. Oxirgi 100 ta amal.
- Admin CSV hisobotiga ruxsat tuzatildi. Sinov savdolari eksportdan chiqarildi. Savatdagi mahsulot miqdori to‘g‘ri hisoblanadi.
- Adminning ishlamaydigan mahsulot qo‘shish tugmasi olib tashlandi; mavjud mahsulotlarni ko‘rish/yashirish va tekshirish amallari saqlandi.
- Admin barcha buyurtmalarni ko‘radi, header soni ham barcha faol buyurtmalarni hisoblaydi.
- Preview admin/sotuvchi amallari kengaytirildi: qoralama, rasm, mahsulot, tasdiqlash, kunlik forma, tarix va sinov CSV. Serverli loyihadan alohida brauzer ma’lumotlari.

`npm test`, `npm run typecheck`, loyiha tekshiruvi va build bajarildi. Yangi `tests/panel-operations.mjs`: mehmon/xaridor/sotuvchi/admin ruxsatlari, boshqa do‘kon tarixini yashirish, bog‘langan SQL parametrlari, CSV, test tushumini chiqarish, Toshkent sanasi, Google koordinatalari.

Brauzerda oddiy Google Mapsning haqiqiy yuklanishi, admin ro‘yxati va sotuvchini tasdiqlash, sotuvchi qoldig‘ining 7→9 o‘zgarishi va +2 tarix yozuvi tekshirildi. Windows va haqiqiy merchant/SMS hali tekshirilmagan. API kalitli ko‘p-marker xarita va kamera QR skaneri uchun tegishli konfiguratsiya/qurilma kerak.


## 2026-11-01 — hamkorlar va naqd hisob

- Admin hamkor biznesni yaratadi, sotuvchi hisobini bog‘laydi, komissiya foizini belgilaydi.
- To‘liq naqd bron, QR/kod bilan topshirish va naqd qabul qilish tasdig‘i.
- Komissiya qarzi, kassa hujjati bilan qisman/to‘liq hisob-kitob va qaytarishdan keyingi avans.
- Sotuvchini vaqtincha cheklash va admin harakatlari tarixi.
- Tayyorlangan vaqt / iste’mol muddati, qayta buyurtma qilish, ixcham filtrlar va 3 asosiy ko‘rsatkich.
- `partner-cash.mjs` testlari: rollar, atomik hisob, takror so‘rovlar, bekor qilish, qaytarish, cheklov, qayta buyurtma, eslatma roziligi va takror yubormaslik.

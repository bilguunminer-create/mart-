# US&K Агуулах — тусдаа апп

Энэ апп нь дэлгүүрийн хэрэглэгчийн сайтаас тусдаа нэр, icon, start URL-тай. Гэхдээ нэг Supabase төв сантай тул бараа, barcode, үлдэгдэл, захиалга бодит цагт ижил байна.

## Android / iPhone дээр суулгах (одоо шууд)

1. Утасны Chrome эсвэл Safari дээр `https://www.uskmart.com/?admin=inventory` нээнэ.
2. **Install app** эсвэл **Home Screen-д нэмэх**-ийг сонгоно.
3. Нэр нь **US&K Агуулах** болж тусдаа icon-оор гарна.
4. Админ и-мэйлээр нэвтэрч, төв PIN оруулна.
5. Камераар barcode/QR уншуулах, бараа шинээр бүртгэх, борлуулалтын хасалт болон түүхийг ашиглана.

## Play Store APK бэлтгэх

Энэ репог тусдаа `usk-inventory-app` хавтас руу хуулна. Дараа нь `capacitor.inventory.config.ts`-ийг `capacitor.config.ts` нэрээр ашиглаад:

```powershell
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio-д **Build → Generate Signed Bundle / APK** сонгоно. App id нь `mn.uskmart.inventory` учраас дэлгүүрийн үндсэн апптай зэрэг суух тусдаа package болно.

Камер ашиглахын тулд Android-ийн `AndroidManifest.xml` дээр дараах permission байгаа эсэхийг шалгана:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Native shell нь `https://www.uskmart.com/?admin=inventory`-оос ажлын дэлгэцээ нээдэг. Тиймээс сайт шинэчлэгдэхэд агуулах аппын логик, бараа, дүрэм серверээс шууд шинэчлэгдэнэ.

Төв серверийн шинэчлэлтэй хамт агуулахын аппын өгөгдөл шууд шинэчлэгдэнэ.

## Захиалга ирэхэд шууд push мэдэгдэл (шинэ)

Хэрэглэгч захиалга хийх бүрд, энэ апп суулгасан бүх админ утсанд шууд push мэдэгдэл очно
(`Firebase Cloud Messaging`, `@capacitor/push-notifications` ашиглана). Апп аль хэдийн
энэ функцийг дуудахаар бэлэн болсон (`src/services/pushNotifications.ts`,
`api/notify-new-order.ts`), гэхдээ ажиллуулахын тулд 3 алхам үлдсэн:

**1. Supabase дээр хүснэгт/функц үүсгэх**

`supabase/admin-push-notifications.sql`-ийг Supabase SQL Editor дээр нэг удаа ажиллуулна
(`product-reviews.sql`-ийг өмнө нь яг адилхан ажиллуулсантай адил алхам).

**2. Firebase-д Android апп бүртгэх**

Төслийн Firebase project (`firebase-applet-config.json` дотор байгаа
`gen-lang-client-0815856082`) руу орж:

1. Project settings → **Add app → Android**. Package name: `mn.uskmart.inventory`
   (`capacitor.inventory.config.ts`-ийн `appId`-тай яг адил байх ёстой).
2. Татаж авсан `google-services.json`-г `npx cap add android`-аас үүссэн
   `android/app/google-services.json` замд байрлуулна.
3. Project settings → **Service accounts** → **Generate new private key**. Татаж авсан
   JSON файлын БҮХ агуулгыг нэг мөрөнд хуулж, Vercel дээр орчны хувьсагч болгон
   `FIREBASE_SERVICE_ACCOUNT_JSON` нэрээр хадгална (`.env.example`-д тайлбар бий).

**3. Vercel дээр орчны хувьсагч нэмэх**

- `FIREBASE_SERVICE_ACCOUNT_JSON` — дээрх алхамаас.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API →
  `service_role` түлхүүр (нууц, зөвхөн серверт ашиглагдана).

Эдгээр 3 алхам дуусмагц, админ и-мэйлээрээ энэ аппаар нэвтрэх бүрд төхөөрөмж нь
автоматаар бүртгэгдэж, шинэ захиалга ирэх бүрд push мэдэгдэл очно.

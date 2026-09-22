# US&K Агуулах — тусдаа апп

Энэ апп нь дэлгүүрийн хэрэглэгчийн сайтаас тусдаа нэр, icon, start URL-тай. Гэхдээ нэг Supabase төв сантай тул бараа, barcode, үлдэгдэл, захиалга бодит цагт ижил байна.

## Android / iPhone дээр суулгах (одоо шууд)

1. Утасны Chrome эсвэл Safari дээр `https://www.uskmart.com/?admin=inventory` нээнэ.
2. **Install app** эсвэл **Home Screen-д нэмэх**-ийг сонгоно.
3. Нэр нь **US&K Агуулах** болж тусдаа icon-оор гарна.
4. Админ и-мэйлээр нэвтэрч, төв PIN оруулна.
5. Камераар barcode/QR уншуулах, бараа шинээр бүртгэх, борлуулалтын хасалт болон түүхийг ашиглана.

## Play Store APK бэлтгэх

`capacitor.inventory.config.ts` нь `android.path: 'android-inventory'` гэж тохируулсан
тул үндсэн `capacitor.config.ts`-той зөрчилдөхгүйгээр адилхан репод ажиллуулж болно.
Зөвхөн `npx cap add`/`sync`/`open` ажиллуулах мөчид л `capacitor.inventory.config.ts`-ийн
агуулгыг түр зуур `capacitor.config.ts`-руу хуулна (дараа нь буцааж сэргээнэ):

```powershell
npm install
npm run build
Copy-Item capacitor.config.ts capacitor.config.main.ts.bak
Copy-Item capacitor.inventory.config.ts capacitor.config.ts -Force
npx cap add android
npx cap sync android
npx cap open android
Copy-Item capacitor.config.main.ts.bak capacitor.config.ts -Force
Remove-Item capacitor.config.main.ts.bak
```

Android Studio-д **Build → Generate Signed Bundle / APK** сонгоно. App id нь `mn.uskmart.inventory` учраас дэлгүүрийн үндсэн апптай зэрэг суух тусдаа package болно.

`android-inventory/` нь `.gitignore`-д орсон тул git рүү commit хийгдэхгүй — дахин хэрэгтэй
болгонд дээрх командаар шинээр үүсгэнэ.

**JDK хувилбар чухал**: Capacitor 7-ийн Android модулиуд Java 21 source/target
шаарддаг тул `assembleDebug`/`Build`-ийг **яг JDK 21**-ээр ажиллуулах ёстой (JDK 17
дутуу, JDK 24/25 бол одоогийн Gradle wrapper-т хэт шинэ — алийг нь ч ашиглавал алдаа
өгнө). Android Studio дотроос build хийвэл **Settings → Build Tools → Gradle → Gradle
JDK**-г 21 болгож сонгоно. Терминалаас `gradlew` шууд ажиллуулах бол:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

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

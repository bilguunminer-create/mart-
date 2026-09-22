# US&K Агуулах — тусдаа апп

Энэ апп нь дэлгүүрийн хэрэглэгчийн сайтаас тусдаа нэр, icon, start URL-тай. Гэхдээ нэг Supabase төв сантай тул бараа, barcode, үлдэгдэл, захиалга бодит цагт ижил байна.

## Android / iPhone дээр суулгах (одоо шууд)

1. Утасны Chrome эсвэл Safari дээр `https://www.uskmart.com/?admin=inventory` нээнэ.
2. **Install app** эсвэл **Home Screen-д нэмэх**-ийг сонгоно.
3. Нэр нь **US&K Агуулах** болж тусдаа icon-оор гарна.
4. Админ и-мэйлээр нэвтэрч, төв PIN оруулна.
5. Нэвтэрсний дараа 2 товчтой цэс гарна:
   - **Агуулах** — камераар barcode/QR уншуулах, бараа шинээр бүртгэх, борлуулалтын хасалт болон түүхийг ашиглана.
   - **Захиалгын мэдэгдэл** — "Шинэ"/"Баталгаажсан" төлөвтэй, анхаарал шаардлагатай захиалгуудыг жагсаана. Захиалгыг баталгаажуулах, хүргэлтэд гаргах, шаардлагатай бол цуцлах боломжтой. Дэлгүүрийн үндсэн админ панелийн бүх бусад цэс (бараа удирдах, лояалти, тохиргоо гэх мэт) энэ аппад **байхгүй** — зөвхөн агуулах ажилтанд хэрэгтэй 2 функц л харагдана.

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

## Захиалга ирэхэд шууд push мэдэгдэл (аппаас гарсан ч утсанд ирнэ)

Хэрэглэгч захиалга хийх бүрд, энэ апп суулгасан бүх админ утсанд шууд push мэдэгдэл очно
(`Firebase Cloud Messaging`). Апп зэрэг ажиллах 2 хэрэгжилттэй:

- **Web Push** (`src/services/pushNotifications.ts`-ийн `initWebPush`) — энгийн
  "Chrome-оос Home Screen-д нэмэх" аргаар суулгасан апп дээр ажиллана. Android Studio,
  APK build **ХЭРЭГГҮЙ**. Android Chrome дээр бүрэн найдвартай; iPhone дээр iOS 16.4+
  бөгөөд Home Screen-д нэмсэн байх шаардлагатай (энгийн Safari tab дээр биш).
- **Native push** (`@capacitor/push-notifications`) — доор тайлбарласан жинхэнэ APK
  build хийсэн тохиолдолд идэвхжинэ.

Аль ч тохиолдолд төхөөрөмж `admin_push_tokens` хүснэгтэд бүртгэгдэж,
`api/notify-new-order.ts` FCM-ээр push илгээнэ. Ажиллуулахын тулд алхамууд:

**1. Supabase дээр хүснэгт/функц үүсгэх**

`supabase/admin-push-notifications.sql`-ийг Supabase SQL Editor дээр нэг удаа ажиллуулна.

**2. Web Push түлхүүр авах (Android Studio хэрэггүй, хамгийн хурдан арга)**

1. [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0815856082/settings/cloudmessaging)
   → Project settings → **Cloud Messaging** таб руу орно.
2. **Web Push certificates** хэсэгт **Generate key pair** дарна (эсвэл байгаа бол
   хуулна). Гарч ирэх урт key string-г хуулж авна.
3. `src/services/pushNotifications.ts`-ийн `VAPID_PUBLIC_KEY = ''` мөрөнд энэ key-г
   бичнэ (нийтийн түлхүүр тул нууц биш, коммит хийж болно).

Энэ 1 алхмаар л Web Push бэлэн болно — Android Studio, google-services.json,
APK build огт шаардлагагүй.

**3. Vercel дээр орчны хувьсагч нэмэх** (Web Push болон Native push хоёуланд хэрэгтэй)

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API →
  `service_role` түлхүүр (нууц, зөвхөн серверт ашиглагдана).
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase console → Project settings →
  **Service accounts** → **Generate new private key**. Татаж авсан JSON файлын БҮХ
  агуулгыг нэг мөрөнд хуулж хадгална (`.env.example`-д тайлбар бий).

Эдгээр алхам дуусмагц, админ и-мэйлээрээ энэ аппаар нэвтэрч мэдэгдэл зөвшөөрөх бүрд
(браузер "Notification зөвшөөрөх үү?" гэж асуана) төхөөрөмж нь автоматаар бүртгэгдэж,
шинэ захиалга ирэх бүрд push мэдэгдэл очно — апп хаалттай байсан ч.

**Native push-ийг Android APK-аар нэмэлтээр хэрэгтэй бол** (Play Store-д тавих гэх мэт),
доорх "Play Store APK бэлтгэх" хэсгийг дагаад, Firebase-д
**Add app → Android** (package name `mn.uskmart.inventory`) бүртгэж
`google-services.json`-г `android/app/`-д байрлуулна. Web Push болон Native push хоёулаа
зэрэг ажиллаж болно (нэг төхөөрөмж platform-аасаа хамааран аль нэгээр бүртгэгдэнэ).

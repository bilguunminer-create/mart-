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

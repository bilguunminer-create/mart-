# US&K Admin native app

Энэ багц нь одоогийн US&K Family Mart админ системийг Android болон iPhone native апп болгох Capacitor эх код юм.

## Шаардлага

- Node.js 22+
- Android Studio — Android APK/AAB бүтээхэд
- macOS + Xcode — iPhone IPA/TestFlight бүтээхэд
- Google Play Console болон Apple Developer бүртгэл — дэлгүүрт нийтлэхэд

## Эхлүүлэх

```bash
npm install
npx cap add android
npx cap add ios
npm run native:android
```

iPhone дээр:

```bash
npm run native:ios
```

`npx cap add android` болон `npx cap add ios` командыг **зөвхөн эхний удаа** ажиллуулна. Дараа нь `native:build` нь веб админ системийг `dist` дотор build хийж Android/iOS төсөл рүү хуулна.

## Аппын үйлдэл

- Админ и-мэйл + PIN хамгаалалт
- Бараа, үнэ, үлдэгдэл засварлах
- Захиалга баталгаажуулах, хүргэлтийн төлөв солих
- Гишүүн, лояалти, данс ба хүргэлтийн тохиргоо
- Камераар барааны зураг авахад бэлэн Capacitor plugin суурь
- Push notification plugin суурь

## Android гаргалт

Android Studio-д `android` хавтсыг нээгээд **Build > Generate Signed Bundle / APK** сонгоно. Play Store-д AAB, шууд суулгах туршилтад APK гаргана.

## iPhone гаргалт

macOS дээр Xcode-оор `ios/App/App.xcworkspace` нээгээд signing тохируулна. Дараа нь TestFlight эсвэл App Store Connect руу Archive хийн илгээнэ.

> Push notification-г бодитоор асаахын тулд Firebase Cloud Messaging болон Apple Push Notification service түлхүүрүүдийг дараагийн шатанд холбох шаардлагатай.

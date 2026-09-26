# US&K Family Mart

React 19 + Vite дэлгүүрийн апп, Supabase-г төв сан болгон ашигладаг. Захиалга, каталог, лояалти, админ бүх зүйл Supabase дээр (`https://rebtikccivjcsxieeyxe.supabase.co`) хадгалагдана.

## Ажиллуулах (локал)

**Шаардлага:** Node.js 20+

```bash
npm install
npm run dev
```

`npm run dev` нь `server.ts`-ийг (Express + Vite middleware) ажиллуулна — `http://localhost:3000`.

## Байгуулалт

- `src/` — React апп (дэлгүүр, админ, агуулах камер, лояалти)
- `api/` — Vercel Serverless Functions (`send-email-otp`, `verify-email-otp`, `health`). **Production дээр зөвхөн эдгээрийг ашиглана**, `server.ts` биш.
- `server.ts` — локал хөгжүүлэлт болон Vercel-ээс өөр Node hosting (жишээ нь VPS)-д зориулсан Express сервер. `npm run build` үүнийг `dist/server.cjs` болгож bundle хийдэг ч Vercel дээр ашиглагдахгүй.
- `public/` — PWA manifest-ууд (`admin.webmanifest`, `inventory.webmanifest`), favicon, зураг

## Орчны хувьсагч (Environment Variables)

| Хувьсагч | Тайлбар | Заавал уу? |
|---|---|---|
| `SMTP_HOST` | SMTP сервер (жишээ: `smtp.gmail.com`) | Имэйл OTP илгээхэд |
| `SMTP_PORT` | Портын дугаар (жишээ: `465`) | Имэйл OTP илгээхэд |
| `SMTP_SECURE` | `true`/`false` | Имэйл OTP илгээхэд |
| `SMTP_USER` | Илгээгч Gmail хаяг | Имэйл OTP илгээхэд |
| `SMTP_PASS` | Gmail App Password (16 тэмдэгт) | Имэйл OTP илгээхэд |
| `SMTP_FROM_NAME` | Илгээгчийн харагдах нэр | Заавал биш (анхдагч: US&K Family Mart) |
| `OTP_SECRET` | OTP token гарын үсгийн HMAC нууц түлхүүр | **Production-д заавал** — тохируулаагүй бол урьдчилан мэдэгдсэн insecure анхдагч утга ашиглагдана |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-ийн server-only secret/service key | Push notification болон chatbot-д **заавал** |
| `GEMINI_API_KEY` | Google AI Studio API key | AI chatbot-д **заавал** |
| `GEMINI_MODEL` | Gemini model ID | Заавал биш (анхдагч: `gemini-3.8-flash`) |
| `SUPABASE_URL` | Supabase project URL | Заавал биш, одоогийн төслийн URL анхдагчаар ашиглагдана |

`SMTP_USER`/`SMTP_PASS` тохируулаагүй бол апп "Preview Mode"-д ажиллаж, имэйл илгээхгүйгээр консол дээр л кодыг харуулна — dev/тестэд тохиромжтой, **production дээр заавал бодит SMTP тохируулах хэрэгтэй**.

Supabase-ийн URL болон publishable key нь `src/services/supabaseAuth.ts` дотор шууд бичигдсэн (энэ бол public/anon түвшний, RLS-ээр хамгаалагдсан key тул орчны хувьсагч болгох шаардлагагүй, мөн `USK-Orlogo-Zarlaga-App`/`USK-Stock-In-Out-App` зэрэг бусад туслах аппуудтай нэг сантай байхын тулд зориудаар ингэж бичигдсэн).

`SUPABASE_SERVICE_ROLE_KEY` болон `GEMINI_API_KEY`-ийг `VITE_` угтвартай болгож болохгүй. Эдгээр нь зөвхөн сервер талд байх нууц утгууд.

## Vercel дээр байршуулах

1. [vercel.com](https://vercel.com) → **Add New Project** → энэ GitHub repo-г сонго.
2. `vercel.json`-г автоматаар олж, Framework: **Vite**, Build: `vite build`, Output: `dist` гэдгийг ашиглана — нэмэлт тохиргоо хэрэггүй.
3. **Environment Variables** хэсэгт дээрх хүснэгтийн `SMTP_*`, `OTP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`-ийг оруул.
4. Deploy дар.

### Supabase талд шалгах зүйлс

- **Authentication → URL Configuration**: `Site URL` болон `Redirect URLs`-д шинэ Vercel домэйн (жишээ: `https://<project>.vercel.app/**`) нэмэгдсэн эсэхийг шалга — эсрэг тохиолдолд имэйл баталгаажуулах/нууц үг сэргээх холбоос ажиллахгүй.
- **`allowed_accounts` хүснэгт**: админ болгох имэйл хаяг(ууд) байгаа эсэхийг шалга.
- Chatbot ашиглахын өмнө `supabase/add-chatbot-support.sql`-г SQL Editor дээр нэг удаа ажиллуул.
- Deploy хийсний дараа `/?admin=true`-аар админ нэвтрэлтийг шалгаж, `/api/health`-ийг нээж `smtpConfigured: true`, `chatbotConfigured: true` гарч байгаа эсэхийг бататга.

## AI chatbot

Хэрэглэгчийн support chat эхлээд Gemini AI туслахаас хариу авна. Гомдол, буцаалт, төлбөрийн маргаан, эсвэл хэрэглэгчийн хүсэлтээр тухайн thread автоматаар админд шилжиж AI зогсоно. Админ чатны дээд хэсгийн **AI асаах/зогсоох** удирдлагаар thread бүрийн горимыг өөрчилж болно.

## Сэтгэгдэл/Үнэлгээний систем

`supabase/product-reviews.sql`-г Supabase SQL Editor дээр нэг удаа ажиллуулснаар барааны сэтгэгдэл/үнэлгээ, админ зөвшөөрөл, нүүр хуудасны сэтгэгдлийн урсгал идэвхжинэ.

## Шалгах

```bash
npm run lint    # tsc --noEmit
npm run build   # vite build (Vercel-ийн ашигладаг production build)
```

## Native апп (Android/iOS)

`NATIVE_APP.md` (админ апп) болон `INVENTORY_APP.md` (агуулах апп)-ийг үз. Эдгээр нь Vercel/веб deployment-той шууд хамааралгүй, тусад нь Capacitor-оор бүтээгддэг.

# US&K Family Mart

React 19 + Vite dэлгүүрийн апп, Supabase-г төв сан болгон ашигладаг. Захиалга, каталог, лояалти, админ бүх зүйл Supabase дээр (`https://rebtikccivjcsxieeyxe.supabase.co`) хадгалагдана — тохиргоо, RLS, RPC функцууд аль хэдийн байрлуулагдсан **амьд, ажиллаж буй** төслийн сан тул шинэ Supabase төсөл үүсгэх шаардлагагүй.

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

`SMTP_USER`/`SMTP_PASS` тохируулаагүй бол апп "Preview Mode"-д ажиллаж, имэйл илгээхгүйгээр консол дээр л кодыг харуулна — dev/тестэд тохиромжтой, **production дээр заавал бодит SMTP тохируулах хэрэгтэй**.

Supabase-ийн URL болон publishable key нь `src/services/supabaseAuth.ts` дотор шууд бичигдсэн (энэ бол public/anon түвшний, RLS-ээр хамгаалагдсан key тул орчны хувьсагч болгох шаардлагагүй, мөн `USK-Orlogo-Zarlaga-App`/`USK-Stock-In-Out-App` зэрэг бусад туслах аппуудтай нэг сантай байхын тулд зориудаар ингэж бичигдсэн).

`GEMINI_API_KEY` — кодонд одоогоор хэрэглэгдэхгүй байна (AI Studio загвараас үлдсэн). Устгаж болно, гэхдээ байсан ч хор хөнөөлгүй.

## GitHub → Vercel → Supabase дараалал

### 1. GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<танай-хэрэглэгч>/<repo-нэр>.git
git push -u origin main
```

### 2. Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub repo-гоо сонго.
2. Vercel `vercel.json`-г автоматаар олж, Framework: **Vite**, Build: `vite build`, Output: `dist` гэдгийг ашиглана — нэмэлт тохиргоо хэрэггүй.
3. **Environment Variables** хэсэгт дээрх хүснэгтийн `SMTP_*` болон `OTP_SECRET`-ийг оруул.
4. Deploy дар.

### 3. Supabase (аль хэдийн байгаа)

Шинээр юу ч үүсгэх шаардлагагүй — зөвхөн дараах зүйлсийг Supabase Dashboard дээр шалга:

- **Authentication → URL Configuration**: `Site URL` болон `Redirect URLs`-д шинэ Vercel домэйн (жишээ: `https://<project>.vercel.app/**`) нэмэгдсэн эсэхийг шалга — эсрэг тохиолдолд имэйл баталгаажуулах/нууц үг сэргээх холбоос ажиллахгүй.
- **`allowed_accounts` хүснэгт**: админ болгох имэйл хаяг(ууд) байгаа эсэхийг шалга.
- Deploy хийсний дараа `/?admin=true`-аар админ нэвтрэлтийг шалгаж, `/api/health`-ийг нээж `smtpConfigured: true` гарч байгаа эсэхийг бататга.

## Шалгах

```bash
npm run lint    # tsc --noEmit
npm run build   # vite build (Vercel-ийн ашигладаг production build)
```

## Native апп (Android/iOS)

`NATIVE_APP.md` (админ апп) болон `INVENTORY_APP.md` (агуулах апп)-ийг үз. Эдгээр нь Vercel/веб deployment-той шууд хамааралгүй, тусад нь Capacitor-оор бүтээгддэг.

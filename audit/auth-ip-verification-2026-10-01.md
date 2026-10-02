# Бүртгэл, нэвтрэлт, IP хандалтын засвар — 2026-10-01

## Хийсэн өөрчлөлт

- Шинэ `/api/site-visit` нь IP-г Vercel edge header эсвэл шууд холбогдсон socket-оос авна. Browser-оос ирсэн IP, user ID, session ID-д итгэхгүй. Supabase Auth `/user` token-ийг шалгасны дараа баталгаажсан хэрэглэгч, token-ийн `session_id`-г service-role-only RPC руу дамжуулна.
- DB нь тухайн session хэрэглэгчдээ харьяалагддаг, устгагдаагүй/дуусаагүй, хэрэглэгч баталгаажсан эсэхийг дахин шалгана. Хуудасны хүсэлт давхцахад нэг үзэлт; нэг сессийн reload/refresh хэд ч болсон нэг нэвтрэлт; өөр сессээр дахин ороход давтан нэвтрэлт болно. Ижил IP-тэй өөр бүртгэлүүд нэгтгэгдэхгүй.
- Админы статистикт өөр IP, баталгаажсан сесс, давтан нэвтрэлт, баталгаагүй үзэлт, сүүлийн 50 хандалт нэмсэн. IP түүх зөвхөн серверээр админы эрхээ шалгуулсан хэрэглэгчид нээлттэй.
- Supabase REST signup-ийн бодит User/token хариуг зөв уншдаг болгосон. Давхар бүртгэл, confirmation холбоос, 6–12 оронтой OTP, дахин илгээх, нууц үг сэргээх, refresh token болон профайлын metadata-г зөв боловсруулна. Callback дахь token-ийг зүгээр задлахын оронд Auth-аар баталгаажуулна.
- `+976 9911-2233` зэрэг утасны дугаарыг DB-ийн 8 оронтой шаардлагад нийцүүлнэ. Түр нууц үг 40 тэмдэгттэй, bcrypt-ийн 72-byte хязгаараас доогуур байна.
- Хадгалсан профайл серверээр баталгаажаагүй байхад нэвтэрсэн гэж харуулахгүй. Token-ийг хугацаанаас нь өмнө шинэчилж, түр сүлжээний алдаанд хадгалсан credentials-ийг устгахгүй. Гарах үед Auth logout дуудаж, өөр хэрэглэгчийн өмнөх дэлгэцийн мэдээллийг цэвэрлэнэ.

## Шалгасан нотолгоо

| Шалгалт | Үр дүн |
|---|---|
| `node --import tsx --test tests/*.test.ts` | 48/48 PASS, үүнээс auth 18, session 9, IP API 5 |
| `tsc --noEmit` | PASS |
| Vite production build | PASS; одоо байгаа том bundle-ийн анхааруулгатай |
| Express server bundle (esbuild) | PASS |
| Supabase migration | `server_verified_ip_and_login_sessions` амжилттай суулгасан |
| `supabase/test-verified-site-visits.sql` | PASS, бүх fixture rollback хийсэн |
| Browser | Дэлгүүр, нэвтрэх, шинэ бүртгэлийн маягт нээгдсэн. `12345` утсанд «Утасны дугаар 8 оронтой байна.» гэж зогсоосон. Энэ үйлдэл auth хүсэлт үүсгээгүй. Шалгалтын console error жагсаалт хоосон. |

Анхны бодит өгөгдөл: 99 үзэлт, 56 browser ID, 1 бүртгэлтэй холбоотой 5 үзэлт. IP/session нотолгоо байгаагүй тул түүхэн давтан нэвтрэлт үнэн эсэхийг буцааж батлах боломжгүй. Хуучин өгөгдөл `server_verified=false` хэвээр.

SQL тестүүд нь guest→login upgrade, retry/reload давхардал, IPv4/IPv6, ижил IP-тэй хоёр хэрэглэгч, session эзэмшил, хүчингүй/дууссан/revoked session, legacy logger-оор trusted row өөрчлөх оролдлого, админ бус хэрэглэгч IP түүх унших оролдлогыг шалгасан.

## Байршуулалтын төлөв ба хязгаар

Supabase өөрчлөлт бодит санд орсон. Frontend болон Vercel API өөрчлөлт энэ workspace-д бэлэн; **нийтэд ажиллаж буй сайтад deploy хийгээгүй**. Vercel connector баг/төслийн эрх илрүүлээгүй (`teams: []`). Шинэ хувилбарыг frontend + API хамт deploy хийж, серверийн `SUPABASE_SERVICE_ROLE_KEY` болон `/api/health` дахь `siteVisitTrackingConfigured`-ийг шалгана. Локал серверт түлхүүр өгөөгүй тул IP бичих endpoint бодит өгөгдөл үүсгээгүй; API баталгаажуулалтыг mock HTTP тест, DB хэсгийг бодит rollback SQL тестээр тус тус баталсан.

Бодит шинэ хэрэглэгч үүсгэх, confirmation имэйл хүрэх, хэрэглэгчийн нууц үг тохируулах эцсийн урсгалыг амьд орчинд туршаагүй. Эдгээрт зөвшөөрсөн тест и-мэйл болон Supabase Auth SMTP/redirect тохиргооны шалгалт шаардлагатай. Vercel-ийн хуучин `SMTP_*` нь Supabase Auth-ийн SMTP-г орлохгүй.

IP нь хүнтэй нэг-нэгээр харгалзахгүй; баталгаажсан session нь хүн бот бишийг нотлохгүй. Self-host reverse proxy ашиглавал direct peer буюу proxy IP бүртгэгдэнэ. In-memory rate limit нь олон instance дамнасан бүрэн хамгаалалт биш. Хуучин logger нь deployment нийцтэй байлгахын тулд зөвхөн баталгаагүй түүх бичих боломжтой хэвээр.

## Supabase advisor шалгалт

Шинэ v3 бичих RPC нь anon/authenticated execute эрхгүй. IP хүснэгтүүд direct SELECT/INSERT эрхгүй бөгөөд RLS-тэй. Advisor-ийн [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) мэдээлэл нь энд санаатай deny-by-default хамгаалалт; access нь хязгаарласан RPC-ээр явна. [Authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) сануулгатай админы RPC-үүд дотроо `private.is_store_admin()` шалгадаг; эрхгүй хэрэглэгчийг SQL тестээр хориглосон. Legacy logger-ийн [public execute](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) нь хуучин frontend-ийн түр нийцтэй ажиллагаа бөгөөд verified нотолгоо бичиж чадахгүй.

Лавлагаа: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [password security](https://supabase.com/docs/guides/auth/password-security), [Vercel request headers](https://vercel.com/docs/headers/request-headers).

# US&K Агуулах — тусдаа сервер ба апп

Энэ хавтас нь үндсэн дэлгүүрээс бие даасан deploy хийх project юм.

## Хийх дараалал

1. Free төлөвлөгөөн дээр одоогийн `usk-mart` Supabase project ашиглана. `warehouse_*` хүснэгт, RLS дүрэм нь дэлгүүрийн бусад мэдээллээс тусгаарлагдсан. Тусдаа paid project нээсэн үед л шинэ project ашиглана.
2. `warehouse_*` schema одоогийн төв санд суусан. Шинэ Supabase project ашиглавал SQL Editor дээр `supabase/schema.sql`-ийн бүх кодыг ажиллуулна.
3. Агуулахын ажилтан Auth → Users хэсгээр бүртгүүлсний дараа тухайн `user_id`-г `warehouse_staff` хүснэгтэд manager/staff эрхээр нэмнэ.
4. Vercel → Add New → Project → энэ GitHub repository-г сонгоно.
5. **Root Directory**: `warehouse-app`.
6. Vercel Environment Variables-д `.env.example`-ийн утгуудыг оруулна.
7. Deploy хийсний дараа үүссэн URL нь зөвхөн агуулах аппын URL байна.

`WAREHOUSE_SHOP_WEBHOOK_URL` нь үндсэн дэлгүүрийн тусгай server endpoint болно. Тэр нь shared secret-ээр шалгаад зөвхөн barcode, үлдэгдэл, нийтлэгдсэн бүтээгдэхүүнийг төв дэлгүүрийн Supabase руу хуулна.

Ингэснээр агуулах аппад дэлгүүрийн админ, хэрэглэгчийн дэлгэц болон нууц түлхүүр байхгүй.

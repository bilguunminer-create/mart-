import { Product, DailyDeal, LoyaltyTier, ComboPack } from '../types';

export const STORE_CONFIG = {
  name: "US&K Family Mart",
  free_delivery_threshold: 100000,
  delivery_fee: 3000,
  phone: "7700-1122",
  work_hours: "09:00 - 20:00 (Өдөр бүр)",
  location: "Даланзадгад хот, Өмнөговь аймаг"
};

export const PRODUCTS: Product[] = [
  {
    id: "FOOD-001",
    name: "Buldak Carbonara Рамен",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 4500,
    weight: "130г",
    badge: "Хамгийн их борлуулалттай",
    badge_color: "bg-rose-500",
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80",
    description: "Samyang брэндийн цөцгийтэй, карбонара амттай халуун ногоотой гоймон. Хамгийн зөөлөн, тааламжтай хувилбар.",
    in_stock: true,
    rating: 4.9,
    day_deal: 1
  },
  {
    id: "FOOD-002",
    name: "Shin Ramyun Black (Дээд зэрэглэлийн)",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 3800,
    weight: "130г",
    badge: "Шилдэг чанар",
    badge_color: "bg-amber-600",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
    description: "Nongshim брэндийн үхрийн ясны өтгөн шөлтэй, уламжлалт халуун ногоотой солонгос рамен.",
    in_stock: true,
    rating: 4.8,
    day_deal: 1
  },
  {
    id: "FOOD-003",
    name: "Yopokki Халуун Бэлэн Топокки",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 7500,
    weight: "140г",
    badge: "Хялбар бэлтгэх",
    badge_color: "bg-orange-500",
    image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80",
    description: "Богино долгионы зууханд 2 минутад бэлэн болох цагаан будааны боов.",
    in_stock: true,
    rating: 4.9,
    day_deal: 1
  },
  {
    id: "FOOD-004",
    name: "Gochujang Халуун Чинжүүний Оо (500г)",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 12500,
    weight: "500г",
    badge: "Гал тогооны үндэс",
    badge_color: "bg-red-700",
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    description: "Солонгос үндэсний хоол, кимбаб, шөл, хуурганд амт нэмэх цэвэр исгэсэн улаан чинжүүний өтгөн оо.",
    in_stock: true,
    rating: 5.0,
    day_deal: 1
  },
  {
    id: "FOOD-005",
    name: "Hormel SPAM Classic Лаазалсан Мах (340г)",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 18500,
    weight: "340г",
    badge: "Америк Оригинал",
    badge_color: "bg-blue-700",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    description: "Алдарт Hormel SPAM Classic. Өглөөний өндөгтэй шарах, шарсан будаа, будаатай ороомогт дээд зэргийн амт оруулна.",
    in_stock: true,
    rating: 4.9,
    day_deal: 1
  },
  {
    id: "FOOD-006",
    name: "Kraft Macaroni & Cheese Original (206г)",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 9500,
    weight: "206г",
    badge: "Америк гэр бүл",
    badge_color: "bg-yellow-600",
    image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80",
    description: "Америк айл бүрийн дуртай өтгөн чеддар бяслагтай түргэн гоймон. 5 минутад бэлэн болно.",
    in_stock: true,
    rating: 4.8,
    day_deal: 1
  },
  {
    id: "FOOD-007",
    name: "Skippy Creamy Самрын Тос (462г)",
    category: "food",
    category_name: "Хоол хүнс & Рамен",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 25000,
    weight: "462г",
    badge: "Уураг тэжээл",
    badge_color: "bg-sky-600",
    image: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80",
    description: "Уураг, амин дэмээр баялаг цэвэр самраар хийсэн торгомсог зөөлөн Америк самрын тос.",
    in_stock: true,
    rating: 5.0,
    day_deal: 1
  },
  {
    id: "DRINK-001",
    name: "Fiji Natural Artesian Байгалийн Ус (1.0л)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "US",
    country: "АНУ импорт",
    flag: "🇺🇸",
    price: 9500,
    weight: "1.0л",
    badge: "Дээд зэрэглэлийн",
    badge_color: "bg-cyan-600",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80",
    description: "Фижи арлын гүний цэнгэг байгалийн рашаан ус. Цэвэр эрдэстэй, зөөлөн амттай дэлхийн шилдэг ус.",
    in_stock: true,
    rating: 5.0,
    day_deal: 5
  },
  {
    id: "DRINK-002",
    name: "Evian Цэвэр Рашаан Ус (500мл)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "US",
    country: "Импорт",
    flag: "🇫🇷",
    price: 6000,
    weight: "500мл",
    badge: "Эрдэст ус",
    badge_color: "bg-pink-500",
    image: "https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=600&q=80",
    description: "Францын Альпийн нурууны байгалийн эрдэст цэвэр ус. Говийн хуурай уур амьсгалд гүн чийгшил өгнө.",
    in_stock: true,
    rating: 4.9,
    day_deal: 5
  },
  {
    id: "DRINK-003",
    name: "Maxim Mocha Gold Кофе (100 ширхэг)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 35000,
    weight: "1200г (100ш)",
    badge: "БНСУ-ын #1 кофе",
    badge_color: "bg-yellow-500",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    description: "БНСУ-ын өрх бүрийн өдөр тутмын хэрэглээ. Зөөлөн цөцгий, кофены төгс харьцаатай бэлэн кофе.",
    in_stock: true,
    rating: 5.0,
    day_deal: 5
  },
  {
    id: "DRINK-004",
    name: "Binggrae Гадилтай Сүүн Ундаа (240мл)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 3500,
    weight: "240мл",
    badge: "Хүүхэд & Залуус",
    badge_color: "bg-amber-400 text-stone-900",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    description: "1974 оноос хойш солонгосчуудын хамгийн дуртай ундаа болсон анхилуун гадил жимсний зөөлөн сүү.",
    in_stock: true,
    rating: 5.0,
    day_deal: 5
  },
  {
    id: "DRINK-005",
    name: "Dr Pepper Original (355мл)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 4000,
    weight: "355мл",
    badge: "Америк оригинал",
    badge_color: "bg-rose-700",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    description: "23 төрлийн жимсний өвөрмөц хослол бүхий Америкийн алдарт хийжүүлсэн ундаа.",
    in_stock: true,
    rating: 4.8,
    day_deal: 5
  },
  {
    id: "DRINK-006",
    name: "Arizona Green Tea & Honey Ginseng (680мл)",
    category: "drinks",
    category_name: "Ус & Ундаа",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 7000,
    weight: "680мл",
    badge: "Том хэмжээтэй",
    badge_color: "bg-teal-600",
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
    description: "Цэвэр ногоон цай, зөгийн бал, хүн орхоодойн хандтай Америкийн нэрийн хуудас болсон мөстэй цай.",
    in_stock: true,
    rating: 4.9,
    day_deal: 5
  },
  {
    id: "VIT-001",
    name: "Kirkland Signature Vitamin C 1000mg (500ш)",
    category: "vitamins",
    category_name: "Витамин & Хүнсний нэмэлт",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 68000,
    weight: "500 шахмал",
    badge: "Гэр бүлийн том савлагаа",
    badge_color: "bg-amber-500",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    description: "АНУ-ын чанарын USP стандартаар баталгаажсан С амин дэм + цитрус биофлавоноид. Дархлааг дээд зэргээр дэмжинэ.",
    in_stock: true,
    rating: 5.0,
    day_deal: 3
  },
  {
    id: "VIT-002",
    name: "Nature Made Multi for Her / Him (90 капсул)",
    category: "vitamins",
    category_name: "Витамин & Хүнсний нэмэлт",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 58000,
    weight: "90 капсул",
    badge: "АНУ-ын эмч нарын сонголт",
    badge_color: "bg-emerald-600",
    image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=600&q=80",
    description: "23 төрлийн амин дэм, эрдэс бодис агуулсан хүний өдөр тутмын эрч хүч, дархлааг тэтгэх цогц мультивитамин.",
    in_stock: true,
    rating: 4.9,
    day_deal: 3
  },
  {
    id: "VIT-003",
    name: "Nature Made Fish Oil Omega-3 1200mg (200 капсул)",
    category: "vitamins",
    category_name: "Витамин & Хүнсний нэмэлт",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 65000,
    weight: "200 капсул",
    badge: "Зүрх судас & Тархи",
    badge_color: "bg-sky-700",
    image: "https://images.unsplash.com/photo-1550572017-ed200f5e6343?auto=format&fit=crop&w=600&q=80",
    description: "Зүрх судасны үйл ажиллагаа, тархины ой санамж, үе мөчний уян хатан байдлыг сайжруулах цэвэршүүлсэн Омега-3 загасны тос.",
    in_stock: true,
    rating: 5.0,
    day_deal: 3
  },
  {
    id: "VIT-004",
    name: "Солонгос 6 Настай Улаан Хүн Орхоодой Stick (30ш)",
    category: "vitamins",
    category_name: "Витамин & Хүнсний нэмэлт",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 85000,
    weight: "30 савх (10мл x 30)",
    badge: "Эрч хүч & Дархлаа",
    badge_color: "bg-red-800",
    image: "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80",
    description: "БНСУ-ын 6 настай улаан хүн орхоодойн цэвэр өтгөрүүлсэн ханд. Ядаргаа тайлах, цусны эргэлтийг сайжруулах шилдэг нэмэлт.",
    in_stock: true,
    rating: 5.0,
    day_deal: 3
  },
  {
    id: "VIT-005",
    name: "Sambucol Black Elderberry Дархлааны Сироп (120мл)",
    category: "vitamins",
    category_name: "Витамин & Хүнсний нэмэлт",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 42000,
    weight: "120мл",
    badge: "Ханиад томуунаас сэргийлэх",
    badge_color: "bg-purple-700",
    image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&w=600&q=80",
    description: "Хар хадны жимсний антиоксидант өндөртэй, ханиад томуунаас урьдчилан сэргийлэх байгалийн гаралтай сироп.",
    in_stock: true,
    rating: 4.9,
    day_deal: 3
  },
  {
    id: "KIDS-001",
    name: "Pampers Pure Protection Хүүхдийн Живх (Хэмжээ: M/L)",
    category: "baby",
    category_name: "Хүүхдийн хэрэгцээнд",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 68000,
    weight: "64 ширхэг",
    badge: "Эмзэг арьсанд",
    badge_color: "bg-teal-600",
    image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80",
    description: "Хөвөн даавуун зөөлөн гадаргуутай, харшил үүсгэхгүй, 12 цаг хуурай байлгах дээд зэрэглэлийн хүүхдийн живх.",
    in_stock: true,
    rating: 4.9,
    day_deal: 4
  },
  {
    id: "KIDS-002",
    name: "L'il Critters Gummy Vites Хүүхдийн Витамин (190ш)",
    category: "baby",
    category_name: "Хүүхдийн хэрэгцээнд",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 52000,
    weight: "190 ширхэг",
    badge: "Америкийн #1 хүүхдийн витамин",
    badge_color: "bg-rose-500",
    image: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=600&q=80",
    description: "Жимсний байгалийн амттай, хиймэл будаггүй хүүхдийн өсөлт хөгжилт, дархлааг дэмжих зажилдаг амин дэм.",
    in_stock: true,
    rating: 5.0,
    day_deal: 4
  },
  {
    id: "KIDS-003",
    name: "Gerber Organic Жимсний Нухаш (120г)",
    category: "baby",
    category_name: "Хүүхдийн хэрэгцээнд",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 8500,
    weight: "120г",
    badge: "Органик хүнс",
    badge_color: "bg-green-600",
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80",
    description: "6 сартайгаас дээш хүүхдэд зориулсан 100% цэвэр алим, банана, гүзээлзгэний органик жимсний нухаш.",
    in_stock: true,
    rating: 4.9,
    day_deal: 4
  },
  {
    id: "KIDS-004",
    name: "Солонгос Pororo Хүүхдийн Сүүн Шүүс (235мл)",
    category: "baby",
    category_name: "Хүүхдийн хэрэгцээнд",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 3500,
    weight: "235мл",
    badge: "Хүүхдийн дуртай",
    badge_color: "bg-indigo-600",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    description: "Кальци, Д витаминаар баяжуулсан хүүхдэд зориулсан солонгос зөөлөн сүүн амтат ундаа.",
    in_stock: true,
    rating: 4.8,
    day_deal: 4
  },
  {
    id: "HOME-001",
    name: "Tide PODS 4in1 Угаалгын Капсул (42ш)",
    category: "household",
    category_name: "Өргөн хэрэглээ & Ахуй",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 62000,
    weight: "42 капсул",
    badge: "АНУ-ын #1 угаалгын шийдэл",
    badge_color: "bg-orange-600",
    image: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
    description: "Угаалгын нунтаг, толбо арилгагч, өнгө сэргээгч, анхилуун үнэртүүлэгч бүгд нэг дор шингэсэн Америкийн Tide капсул.",
    in_stock: true,
    rating: 5.0,
    day_deal: 6
  },
  {
    id: "HOME-002",
    name: "Dawn Ultra Аяга Таваг Угаагч Шингэн (560мл)",
    category: "household",
    category_name: "Өргөн хэрэглээ & Ахуй",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 14500,
    weight: "560мл",
    badge: "Тосыг 100% арилгана",
    badge_color: "bg-blue-600",
    image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80",
    description: "Энгийн угаагчаас 4 дахин илүү хүчтэй тос задлагчтай Америкийн домогт Dawn Ultra шингэн.",
    in_stock: true,
    rating: 5.0,
    day_deal: 6
  },
  {
    id: "HOME-003",
    name: "Солонгос Зөөлөн Ахуйн Нойтон Салфетка (100ш)",
    category: "household",
    category_name: "Өргөн хэрэглээ & Ахуй",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 5500,
    weight: "100ш тагтай",
    badge: "Зузаан даавуун",
    badge_color: "bg-emerald-600",
    image: "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=600&q=80",
    description: "Цэвэршүүлсэн ус, зөөлөн эслэгээр хийсэн, харшил үүсгэхгүй өдөр тутмын ахуйн тагтай нойтон салфетка.",
    in_stock: true,
    rating: 4.9,
    day_deal: 6
  },
  {
    id: "HOME-004",
    name: "Dental Clinic 2080 Солонгос Шүдний Оо (190г)",
    category: "household",
    category_name: "Өргөн хэрэглээ & Ахуй",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 7500,
    weight: "190г",
    badge: "Шүдний паалан хамгаалалт",
    badge_color: "bg-sky-600",
    image: "https://images.unsplash.com/photo-1559591937-e1032b4b455b?auto=format&fit=crop&w=600&q=80",
    description: "Буйл хамгаалах, шүдний өнгөрийг арилгах БНСУ-ын 2080 брэндийн тарваган шийр, гаатай шүдний оо.",
    in_stock: true,
    rating: 4.8,
    day_deal: 6
  },
  {
    id: "SNACK-001",
    name: "Reese's Самрын Тостой Шоколад (2ш)",
    category: "snacks",
    category_name: "Амттан & Чипс",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 5000,
    weight: "42г",
    badge: "Америкийн #1",
    badge_color: "bg-amber-500",
    image: "https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=600&q=80",
    description: "Үйрмэг цөцгийн самрын тосыг сүүн шоколадаар бүрсэн Америкийн сонгодог амттан.",
    in_stock: true,
    rating: 5.0,
    day_deal: 2
  },
  {
    id: "SNACK-002",
    name: "Doritos Nacho Cheese Чипс (150г)",
    category: "snacks",
    category_name: "Амттан & Чипс",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 9500,
    weight: "150г",
    badge: "Шаржигнасан",
    badge_color: "bg-yellow-600",
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80",
    description: "Шаржигнасан эрдэнэ шишийн тортилла чипс, баялаг чеддар бяслагийн хурц амт.",
    in_stock: true,
    rating: 4.8,
    day_deal: 2
  },
  {
    id: "SNACK-003",
    name: "Lotte Choco Pie (12 ширхэг)",
    category: "snacks",
    category_name: "Амттан & Чипс",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 9500,
    weight: "336г",
    badge: "Гэр бүлийн багц",
    badge_color: "bg-indigo-600",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
    description: "Зөөлөн бисквит, маршмеллоу чөмөг болон шоколадан бүрхүүлтэй солонгосын сонгодог амттан.",
    in_stock: true,
    rating: 4.9,
    day_deal: 2
  },
  {
    id: "BEAUTY-001",
    name: "Солонгос Нарны Тос SPF50+ PA++++ (50мл)",
    category: "beauty",
    category_name: "Гоо сайхан & Арьс",
    origin: "KR",
    country: "БНСУ",
    flag: "🇰🇷",
    price: 45000,
    weight: "50мл",
    badge: "Говийн наранд #1",
    badge_color: "bg-blue-600",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
    description: "Өмнөговийн хурц нар, хуурай уур амьсгалаас арьсыг 100% хамгаалах цагаан зураас үлдээдэггүй хөнгөн солонгос нарны тос.",
    in_stock: true,
    rating: 5.0,
    day_deal: 3
  },
  {
    id: "BEAUTY-002",
    name: "Burt's Bees Зөгийн Балтай Уруулын Бальзам",
    category: "beauty",
    category_name: "Гоо сайхан & Арьс",
    origin: "US",
    country: "АНУ",
    flag: "🇺🇸",
    price: 14000,
    weight: "4.25г",
    badge: "100% Байгалийн",
    badge_color: "bg-amber-600",
    image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&w=600&q=80",
    description: "Зөгийн лав, Е витамин, гаатай байгалийн гаралтай Америкийн алдарт уруулын чийгшүүлэгч.",
    in_stock: true,
    rating: 5.0,
    day_deal: 3
  }
];

export const DAILY_DEALS: Record<string, DailyDeal> = {
  "1": {
    day_name: "Даваа гараг",
    title: "🍜 K-Food Рамен Өдөр",
    discount_percent: 15,
    category: "food",
    tagline: "Бүх солонгос рамен, топокки, гочужан 15% ХЯМДРАЛТАЙ!",
    color: "from-rose-600 to-amber-600"
  },
  "2": {
    day_name: "Мягмар гараг",
    title: "🍫 Sweet Tuesday Амттаны Өдөр",
    discount_percent: 15,
    category: "snacks",
    tagline: "Reese's, Hershey's, Doritos болон бүх амттанууд 15% ХЯМДРАЛТАЙ!",
    color: "from-amber-600 to-yellow-600"
  },
  "3": {
    day_name: "Лхагва гараг",
    title: "💊 Эрүүл Мэнд, Витамины Өдөр",
    discount_percent: 10,
    category: "vitamins",
    tagline: "Kirkland, Nature Made, Солонгос хүн орхоодой 10% ХЯМДРАЛТАЙ!",
    color: "from-emerald-600 to-teal-700"
  },
  "4": {
    day_name: "Пүрэв гараг",
    title: "👶 Baby & Kids Хүүхдийн Өдөр",
    discount_percent: 12,
    category: "baby",
    tagline: "Хүүхдийн живх, нухаш, хүүхдийн зажилдаг амин дэмүүд 12% ХЯМДРАЛТАЙ!",
    color: "from-indigo-600 to-pink-600"
  },
  "5": {
    day_name: "Баасан гараг",
    title: "🥤 Beverage Friday Ундаа & Кофены Өдөр",
    discount_percent: 15,
    category: "drinks",
    tagline: "Maxim кофе, Fiji ус, Binggrae сүү, Dr Pepper 15% ХЯМДРАЛТАЙ!",
    color: "from-sky-600 to-blue-700"
  },
  "6": {
    day_name: "Бямба гараг",
    title: "🧼 Household & Family Ахуйн Өдөр",
    discount_percent: 10,
    category: "household",
    tagline: "Tide капсул, Dawn шингэн, нойтон салфетка, ахуйн бараа 10% ХЯМДРАЛТАЙ!",
    color: "from-cyan-600 to-emerald-700"
  },
  "0": {
    day_name: "Ням гараг",
    title: "🎁 Super Combo Багцын Өдөр",
    discount_percent: 20,
    category: "all",
    tagline: "Гэр бүлийн амралтын өдөрт зориулсан бүх багцууд 20% ХЯМДРАЛТАЙ!",
    color: "from-purple-600 to-rose-600"
  }
};

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: "bronze",
    name: "Хүрэл Гишүүн (Bronze)",
    badge: "🥉 Хүрэл",
    color: "from-amber-700 to-amber-900",
    text_color: "text-amber-800",
    bg_color: "bg-amber-100",
    threshold: 500000,
    range: "Нийт 500,000 ₮ худалдан авалтаас",
    discount_pct: 2,
    admin_gift: "Солонгос амттан, шаржигнасан чипсний бэлэг",
    birthday_reward: "5,000 ₮ бэлгийн ваучер",
    benefits: [
      "Нийт 500,000 ₮ худалдан авалт хийж эрх нээгдэнэ",
      "Бүх захиалгад 2% байнгын хөнгөлөлт",
      "Төрсөн өдрөөр 5,000 ₮ ваучер",
      "Шинэ барааны түрүүлж авах мэдэгдэл"
    ]
  },
  {
    id: "silver",
    name: "Мөнгөн Гишүүн (Silver)",
    badge: "🥈 Мөнгөн",
    color: "from-slate-400 to-slate-600",
    text_color: "text-slate-700",
    bg_color: "bg-slate-100",
    threshold: 1000000,
    range: "Нийт 1,000,000 ₮ худалдан авалтаас",
    discount_pct: 3,
    admin_gift: "Maxim кофе хайрцаг эсвэл далайн байцааны багц",
    birthday_reward: "10,000 ₮ бэлгийн ваучер",
    benefits: [
      "Нийт 1,000,000 ₮ худалдан авалт хийж эрх нээгдэнэ",
      "Бүх захиалгад 3% байнгын хөнгөлөлт",
      "Дараалалгүй 1 цагийн тэргүүн ээлжийн хүргэлт",
      "Төрсөн өдрөөр 10,000 ₮ ваучер"
    ]
  },
  {
    id: "gold",
    name: "Алтан Гишүүн (Gold VIP)",
    badge: "🥇 Алтан VIP",
    color: "from-amber-400 via-yellow-500 to-amber-600",
    text_color: "text-amber-900",
    bg_color: "bg-amber-200",
    threshold: 2000000,
    range: "Нийт 2,000,000 ₮ худалдан авалтаас",
    discount_pct: 5,
    admin_gift: "Америк & Солонгос VIP импортын бэлгийн сагс + Бэлэг",
    birthday_reward: "20,000 ₮ ваучер",
    benefits: [
      "Нийт 2,000,000 ₮ худалдан авалт хийж эрх нээгдэнэ",
      "Бүх захиалгад 5% байнгын хөнгөлөлт",
      "Жилийн 365 хоног ҮРГЭЛЖ ҮНЭГҮЙ хүргэлт (дүн харгалзахгүй)",
      "Шинэ барааг урьдчилан авах VIP эрх",
      "Баяр бүрийн тусгай бэлгийн сагс"
    ]
  }
];

export const getStoredLoyaltyTiers = (): LoyaltyTier[] => {
  try {
    const saved = localStorage.getItem('usk_loyalty_tiers_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return LOYALTY_TIERS;
};

export const saveStoredLoyaltyTiers = (tiers: LoyaltyTier[]): void => {
  try {
    localStorage.setItem('usk_loyalty_tiers_config', JSON.stringify(tiers));
    window.dispatchEvent(new CustomEvent('usk_loyalty_config_updated', { detail: { tiers } }));
  } catch (err) {
    console.error('Failed to save loyalty tiers', err);
  }
};

export const resetStoredLoyaltyTiers = (): LoyaltyTier[] => {
  try {
    localStorage.removeItem('usk_loyalty_tiers_config');
    localStorage.removeItem('usk_loyalty_cashback_pct');
    window.dispatchEvent(new CustomEvent('usk_loyalty_config_updated', { detail: { tiers: LOYALTY_TIERS } }));
  } catch (err) {
    console.error('Failed to reset loyalty tiers', err);
  }
  return LOYALTY_TIERS;
};

export const getStoredCashbackPct = (): number => {
  // Standard members do not earn cashback. Only configured VIP tiers receive benefits.
  return 0;
};

export const saveStoredCashbackPct = (pct: number): void => {
  try {
    localStorage.setItem('usk_loyalty_cashback_pct', String(pct));
    window.dispatchEvent(new CustomEvent('usk_loyalty_config_updated', { detail: { cashbackPct: pct } }));
  } catch (err) {
    console.error('Failed to save cashback pct', err);
  }
};

export const calculateLoyaltyTierBySpent = (totalSpent: number, tiers?: LoyaltyTier[]): LoyaltyTier | null => {
  const currentTiers = tiers || getStoredLoyaltyTiers();
  // Sort descending by threshold
  const sorted = [...currentTiers].sort((a, b) => b.threshold - a.threshold);
  for (const tier of sorted) {
    if (totalSpent >= tier.threshold) {
      return tier;
    }
  }
  return null;
};

export const normalizeProductWithStock = (p: Product): Product => {
  let stock = p.stock_quantity;
  if (stock === undefined || stock === null) {
    // Default initial stock: 18 if in_stock, 0 if out of stock
    stock = p.in_stock ? 18 : 0;
  }
  const cleanStock = Math.max(0, Math.floor(stock));
  return {
    ...p,
    stock_quantity: cleanStock,
    in_stock: cleanStock > 0 && p.in_stock !== false
  };
};

export const normalizeProductsList = (list: Product[]): Product[] => {
  return list.map(normalizeProductWithStock);
};

export const COMBOS: ComboPack[] = [
  {
    id: "COMBO-01",
    name: "🔥 K-Food Ramen & Snack Party Багц",
    badge: "Хэмнэлттэй 18%",
    price: 28500,
    orig_price: 35000,
    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80",
    description: "Buldak Carbonara + Shin Ramyun Black + Yopokki Топокки + Далайн байцаа + Binggrae сүү + Pepero",
    items: [
      "FOOD-001",
      "FOOD-002",
      "FOOD-003",
      "DRINK-004",
      "SNACK-003"
    ]
  },
  {
    id: "COMBO-02",
    name: "🇺🇸 American Family Breakfast Өглөөний Багц",
    badge: "Хэмнэлттэй 15%",
    price: 56000,
    orig_price: 66000,
    image: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80",
    description: "Skippy самрын тос (462г) + SPAM Classic лаазалсан мах + Kraft Mac & Cheese + Dr Pepper (2ш)",
    items: [
      "FOOD-007",
      "FOOD-005",
      "FOOD-006",
      "DRINK-005"
    ]
  },
  {
    id: "COMBO-03",
    name: "💊 Эрүүл Мэнд, Дархлааны Багц",
    badge: "Шилдэг багц",
    price: 145000,
    orig_price: 175000,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    description: "Kirkland Vitamin C 1000mg + Солонгос 6 настай Улаан Хүн Орхоодой Stick (30ш) + Sambucol Elderberry",
    items: [
      "VIT-001",
      "VIT-004",
      "VIT-005"
    ]
  }
];

export const CATEGORIES = [
  { id: 'all', name: 'Бүх бараа', icon: 'Sparkles' },
  { id: 'food', name: 'Хоол хүнс & Рамен', icon: 'Utensils' },
  { id: 'drinks', name: 'Ус & Ундаа', icon: 'Coffee' },
  { id: 'vitamins', name: 'Витамин & Нэмэлт', icon: 'Pill' },
  { id: 'baby', name: 'Хүүхдийн хэрэгцээнд', icon: 'Baby' },
  { id: 'household', name: 'Өргөн хэрэглээ & Ахуй', icon: 'Home' },
  { id: 'snacks', name: 'Амттан & Чипс', icon: 'Cookie' },
  { id: 'beauty', name: 'Гоо сайхан & Арьс', icon: 'Sparkle' }
];

export const formatMNT = (amount: number): string => {
  return new Intl.NumberFormat('mn-MN').format(Math.round(amount)) + ' ₮';
};

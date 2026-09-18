export interface Product {
  id: string;
  name: string;
  category: string;
  category_name: string;
  origin: 'KR' | 'US';
  country: string;
  flag: string;
  price: number;
  weight: string;
  badge: string;
  badge_color: string;
  image: string;
  description: string;
  in_stock: boolean;
  stock_quantity?: number;
  rating: number;
  day_deal: number;
}

export interface DailyDeal {
  day_name: string;
  title: string;
  discount_percent: number;
  category: string;
  tagline: string;
  color: string;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  badge: string;
  color: string;
  text_color: string;
  bg_color: string;
  threshold: number;
  range: string;
  discount_pct: number;
  admin_gift: string;
  birthday_reward: string;
  benefits: string[];
}

export interface ComboPack {
  id: string;
  name: string;
  badge: string;
  price: number;
  orig_price: number;
  image: string;
  description: string;
  items: string[];
}

export interface CartItem {
  type: 'product' | 'combo';
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  weight?: string;
  quantity: number;
  stock_quantity?: number;
  appliedDiscountPct?: number;
  origin?: 'KR' | 'US';
  flag?: string;
}

export interface OrderDetails {
  orderId: string;
  customerName: string;
  customerId?: string;
  phone: string;
  email?: string;
  address: string;
  district: string;
  notes: string;
  paymentMethod: 'qpay' | 'bank' | 'cod';
  items: CartItem[];
  subtotal: number;
  dailyDiscount: number;
  loyaltyDiscount: number;
  pointsDiscount?: number;
  deliveryFee: number;
  total: number;
  date: string;
  status?: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
}

export interface UserProfile {
  id: string;
  supabaseUserId?: string;
  accessToken?: string;
  refreshToken?: string;
  name: string;
  email: string;
  phone?: string;
  loginMethod?: 'email';
  address?: string;
  district?: string;
  createdAt: string;
  isVerified: boolean;
  privacyMasking: boolean;
}

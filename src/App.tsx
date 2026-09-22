import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  Truck, 
  Phone, 
  ShieldCheck, 
  Clock, 
  Filter, 
  Check, 
  ChevronRight, 
  Award, 
  Package, 
  HelpCircle,
  MapPin,
  HeartHandshake,
  LogOut,
  Star,
  Mail,
  MessageCircle
} from 'lucide-react';
import { 
  PRODUCTS, 
  COMBOS,
  CATEGORIES, 
  DAILY_DEALS, 
  LOYALTY_TIERS, 
  STORE_CONFIG, 
  formatMNT,
  formatOrderNumber,
  calculateLoyaltyTierBySpent
} from './data/storeData';
import { Product, CartItem, LoyaltyTier, ComboPack, OrderDetails, UserProfile, ProductReview } from './types';
import { Header } from './components/Header';
import { DailyDealBanner } from './components/DailyDealBanner';
import { ProductCard } from './components/ProductCard';
import { CombosSection } from './components/CombosSection';
import { CategoryBentoGrid } from './components/CategoryBentoGrid';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { LoyaltyModal } from './components/LoyaltyModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ProductFormModal } from './components/ProductFormModal';
import { UserProfileModal } from './components/UserProfileModal';
import { GoogleFormsModal } from './components/GoogleFormsModal';
import { StoreHeroBanner } from './components/StoreHeroBanner';
import { BeeEmblemLogo } from './components/BeeEmblemLogo';
// Lazy-loaded: pulls in the barcode-scanning library, which only the warehouse
// app ever needs -- regular storefront visitors should never pay for that weight.
const InventoryCameraModal = React.lazy(() =>
  import('./components/InventoryCameraModal').then((m) => ({ default: m.InventoryCameraModal }))
);
const InventoryOrdersModal = React.lazy(() =>
  import('./components/InventoryOrdersModal').then((m) => ({ default: m.InventoryOrdersModal }))
);
const SupportChatModal = React.lazy(() =>
  import('./components/SupportChatModal').then((m) => ({ default: m.SupportChatModal }))
);
import { getStoreCustomerProfiles, getStoreOrders, getStoreSettings, saveStoreOrder, saveStoreProducts, saveStoreSettings, hasStoreAdminAccess, refreshSession, reportStoreOrderPayment, updateStoreOrderStatus, confirmStoreOrderPayment, verifyAdminPin, changeAdminPin, expireUnpaidOrdersAsAdmin, getAllReviewsForAdmin, moderateProductReview, deleteProductReview, getProductReviews, adminListLoyaltyWallets, adminGrantLoyaltyPoints, AdminLoyaltyWallet, uploadCategoryImage, uploadBrandingImage, logSiteVisit, getSiteVisitStats, SiteVisitStats, adminListSupportThreads, adminGetSupportThread, adminSendSupportMessage, SupportThreadSummary } from './services/supabaseAuth';
import { initAdminPushNotifications } from './services/pushNotifications';

export default function App() {
  // The installed PWA and native Capacitor shells open only the secured admin flow.
  const appMode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('admin')
    : null;
  // /?admin=inventory is the separate warehouse application entry point.
  const isInventoryApp = appMode === 'inventory';
  const isAdminApp = typeof window !== 'undefined' && (
    appMode === '1'
    || isInventoryApp
    || window.location.protocol === 'capacitor:'
    || (window.location.hostname === 'localhost' && !window.location.port)
  );

  // Today's day of week (0 = Sunday, 1 = Monday, ...)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return new Date().getDay();
  });

  // The public catalog is loaded from Supabase. PRODUCTS is only the first render fallback.
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [comboPacks, setComboPacks] = useState<ComboPack[]>(COMBOS);
  const [featuredProductId, setFeaturedProductId] = useState('');
  const [categoryImages, setCategoryImages] = useState<Record<string, string[]>>({});
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null);
  const [storeBannerUrl, setStoreBannerUrl] = useState<string | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<{ deliveryFee: number; freeDeliveryThreshold: number; bankName: string; accountNumber: string; iban: string; accountHolder: string; storePhone: string; storeEmail: string; facebookUrl: string; messengerUrl: string; googleMapsUrl: string; storeAddress: string; unpaidCancellationMinutes: number }>({
    deliveryFee: 3000, freeDeliveryThreshold: STORE_CONFIG.free_delivery_threshold, bankName: '', accountNumber: '', iban: '', accountHolder: '', storePhone: STORE_CONFIG.phone, storeEmail: '', facebookUrl: '', messengerUrl: '', googleMapsUrl: '', storeAddress: STORE_CONFIG.location, unpaidCancellationMinutes: 60,
  });
  useEffect(() => {
    getStoreSettings().then((settings) => {
      const savedCombos = settings.data.combo_packs;
      if (Array.isArray(savedCombos)) setComboPacks(savedCombos as ComboPack[]);
      const savedCategoryImages = settings.data.category_images;
      if (savedCategoryImages && typeof savedCategoryImages === 'object') {
        setCategoryImages(savedCategoryImages as Record<string, string[]>);
      }
      setStoreLogoUrl(settings.data.store_logo_url ? String(settings.data.store_logo_url) : null);
      setStoreBannerUrl(settings.data.store_banner_url ? String(settings.data.store_banner_url) : null);
      const savedTiers = settings.data.loyalty_tiers_config;
      if (Array.isArray(savedTiers) && savedTiers.length > 0) {
        // Older saved configs predate the per-tier cashback_pct field; backfill
        // from the matching default tier (by id) so the admin editor and the
        // points-earning calculation never see an undefined percentage.
        const withCashback = (savedTiers as LoyaltyTier[]).map((tier) => ({
          ...tier,
          cashback_pct: tier.cashback_pct ?? (LOYALTY_TIERS.find((d) => d.id === tier.id)?.cashback_pct ?? 0)
        }));
        setActiveLoyaltyTiers(withCashback);
      }
      if (settings.data.loyalty_cashback_pct !== undefined) setLoyaltyCashbackPct(Number(settings.data.loyalty_cashback_pct));
      const savedOverrides = settings.data.loyalty_tier_overrides;
      if (savedOverrides && typeof savedOverrides === 'object') setLoyaltyTierOverrides(savedOverrides as Record<string, string>);
      const remoteProducts = settings.data.products;
      if (!Array.isArray(remoteProducts)) return;
      setProducts(remoteProducts.map((product: any) => {
        const stock = Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0));
        return {
          ...product,
          stock_quantity: stock,
          in_stock: Boolean(product.in_stock) && stock > 0,
        };
      }) as Product[]);
      setFeaturedProductId(String(settings.data.featured_product_id ?? ''));
      const bank = settings.data.bank_accounts as Record<string, unknown> | undefined;
      setCheckoutSettings({
        deliveryFee: Number(settings.data.delivery_fee ?? 3000),
        freeDeliveryThreshold: Number(settings.data.free_delivery_threshold ?? STORE_CONFIG.free_delivery_threshold),
        bankName: String(bank?.bankName ?? ''),
        accountNumber: String(bank?.accountNumber ?? ''),
        iban: String(bank?.iban ?? ''),
        accountHolder: String(bank?.accountHolder ?? ''),
        storePhone: String(settings.data.store_phone ?? checkoutSettings.storePhone),
        storeEmail: String(settings.data.store_email ?? ''),
        facebookUrl: String(settings.data.facebook_url ?? ''),
        messengerUrl: String(settings.data.messenger_url ?? ''),
        googleMapsUrl: String(settings.data.google_maps_url ?? ''),
        storeAddress: String(settings.data.store_address ?? STORE_CONFIG.location),
        unpaidCancellationMinutes: Number(settings.data.unpaid_cancellation_minutes ?? 60),
      });
    }).catch(() => { /* The built-in catalog remains visible if the network is unavailable. */ });
  }, []);

  // Orders are loaded from Supabase after a user signs in.
  const [orders, setOrders] = useState<OrderDetails[]>([]);

  const [memberProfiles, setMemberProfiles] = useState<Array<{ user_id: string; name: string; phone: string; address: string; created_at?: string }>>([]);
  const [loyaltyWallets, setLoyaltyWallets] = useState<AdminLoyaltyWallet[]>([]);

  // Admin states
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('usk_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [directEditProduct, setDirectEditProduct] = useState<Product | null>(null);
  const [isDirectFormOpen, setIsDirectFormOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isInventoryOrdersOpen, setIsInventoryOrdersOpen] = useState(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);

  // Cart state persisted in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('gobi_mart_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Current logged in user profile (phone authentication)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('usk_current_user');
      if (!saved) return null;
      const profile = JSON.parse(saved) as UserProfile;
      // Old browser-only profiles cannot access the central database. Force them
      // through the real email/password login once, then retain only the Supabase session.
      return profile.accessToken && profile.supabaseUserId ? profile : null;
    } catch {
      return null;
    }
  });

  // Renew an expired access token automatically. Older sessions without a refresh
  // token will be asked to sign in again instead of showing a raw JWT error.
  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.refreshToken) {
      setCurrentUser(null);
      localStorage.removeItem('usk_current_user');
      return;
    }
    let active = true;
    refreshSession(currentUser.refreshToken)
      .then((session) => {
        if (!active) return;
        const next = { ...currentUser, accessToken: session.access_token, refreshToken: session.refresh_token || currentUser.refreshToken };
        setCurrentUser(next);
        localStorage.setItem('usk_current_user', JSON.stringify(next));
      })
      .catch(() => {
        if (!active) return;
        setCurrentUser(null);
        localStorage.removeItem('usk_current_user');
      });
    return () => { active = false; };
  }, []);

  // Load the account's central data after every real Supabase sign-in.
  // Store administrators already listed in allowed_accounts receive the full list through RLS.
  useEffect(() => {
    if (!currentUser?.accessToken) return;
    let active = true;
    // Tracks order IDs seen on the previous poll so a genuinely new order can be announced to the admin.
    let knownOrderIds: Set<string> | null = null;

    const loadCentralData = async () => {
      const token = currentUser.accessToken as string;
      if (isAdminAuthenticated) {
        // Best-effort periodic sweep: cancel orders nobody paid for within the configured window
        // and release their reserved stock, even if that customer never reopens their profile.
        try { await expireUnpaidOrdersAsAdmin(token); } catch { /* not fatal to the rest of the refresh */ }
      }

      const [ordersResult, profilesResult, walletsResult] = await Promise.allSettled([
        getStoreOrders(token),
        getStoreCustomerProfiles(token),
        isAdminAuthenticated ? adminListLoyaltyWallets(token) : Promise.resolve([]),
      ]);
      if (!active) return;
      const failures: string[] = [];

      if (ordersResult.status === 'fulfilled') {
        const mapped = ordersResult.value.map((order) => ({
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: order.customer_id,
          customerName: order.customer_name,
          phone: order.phone,
          email: order.email,
          address: order.address,
          district: 'Өмнөговь, Даланзадгад',
          notes: order.note || '',
          paymentMethod: 'bank' as const,
          paymentStatus: order.payment_status,
          paymentReportedAt: order.payment_reported_at || undefined,
          items: (order.items || []).map((item) => ({
            type: 'product' as const,
            id: item.productId,
            name: item.title,
            price: item.price,
            originalPrice: item.price,
            image: '',
            quantity: item.quantity,
          })),
          subtotal: order.subtotal,
          dailyDiscount: order.daily_discount,
          loyaltyDiscount: order.vip_discount,
          deliveryFee: order.delivery_fee,
          total: order.total,
          date: new Date(order.created_at).toLocaleString('mn-MN'),
          status: order.status === 'Дууссан' ? 'delivered' as const : order.status === 'Цуцалсан' ? 'cancelled' as const : order.status === 'Хүргэлтэд' ? 'shipping' as const : order.status === 'Баталгаажсан' ? 'confirmed' as const : 'new' as const,
        }));

        if (isAdminAuthenticated) {
          const currentIds = new Set(mapped.map((o) => o.orderId));
          if (knownOrderIds) {
            const arrived = mapped.filter((o) => !knownOrderIds!.has(o.orderId));
            if (arrived.length > 0) {
              const names = arrived.slice(0, 3).map((o) => formatOrderNumber(o)).join(', ');
              showToast(`🔔 Шинэ захиалга ирлээ: ${names}${arrived.length > 3 ? ` (+${arrived.length - 3})` : ''}`);
            }
          }
          knownOrderIds = currentIds;
        }

        setOrders(mapped);
      } else {
        console.error('[Admin] Захиалгын түүх татахад алдаа гарлаа:', ordersResult.reason);
        failures.push('захиалгын түүх');
      }

      if (profilesResult.status === 'fulfilled') {
        setMemberProfiles(profilesResult.value);
      } else {
        console.error('[Admin] Гишүүдийн мэдээлэл татахад алдаа гарлаа:', profilesResult.reason);
        setMemberProfiles([]);
        failures.push('хэрэглэгчийн мэдээлэл');
      }

      if (walletsResult.status === 'fulfilled') {
        setLoyaltyWallets(walletsResult.value as AdminLoyaltyWallet[]);
      } else if (isAdminAuthenticated) {
        console.error('[Admin] Лояалти оноо татахад алдаа гарлаа:', walletsResult.reason);
        failures.push('лояалти оноо');
      }

      if (failures.length > 0) {
        showToast(`Төв сангаас ${failures.join(', ')} татаж чадсангүй. Дахин нэвтэрч үзнэ үү.`);
      }
    };

    void loadCentralData();
    // Admins get a live-ish refresh so new orders and payment sweeps do not wait for a manual reload.
    const timer = window.setInterval(() => { if (!document.hidden) void loadCentralData(); }, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentUser?.accessToken, isAdminAuthenticated]);

  // Review moderation queue (admin-only).
  const [adminReviews, setAdminReviews] = useState<ProductReview[]>([]);
  const refreshAdminReviews = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    try {
      setAdminReviews(await getAllReviewsForAdmin(currentUser.accessToken));
    } catch {
      // The moderation tab simply stays empty; the admin can retry by reopening it.
    }
  }, [currentUser?.accessToken]);
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    void refreshAdminReviews();
  }, [isAdminAuthenticated, refreshAdminReviews]);

  // Site visit stats (admin Статистик tab only -- fetched on demand, not polled).
  const [siteVisitStats, setSiteVisitStats] = useState<SiteVisitStats | null>(null);
  const refreshSiteVisitStats = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    try {
      setSiteVisitStats(await getSiteVisitStats(currentUser.accessToken));
    } catch {
      // The stats card simply stays empty; the admin can retry by reopening the tab.
    }
  }, [currentUser?.accessToken]);

  // Support chat inbox (admin Чат tab only -- fetched on demand, not polled;
  // AdminSupportChat itself polls the open thread while it's open).
  const [supportThreads, setSupportThreads] = useState<SupportThreadSummary[]>([]);
  const refreshSupportThreads = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    try {
      setSupportThreads(await adminListSupportThreads(currentUser.accessToken));
    } catch {
      // The inbox simply stays empty; the admin can retry by reopening the tab.
    }
  }, [currentUser?.accessToken]);
  const handleOpenSupportThread = useCallback(async (customerId: string) => {
    if (!currentUser?.accessToken) return [];
    return adminGetSupportThread(currentUser.accessToken, customerId);
  }, [currentUser?.accessToken]);
  const handleSendSupportReply = useCallback(async (customerId: string, message: string) => {
    if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
    await adminSendSupportMessage(currentUser.accessToken, customerId, message);
  }, [currentUser?.accessToken]);

  // Logs one anonymous pageview for the public storefront only -- never for the
  // admin dashboard or the warehouse app, so "хэдэн хүн үзсэн" reflects real
  // customer traffic, not staff logging in to manage the site.
  useEffect(() => {
    if (isAdminApp) return;
    try {
      let visitorId = localStorage.getItem('usk_visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('usk_visitor_id', visitorId);
      }
      logSiteVisit(visitorId, window.location.pathname).catch(() => {
        // Pageview logging is best-effort; never surface this to the visitor.
      });
    } catch {
      // Pageview logging is best-effort; never block the storefront on it.
    }
    // Runs once per page load by design -- not tied to route changes within the SPA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log out a customer after 30 minutes without activity.
  useEffect(() => {
    if (!currentUser) return;
    let timer: ReturnType<typeof setTimeout>;
    const logout = () => {
      setCurrentUser(null);
      localStorage.removeItem('usk_current_user');
      showToast('30 минут идэвхгүй байсан тул таны бүртгэлээс гарлаа.');
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, 30 * 60 * 1000);
    };
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((event) => window.removeEventListener(event, reset));
    };
  }, [currentUser?.id]);

  // Current user's normalized phone number and email
  const userPhoneClean = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-8) : '';
  const userEmailClean = currentUser?.email ? currentUser.email.trim().toLowerCase() : '';

  // Filter orders strictly for current logged-in user's phone number or email
  const userOrders = useMemo(() => {
    if (!userPhoneClean && !userEmailClean) return [];
    return orders.filter((o) => {
      const matchPhone = userPhoneClean && o.phone && o.phone.replace(/\D/g, '').slice(-8) === userPhoneClean;
      const matchEmail = userEmailClean && o.email && o.email.trim().toLowerCase() === userEmailClean;
      return matchPhone || matchEmail;
    });
  }, [orders, userPhoneClean, userEmailClean]);

  // Total spent accumulated strictly on this logged-in account
  const userTotalSpent = useMemo(() => {
    return userOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [userOrders]);

  const ordersCount = useMemo(() => {
    return orders.filter((o) => o.status !== 'cancelled').length;
  }, [orders]);

  // Loyalty tiers, cashback rate, and manual per-customer tier overrides --
  // all admin-configurable and stored centrally in store_settings.data, not
  // localStorage, so every visitor and every admin session sees the same rules.
  const [activeLoyaltyTiers, setActiveLoyaltyTiers] = useState<LoyaltyTier[]>(LOYALTY_TIERS);
  const [loyaltyCashbackPct, setLoyaltyCashbackPct] = useState<number>(1);
  const [loyaltyTierOverrides, setLoyaltyTierOverrides] = useState<Record<string, string>>({});

  // Active Loyalty Tier: Strictly visible & active only after logging in with email or phone
  const activeLoyalty = useMemo<LoyaltyTier | null>(() => {
    if (!currentUser || (!userPhoneClean && !userEmailClean)) {
      return null;
    }
    const forcedTierId = loyaltyTierOverrides[currentUser.id];
    if (forcedTierId) {
      const forced = activeLoyaltyTiers.find((t) => t.id === forcedTierId);
      if (forced) return forced;
    }

    return calculateLoyaltyTierBySpent(userTotalSpent, activeLoyaltyTiers);
  }, [currentUser, userPhoneClean, userEmailClean, userTotalSpent, activeLoyaltyTiers, loyaltyTierOverrides]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOrigin, setSelectedOrigin] = useState<'ALL' | 'KR' | 'US'>('ALL');
  const [showDealsOnly, setShowDealsOnly] = useState(false);

  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFormsOpen, setIsFormsOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const overlayHistoryRef = useRef(false);

  // Browser back closes the current site panel first, instead of leaving the store.
  useEffect(() => {
    const overlayOpen = isCartOpen || isCheckoutOpen || isLoyaltyOpen || isProfileOpen
      || isFormsOpen || Boolean(detailProduct) || isAdminOpen || isAdminLoginOpen || isDirectFormOpen || isInventoryOpen;
    const closeOverlay = () => {
      setIsCartOpen(false);
      setIsCheckoutOpen(false);
      setIsLoyaltyOpen(false);
      setIsProfileOpen(false);
      setIsFormsOpen(false);
      setDetailProduct(null);
      setIsAdminOpen(false);
      setIsAdminLoginOpen(false);
      setIsDirectFormOpen(false);
      setIsInventoryOpen(false);
      overlayHistoryRef.current = false;
    };
    const onPopState = () => {
      if (overlayHistoryRef.current) closeOverlay();
    };
    if (overlayOpen && !overlayHistoryRef.current) {
      window.history.pushState({ uskOverlay: true }, '', window.location.href);
      overlayHistoryRef.current = true;
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isCartOpen, isCheckoutOpen, isLoyaltyOpen, isProfileOpen, isFormsOpen, detailProduct, isAdminOpen, isAdminLoginOpen, isDirectFormOpen, isInventoryOpen]);

  // Supabase recovery links contain a short-lived session in the URL hash.
  // Open the password form immediately so the member can finish the reset.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const type = hash.get('type') || query.get('type');
    const token = hash.get('access_token') || query.get('access_token');
    if ((type === 'recovery' && token) || sessionStorage.getItem('usk_recovery_token')) setIsProfileOpen(true);
  }, []);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Site-wide approved testimonials for the footer ticker. Public, no login required.
  const [testimonials, setTestimonials] = useState<ProductReview[]>([]);
  useEffect(() => {
    getProductReviews(undefined, 20).then(setTestimonials).catch(() => setTestimonials([]));
  }, []);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gobi_mart_cart', JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Admin Action Handlers
  const persistProducts = (nextProducts: Product[]) => {
    if (!currentUser?.accessToken) {
      showToast('Каталогийн өөрчлөлтийг хадгалахын тулд админ и-мэйлээрээ нэвтэрнэ үү.');
      return;
    }
    void saveStoreProducts(currentUser.accessToken, nextProducts as unknown as Record<string, unknown>[])
      .catch(() => showToast('Supabase каталогийн өөрчлөлтийг хадгалах боломжгүй байна.'));
  };

  const handleOpenAdmin = async () => {
    if (!currentUser?.accessToken) {
      setIsProfileOpen(true);
      showToast('Төв гишүүн, захиалгын мэдээлэл харахын тулд эхлээд админ и-мэйлээрээ нэвтэрнэ үү.');
      return;
    }

    try {
      if (!await hasStoreAdminAccess(currentUser.accessToken)) {
        setIsProfileOpen(true);
        showToast('Энэ бүртгэл админ эрхгүй байна. Зөвшөөрөгдсөн админ и-мэйл хаягаараа нэвтэрнэ үү.');
        return;
      }
    } catch {
      showToast('Админ эрхийг төв сангаас шалгах боломжгүй байна.');
      return;
    }

    if (isAdminAuthenticated) setIsAdminOpen(true);
    else setIsAdminLoginOpen(true);
  };

  const handleAdminLogin = async (pin: string) => {
    if (!currentUser?.accessToken || !await hasStoreAdminAccess(currentUser.accessToken)) {
      throw new Error('Админ и-мэйлээр дахин нэвтэрч байж төв сангийн гишүүдийг харна.');
    }
    if (!await verifyAdminPin(currentUser.accessToken, pin.trim())) {
      throw new Error('Админ ПИН код буруу байна.');
    }
    setIsAdminAuthenticated(true);
    try {
      sessionStorage.setItem('usk_admin_auth', 'true');
    } catch {
      // ignore
    }
    setIsAdminLoginOpen(false);
    setIsAdminOpen(true);
    showToast('Админ системд амжилттай нэвтэрлээ!');
  };

  const handleChangePin = async (currentPin: string, newPin: string) => {
    if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр дахин нэвтэрнэ үү.');
    await changeAdminPin(currentUser.accessToken, currentPin.trim(), newPin.trim());
    showToast('Админ ПИН код төв санд шинэчлэгдлээ. Шинэ browser болон апп дээр шууд үйлчилнэ.');
  };

  // The dedicated installed admin app opens the secured management screen directly.
  useEffect(() => {
    if (!isAdminApp) return;
    void handleOpenAdmin();
  }, [isAdminApp, currentUser?.accessToken, isAdminAuthenticated]);

  // The separate warehouse app never lands in the public admin dashboard.
  // After central admin authentication it opens the camera inventory workflow directly.
  useEffect(() => {
    if (!isInventoryApp || !isAdminAuthenticated || !currentUser?.accessToken) return;
    setIsAdminOpen(false);
    setIsInventoryOpen(true);
  }, [isInventoryApp, isAdminAuthenticated, currentUser?.accessToken]);

  // Registers this device for new-order push notifications once signed in as admin.
  // A no-op in a regular browser tab; only does anything inside an installed native app.
  useEffect(() => {
    if (!isAdminAuthenticated || !currentUser?.accessToken) return;
    void initAdminPushNotifications(currentUser.accessToken);
  }, [isAdminAuthenticated, currentUser?.accessToken]);

  const handleSaveProduct = (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      const next = exists ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev];
      persistProducts(next);
      return next;
    });
    showToast(`"${product.name}" Supabase-д хадгалагдлаа!`);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => { const next = prev.filter((p) => p.id !== productId); persistProducts(next); return next; });
    showToast('Бараа Supabase каталогоос хасагдлаа');
  };

  const handleToggleStock = (productId: string) => {
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== productId) return p;
        const nextStock = !p.in_stock;
        const nextQuantity = nextStock ? (p.stock_quantity && p.stock_quantity > 0 ? p.stock_quantity : 15) : 0;
        showToast(nextStock ? `"${p.name}" бэлэн төлөвт шилжлээ (${nextQuantity}ш)` : `"${p.name}" дууссан төлөвт шилжлээ (0ш)`);
        return { ...p, in_stock: nextStock, stock_quantity: nextQuantity };
      });
      persistProducts(next);
      return next;
    });
  };

  const handleQuickUpdateStock = (productId: string, amount: number, isAbsolute = false) => {
    setProducts((prev) => {
      const nextProducts = prev.map((p) => {
        if (p.id !== productId) return p;
        const current = p.stock_quantity !== undefined ? p.stock_quantity : (p.in_stock ? 15 : 0);
        const nextStock = isAbsolute ? Math.max(0, amount) : Math.max(0, current + amount);
        showToast(`"${p.name}" үлдэгдэл шинэчлэгдлээ: ${nextStock} ш`);
        return { ...p, stock_quantity: nextStock, in_stock: nextStock > 0 };
      });
      persistProducts(nextProducts);
      return nextProducts;
    });
  };

  const handleUpdateOrderStatus = (orderId: string, status: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled') => {
    if (!currentUser?.accessToken) {
      showToast('Төлөв хадгалахын тулд админ и-мэйлээр нэвтэрнэ үү.');
      return;
    }

    const databaseStatus = status === 'delivered' ? 'Дууссан' : status === 'cancelled' ? 'Цуцалсан' : status === 'shipping' ? 'Хүргэлтэд' : status === 'confirmed' ? 'Баталгаажсан' : 'Шинэ';

    void updateStoreOrderStatus(currentUser.accessToken, orderId, databaseStatus)
      .then(() => {
        setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)));
        const target = orders.find((o) => o.orderId === orderId);
        showToast(`Захиалга ${target ? formatOrderNumber(target) : `#${orderId}`} төлөв төв санд хадгалагдлаа`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        const friendly = message.includes('permission') || message.includes('policy') || message.includes('FORBIDDEN')
          ? 'Энэ эрхээр захиалгын төлөв шинэчлэх боломжгүй байна. Админ и-мэйлээр дахин нэвтэрнэ үү.'
          : message.includes('FINAL_STATUS')
          ? 'Энэ захиалга аль хэдийн Дууссан эсвэл Цуцлагдсан төлөвтэй тул цаашид өөрчлөх боломжгүй.'
          : message.includes('INVALID_TRANSITION')
          ? 'Захиалгыг Шинэ төлөвт буцаах боломжгүй.'
          : message.includes('NOT_FOUND')
          ? 'Энэ захиалга төв санд олдсонгүй.'
          : message.includes('INVALID_STATUS')
          ? 'Тодорхойгүй төлөв рүү шилжүүлэх гэж оролдлоо.'
          : 'Төв санд төлөв шинэчлэх боломжгүй байна. Дахин оролдоно уу.';
        showToast(friendly + (message ? ` (${message})` : ''));
      });
  };

  const handleResetProducts = () => {
    setProducts(PRODUCTS);
    try {
      localStorage.removeItem('usk_products_list');
    } catch {
      // ignore
    }
    showToast('Каталог анхдагч 24 бараагаар сэргээгдлээ');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
    try {
      sessionStorage.removeItem('usk_admin_auth');
    } catch {
      // ignore
    }
    showToast('Админ горимоос гарлаа. Хэрэглэгчийн цэвэр харагдац идэвхжлээ.');
  };

  // Discreet Admin Trigger 1: Check URL ?admin=true or ?admin=login
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true' || params.get('admin') === 'login') {
        if (!isAdminAuthenticated) {
          setIsAdminLoginOpen(true);
        }
      }
    } catch {
      // ignore
    }
  }, [isAdminAuthenticated]);

  // Discreet Admin Trigger 2: Keyboard shortcut Ctrl + Shift + A (or Cmd + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminAuthenticated) {
          setIsAdminOpen((prev) => !prev);
        } else {
          setIsAdminLoginOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminAuthenticated]);

  // Daily deal calculation helper
  const currentDeal = DAILY_DEALS[selectedDay.toString()] || DAILY_DEALS["1"];

  const getProductPricing = (product: Product) => {
    const isDealActive = product.day_deal !== -1 && (
      product.day_deal !== undefined
        ? product.day_deal === selectedDay
        : currentDeal?.category === product.category
    );
    const discountPercent = isDealActive ? (currentDeal?.discount_percent || 10) : 0;
    const finalPrice = discountPercent > 0
      ? Math.round(product.price * (1 - discountPercent / 100))
      : product.price;

    // A standing sale (admin-set old_price) only shows when today's rotating
    // daily deal is not already discounting this product.
    const hasStandingSale = !isDealActive && product.old_price != null && product.old_price > product.price;

    return {
      price: finalPrice,
      originalPrice: isDealActive ? product.price : (hasStandingSale ? product.old_price! : product.price),
      discountPercent,
      isDealActive: isDealActive || hasStandingSale
    };
  };

  // Add Product to Cart
  const handleAddToCart = (product: Product, quantity = 1) => {
    const pricing = getProductPricing(product);
    const available = Math.max(0, Number(product.stock_quantity ?? (product.in_stock ? 1 : 0)));
    const alreadyInCart = cart.find((item) => item.id === product.id)?.quantity ?? 0;
    if (!product.in_stock || available < 1) {
      showToast(`"${product.name}" одоогоор дууссан байна.`);
      return;
    }
    if (alreadyInCart + quantity > available) {
      showToast(`"${product.name}"-ын үлдэгдэл ${available} ш байна. Нэг барааны тоо үлдэгдлээс их байж болохгүй.`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const next = [...prevCart];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          price: pricing.price,
          originalPrice: pricing.originalPrice
        };
        return next;
      }
      return [...prevCart, {
        type: 'product',
        id: product.id,
        name: product.name,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        image: product.image,
        weight: product.weight,
        quantity,
        appliedDiscountPct: pricing.discountPercent,
        origin: product.origin,
        flag: product.flag
      }];
    });
    showToast(`"${product.name}" сагсанд нэмэгдлээ!`);
  };

  // Add Combo to Cart
  const handleAddComboToCart = (combo: ComboPack) => {
    // Check if Sunday (day 0) combo day adds extra 20% discount
    const isSundayComboDeal = selectedDay === 0;
    const finalPrice = isSundayComboDeal
      ? Math.round(combo.price * 0.8)
      : combo.price;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((i) => i.id === combo.id);
      if (existingIndex > -1) {
        const next = [...prevCart];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
          price: finalPrice
        };
        return next;
      } else {
        const newItem: CartItem = {
          type: 'combo',
          id: combo.id,
          name: combo.name,
          price: finalPrice,
          originalPrice: combo.orig_price,
          image: combo.image,
          quantity: 1,
          appliedDiscountPct: Math.round(((combo.orig_price - finalPrice) / combo.orig_price) * 100)
        };
        return [...prevCart, newItem];
      }
    });

    showToast(`"${combo.name}" багц сагсанд нэмэгдлээ!`);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    const product = products.find((item) => item.id === id);
    const available = product ? Math.max(0, Number(product.stock_quantity ?? (product.in_stock ? 1 : 0))) : quantity;
    if (product && quantity > available) {
      showToast(`"${product.name}"-ын үлдэгдэл ${available} ш байна.`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Before opening checkout, reload the central catalog. This prevents a customer
  // from proceeding with a quantity that another order has already consumed.
  const handleProceedToCheckout = async () => {
    try {
      const settings = await getStoreSettings();
      const remoteProducts = Array.isArray(settings.data.products) ? settings.data.products as Array<Record<string, unknown>> : [];
      const remoteCombos = Array.isArray(settings.data.combo_packs) ? settings.data.combo_packs as Array<Record<string, unknown>> : [];
      const shortages = cart.map((item) => {
        if (item.type === 'combo') {
          // Combo packs are not stock-tracked: they stay available as long as they still exist and are published.
          const combo = remoteCombos.find((entry) => String(entry.id) === item.id);
          const available = combo && combo.published !== false ? item.quantity : 0;
          return { item, available };
        }
        const product = remoteProducts.find((entry) => String(entry.id) === item.id);
        if (!product) return { item, available: 0 };
        const available = Boolean(product.in_stock) && Boolean(product.published ?? true)
          ? Math.max(0, Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0)))
          : 0;
        return { item, available };
      }).filter(({ item, available }) => item.quantity > available);

      if (shortages.length > 0) {
        setCart((previous) => previous.flatMap((item) => {
          const mismatch = shortages.find(({ item: affected }) => affected.id === item.id);
          return mismatch ? (mismatch.available > 0 ? [{ ...item, quantity: mismatch.available, stock_quantity: mismatch.available }] : []) : [item];
        }));
        const names = shortages.slice(0, 2).map(({ item, available }) => `${item.name} (${available}ш)`).join(', ');
        showToast(`Үлдэгдэл шинэчлэгдсэн тул сагсыг заслаа: ${names}. Тоогоо шалгаад дахин үргэлжлүүлнэ үү.`);
        return;
      }

      setProducts(remoteProducts.map((product: any) => {
        const stock = Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0));
        return {
          ...product,
          stock_quantity: stock,
          in_stock: Boolean(product.in_stock) && stock > 0,
        };
      }) as Product[]);
    } catch {
      // Checkout is still protected by the central transaction if the catalog cannot be refreshed.
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Cart Calculations
  const cartCount = cart.reduce((cnt, item) => cnt + item.quantity, 0);
  const cartOriginalSubtotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const cartCurrentPriceTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const dailyDiscountTotal = Math.max(0, cartOriginalSubtotal - cartCurrentPriceTotal);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Draft and sold-out products are only visible to the administrator.
      // Products with no stock_quantity recorded yet fall back to the in_stock flag, same as everywhere else in the app.
      if (product.published === false || product.in_stock === false || Number(product.stock_quantity ?? (product.in_stock ? 1 : 0)) <= 0) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = product.name.toLowerCase().includes(q);
        const matchDesc = product.description.toLowerCase().includes(q);
        const matchCategory = product.category_name.toLowerCase().includes(q);
        const matchCountry = product.country.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCategory && !matchCountry) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }

      // Origin filter
      if (selectedOrigin !== 'ALL' && product.origin !== selectedOrigin) {
        return false;
      }

      // Deal only filter
      if (showDealsOnly) {
        const isDeal = product.day_deal !== -1 && (
          product.day_deal !== undefined
            ? product.day_deal === selectedDay
            : currentDeal.category === product.category
        );
        const hasStandingSale = !isDeal && product.old_price != null && product.old_price > product.price;
        if (!isDeal && !hasStandingSale) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedOrigin, showDealsOnly, selectedDay, currentDeal]);

  // The installed warehouse app is single-purpose: it must never show the public
  // storefront underneath. Before admin login it shows only a focused login screen;
  // once authenticated it shows only the inventory camera tool.
  if (isInventoryApp) {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
          <BeeEmblemLogo size={64} className="w-16 h-16" logoUrl={storeLogoUrl} />
          <div>
            <h1 className="text-xl font-black text-white">US&K Агуулах</h1>
            <p className="text-sm text-stone-400 mt-1">Зөвхөн ажилтны админ бүртгэлээр нэвтэрнэ</p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdmin}
            className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-6 py-3 rounded-xl cursor-pointer transition-colors"
          >
            Админ бүртгэлээр нэвтрэх
          </button>

          <UserProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            user={currentUser}
            onSaveUser={(updatedUser) => {
              setCurrentUser(updatedUser);
              localStorage.setItem('usk_current_user', JSON.stringify(updatedUser));
              showToast('Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.');
            }}
            onLogoutUser={() => {
              setCurrentUser(null);
              localStorage.removeItem('usk_current_user');
              showToast('Бүртгэлээс гарлаа.');
            }}
            orders={orders}
            activeLoyalty={activeLoyalty}
            totalSpent={userTotalSpent}
          />
          <AdminLoginModal
            isOpen={isAdminLoginOpen}
            onClose={() => setIsAdminLoginOpen(false)}
            onLogin={handleAdminLogin}
          />

          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-stone-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-2.5 text-xs font-semibold">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      );
    }

    const pendingOrderCount = orders.filter((o) => !o.status || o.status === 'new' || o.status === 'confirmed').length;

    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        {!isInventoryOpen && !isInventoryOrdersOpen && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setIsInventoryOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-6 py-4 rounded-2xl cursor-pointer transition-colors"
            >
              Агуулах
            </button>
            <button
              type="button"
              onClick={() => setIsInventoryOrdersOpen(true)}
              className="relative bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-4 rounded-2xl cursor-pointer transition-colors border border-white/10"
            >
              Захиалгын мэдэгдэл
              {pendingOrderCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-black text-white">
                  {pendingOrderCount}
                </span>
              )}
            </button>
          </div>
        )}
        {currentUser?.accessToken && (
          <React.Suspense fallback={null}>
            <InventoryCameraModal
              isOpen={isInventoryOpen}
              onClose={() => setIsInventoryOpen(false)}
              accessToken={currentUser.accessToken}
              onChanged={() => {
                setIsInventoryOpen(false);
                window.location.reload();
              }}
            />
            <InventoryOrdersModal
              isOpen={isInventoryOrdersOpen}
              onClose={() => setIsInventoryOrdersOpen(false)}
              orders={orders}
              onUpdateStatus={handleUpdateOrderStatus}
            />
          </React.Suspense>
        )}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-stone-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-2.5 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Admin Mode Floating Top Strip */}
      {isAdminAuthenticated && (
        <div className="bg-stone-900 text-white px-4 py-2 text-xs border-b border-rose-500/30">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-rose-400">Админ горим нээлттэй:</span>
              <span className="text-stone-300 hidden sm:inline">Барааны зураг оруулах, үнэ болон бэлэн эсэхийг удирдах боломжтой</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="admin-quick-add-strip-btn"
                onClick={() => {
                  setDirectEditProduct(null);
                  setIsDirectFormOpen(true);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
              >
                <span>+ Шинэ бараа оруулах</span>
              </button>
              <button
                id="inventory-camera-strip-btn"
                onClick={() => setIsInventoryOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 text-stone-950 px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
              >
                <span>📷 Агуулах</span>
              </button>
              <button
                id="admin-open-panel-strip-btn"
                onClick={() => setIsAdminOpen(true)}
                className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1 rounded-lg font-bold text-[11px] border border-stone-700 cursor-pointer transition-all"
              >
                Админ удирдлага
              </button>
              <button
                id="admin-open-forms-strip-btn"
                onClick={() => setIsFormsOpen(true)}
                className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-1 rounded-lg font-semibold text-[11px] border border-stone-700 cursor-pointer transition-all flex items-center gap-1.5"
                title="Google Forms судалгаа & хүсэлтүүд"
              >
                <svg className="w-3 h-3" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="#7248B9"/>
                  <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                  <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Forms</span>
              </button>
              <button
                id="admin-logout-strip-btn"
                onClick={handleAdminLogout}
                className="bg-stone-800 hover:bg-rose-900/60 text-stone-300 hover:text-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-stone-700 cursor-pointer transition-all flex items-center gap-1"
                title="Админаас гарах"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Гарах</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Header */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartCount={cartCount}
        cartTotal={cartCurrentPriceTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        user={currentUser}
        onOpenForms={() => setIsFormsOpen(true)}
        onOpenAdmin={handleOpenAdmin}
        onLogoutAdmin={handleAdminLogout}
        isAdminActive={isAdminAuthenticated}
        activeLoyalty={activeLoyalty}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        dailyDealTitle={currentDeal.title}
        storePhone={checkoutSettings.storePhone}
        freeDeliveryThreshold={checkoutSettings.freeDeliveryThreshold}
        logoUrl={storeLogoUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-8">
        {/* Official Store Banner: US&K Family Mart Даланзадгад хот */}
        <StoreHeroBanner
          logoUrl={storeLogoUrl}
          bannerUrl={storeBannerUrl}
          onExploreClick={() => {
            const el = document.getElementById('catalog-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          products={products}
          storePhone={checkoutSettings.storePhone}
        />

        {/* Daily Deal Hero Banner */}
        <DailyDealBanner
          selectedDay={selectedDay}
          onFilterDealCategory={(cat) => {
            if (cat === 'all') {
              setSelectedCategory('all');
            } else {
              setSelectedCategory(cat);
            }
            setShowDealsOnly(true);
          }}
          products={products.filter(product => product.published !== false && product.in_stock && Number(product.stock_quantity ?? (product.in_stock ? 1 : 0)) > 0)}
          freeDeliveryThreshold={checkoutSettings.freeDeliveryThreshold}
        />

        {/* Category Discovery Bento Grid */}
        <CategoryBentoGrid
          products={products}
          categoryImages={categoryImages}
          onSelectCategory={(categoryId) => {
            setSelectedCategory(categoryId);
            const el = document.getElementById('catalog-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Curated Combos Section */}
        {featuredProductId && products.find(p=>p.id===featuredProductId) && <button type="button" onClick={()=>setDetailProduct(products.find(p=>p.id===featuredProductId)!)} className="mb-6 flex w-full items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"><img src={products.find(p=>p.id===featuredProductId)!.image} className="h-16 w-16 rounded-xl object-cover" /><div><p className="text-xs font-bold text-amber-700">ӨНӨӨДРИЙН ОНЦЛОХ БАРАА</p><p className="font-black text-stone-900">{products.find(p=>p.id===featuredProductId)!.name}</p><p className="font-bold text-rose-600">{formatMNT(products.find(p=>p.id===featuredProductId)!.price)}</p></div></button>}
        <CombosSection
          combos={comboPacks.filter((combo) => combo.published !== false)}
          products={products}
          onAddComboToCart={handleAddComboToCart}
          onOpenProductDetail={(productId) => {
            const found = products.find((p) => p.id === productId);
            if (found) setDetailProduct(found);
          }}
        />

        {/* Customer Services Duo: User Security & Registration / Google Forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Profile & Security Banner */}
          <div className="bg-gradient-to-br from-emerald-950 via-stone-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xs border border-emerald-800/40 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 p-2.5 text-emerald-400">
                <ShieldCheck className="w-full h-full" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white">Хэрэглэгчийн Бүртгэл & Нууцлал</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    ✉️ Үнэгүй И-мэйл OTP
                  </span>
                </div>
                <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
                  Таны худалдан авалтын түүх и-мэйл хаяг дээр автоматаар бүртгэгдэж явна. Нууц үг шаардахгүй нэг удаагийн үнэгүй кодоор хялбар нэвтэрч, өөрийн түүх болон лояалти хөнгөлөлтөө удирдан хараарай.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-emerald-900/50">
              <span className="text-[11px] text-emerald-300/80">
                {currentUser ? `Нэвтэрсэн: ${currentUser.name}` : 'Энгийн & Аюулгүй систем'}
              </span>
              <button
                id="open-profile-banner-btn"
                onClick={() => setIsProfileOpen(true)}
                className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>{currentUser ? 'Миний Профайл' : 'Бүртгүүлэх / Нэвтрэх'}</span>
                <span className="text-emerald-600 font-black">→</span>
              </button>
            </div>
          </div>

          {/* Google Forms Banner */}
          <div className="bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xs border border-purple-800/40 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 p-2.5">
                <svg className="w-full h-full" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="#9065D0"/>
                  <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                  <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white">Захиалгат Бараа & Санал Асуулга</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-400/30 text-purple-200 border border-purple-400/20">
                    Google Forms
                  </span>
                </div>
                <p className="text-xs text-purple-200/90 mt-1 leading-relaxed">
                  АНУ & Солонгосоос захиалах барааны тусгай хүсэлт илгээх болон үйлчилгээний санал асуулга бөглөж оноо аваарай.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-purple-900/50">
              <span className="text-[11px] text-purple-300/80">Оноо & тусгай хүсэлт</span>
              <button
                id="open-forms-banner-btn"
                onClick={() => setIsFormsOpen(true)}
                className="px-4 py-2 bg-white hover:bg-purple-50 text-purple-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>Судалгаа & Захиалга</span>
                <span className="text-purple-600 font-black">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Catalog Control Section: Categories, Country Origin Tabs, Filters */}
        <section id="catalog-section" className="space-y-4 pt-4 border-t border-stone-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
                <span>Барааны Каталог</span>
                <span className="text-xs font-bold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full">
                  {filteredProducts.length} бараа
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                АНУ болон БНСУ-ын үйлдвэрийн албан ёсны лацтай бүтээгдэхүүнүүд
              </p>
            </div>

            {/* Origin & Deal Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Origin filter tabs */}
              <div className="bg-stone-200/80 p-1 rounded-xl flex items-center text-xs font-bold text-stone-700">
                <button
                  onClick={() => setSelectedOrigin('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedOrigin === 'ALL'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'hover:text-stone-900'
                  }`}
                >
                  Бүгд
                </button>
                <button
                  onClick={() => setSelectedOrigin('KR')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    selectedOrigin === 'KR'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'hover:text-stone-900'
                  }`}
                >
                  <span>🇰🇷</span>
                  <span>БНСУ</span>
                </button>
                <button
                  onClick={() => setSelectedOrigin('US')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    selectedOrigin === 'US'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'hover:text-stone-900'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>АНУ</span>
                </button>
              </div>

              {/* Show Deals Only toggle */}
              <button
                onClick={() => setShowDealsOnly(!showDealsOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showDealsOnly
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Зөвхөн хямдралтай</span>
              </button>
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-stone-900 text-white shadow-md shadow-stone-900/15 scale-[1.02]'
                      : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Filter Pills (if any) */}
          {(selectedCategory !== 'all' || selectedOrigin !== 'ALL' || showDealsOnly || searchQuery) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-stone-500 font-medium">Шүүлтүүрүүд:</span>

              {searchQuery && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  Хайлт: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-900 font-bold ml-1">×</button>
                </span>
              )}

              {selectedCategory !== 'all' && (
                <span className="bg-stone-200 text-stone-800 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  Ангилал: {CATEGORIES.find((c) => c.id === selectedCategory)?.name}
                  <button onClick={() => setSelectedCategory('all')} className="hover:text-black font-bold ml-1">×</button>
                </span>
              )}

              {selectedOrigin !== 'ALL' && (
                <span className="bg-stone-200 text-stone-800 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  Улс: {selectedOrigin === 'KR' ? '🇰🇷 БНСУ' : '🇺🇸 АНУ'}
                  <button onClick={() => setSelectedOrigin('ALL')} className="hover:text-black font-bold ml-1">×</button>
                </span>
              )}

              {showDealsOnly && (
                <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  Зөвхөн хямдрал
                  <button onClick={() => setShowDealsOnly(false)} className="hover:text-black font-bold ml-1">×</button>
                </span>
              )}

              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedOrigin('ALL');
                  setShowDealsOnly(false);
                  setSearchQuery('');
                }}
                className="text-stone-500 hover:text-stone-800 underline font-semibold ml-2 cursor-pointer"
              >
                Бүгдийг арилгах
              </button>
            </div>
          )}

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                <Filter className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-stone-800">
                Таны хайлтад тохирох бараа олдсонгүй
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Хайлтын үгээ өөрчлөх эсвэл шүүлтүүрийг цэвэрлэж үзнэ үү.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedOrigin('ALL');
                  setShowDealsOnly(false);
                }}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Бүх барааг харах
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredProducts.map((product) => {
                const cartItem = cart.find((i) => i.id === product.id);
                const quantity = cartItem ? cartItem.quantity : 0;

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selectedDay={selectedDay}
                    cartQuantity={quantity}
                    onAddToCart={handleAddToCart}
                    onUpdateQuantity={handleUpdateQuantity}
                    onOpenDetail={(prod) => setDetailProduct(prod)}
                    isAdmin={isAdminAuthenticated}
                    onEditProduct={(prod) => {
                      setDirectEditProduct(prod);
                      setIsDirectFormOpen(true);
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Benefits & Trust Strip */}
        <section className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Түргэн Шуурхай Хүргэлт</h4>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  {formatMNT(checkoutSettings.freeDeliveryThreshold)}-өөс дээш үнэгүй. Өмнөговь болон УБ хотод 1-2 цагт.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">100% Баталгаат Импорт</h4>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  АНУ, БНСУ-аас агаарын тээврээр шууд ирсэн шинэ үйлдвэрлэлийн бараа.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Лояалти Хөнгөлөлт</h4>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  Хүрэл, Мөнгөн, Алтан гишүүдэд 2-5% байнгын хөнгөлөлт, бэлэг, ваучер.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Хэрэглэгчийн Тусламж</h4>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  Өдөр бүр 09:00 - 22:00 цагийн хооронд лавлах утас: <strong>{checkoutSettings.storePhone}</strong>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-10 mt-12 border-t border-stone-800">
        {/* Approved customer testimonials, scrolling continuously */}
        {testimonials.length > 0 && (
          <div className="border-b border-stone-800 bg-stone-950/60 py-3 overflow-hidden mb-8">
            <div className="flex w-max gap-8 usk-testimonial-track">
              {[...testimonials, ...testimonials].map((review, idx) => (
                <div key={`${review.id}-${idx}`} className="flex items-center gap-2 shrink-0 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-700'}`} />
                    ))}
                  </div>
                  <span className="font-bold text-white">{review.customer_name}:</span>
                  <span className="text-stone-400 max-w-xs truncate">"{review.comment}"</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-stone-800">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <BeeEmblemLogo size={38} className="w-9 h-9 shrink-0" logoUrl={storeLogoUrl} />
                <div>
                  <span className="font-black text-white text-lg tracking-tight block">US&K Family Mart</span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Даланзадгад хот • 09:00 - 20:00</span>
                </div>
              </div>
              <p className="text-stone-400 text-xs max-w-md">
                АНУ болон БНСУ-ын дээд зэрэглэлийн чанартай хүнс, рамен, хүүхдийн живх, өргөн хэрэглээ, амин дэмийг шуурхай хүргэх цахим дэлгүүр.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-400 pt-1">
                {checkoutSettings.googleMapsUrl ? (
                  <a
                    href={checkoutSettings.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{checkoutSettings.storeAddress}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{checkoutSettings.storeAddress}</span>
                  </span>
                )}
                <a href={`tel:${checkoutSettings.storePhone}`} className="flex items-center gap-1.5 text-amber-400 font-bold hover:underline">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{checkoutSettings.storePhone}</span>
                </a>
                {checkoutSettings.storeEmail && (
                  <a href={`mailto:${checkoutSettings.storeEmail}`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{checkoutSettings.storeEmail}</span>
                  </a>
                )}
                {checkoutSettings.facebookUrl && (
                  <a
                    href={checkoutSettings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.13 2 11.24c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.86.38 2.92.38 5.52 0 10-4.13 10-9.24S17.52 2 12 2Zm1.01 12.44-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82Z"/>
                    </svg>
                    <span>Facebook</span>
                  </a>
                )}
                {checkoutSettings.messengerUrl && (
                  <a
                    href={checkoutSettings.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-sky-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.45 2 2 6.19 2 11.39c0 2.96 1.44 5.6 3.7 7.33V22l3.38-1.86c.9.25 1.86.39 2.92.39 5.55 0 10-4.19 10-9.39S17.55 2 12 2Zm1.19 12.64-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82Z"/>
                    </svg>
                    <span>Messenger</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-300">
              <button
                onClick={() => setIsLoyaltyOpen(true)}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Гишүүнчлэлийн хөтөлбөр
              </button>
              <span>•</span>
              <button
                id="footer-user-profile-btn"
                onClick={() => setIsProfileOpen(true)}
                className="hover:text-emerald-400 text-stone-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Бүртгэл & Нууцлал</span>
              </button>
              <span>•</span>
              <button
                id="footer-google-forms-btn"
                onClick={() => setIsFormsOpen(true)}
                className="hover:text-purple-400 text-stone-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="#7248B9"/>
                  <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                  <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Google Forms судалгаа</span>
              </button>
              {isAdminAuthenticated && (
                <>
                  <span>•</span>
                  <button
                    id="footer-admin-panel-btn"
                    onClick={handleOpenAdmin}
                    className="hover:text-rose-400 text-rose-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Админ Удирдлага</span>
                  </button>
                  <span>•</span>
                  <button
                    id="footer-admin-logout-btn"
                    onClick={handleAdminLogout}
                    className="hover:text-rose-400 text-stone-400 transition-colors cursor-pointer"
                    title="Админаас гарах"
                  >
                    Гарах
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-stone-500 text-[11px]">
            <div className="flex items-center gap-2">
              <p>© 2026 US&K Family Mart. Бүх эрх хуулиар хамгаалагдсан.</p>
              {/* Discreet staff login trigger for shop manager */}
              <button
                id="footer-discreet-admin-btn"
                onClick={handleOpenAdmin}
                className="text-stone-700 hover:text-stone-400 transition-colors p-1 rounded-sm cursor-pointer"
                title="Ажилтны нэвтрэх (Ctrl+Shift+A)"
              >
                <ShieldCheck className="w-3 h-3" />
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-stone-400">
              <span>🇲🇳 Улаанбаатар & Өмнөговь бүс нутгийн шуурхай хүргэлт</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Drawers & Modals */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleProceedToCheckout}
        activeLoyalty={activeLoyalty}
        dailyDiscountTotal={dailyDiscountTotal}
        freeDeliveryThreshold={checkoutSettings.freeDeliveryThreshold}
        deliveryFee={checkoutSettings.deliveryFee}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        orders={orders}
        currentUser={currentUser}
        activeLoyalty={activeLoyalty}
        loyaltyTiers={activeLoyaltyTiers}
        dailyDiscountTotal={dailyDiscountTotal}
        paymentSettings={checkoutSettings}
        onReportPayment={async (orderId) => {
          if (!currentUser?.accessToken) throw new Error('Бүртгэлдээ нэвтэрнэ үү.');
          await reportStoreOrderPayment(currentUser.accessToken, orderId);
          setOrders((prev) => prev.map((item) => item.orderId === orderId
            ? { ...item, paymentStatus: 'Төлбөр шалгуулж байна', paymentReportedAt: new Date().toISOString() }
            : item));
          showToast('Төлбөрийн мэдэгдэл админд илгээгдлээ.');
        }}
        onOrderSuccess={async (order) => {
          if (!currentUser?.accessToken) {
            throw new Error('Захиалгаа хадгалахын тулд эхлээд бүртгэлдээ нэвтэрнэ үү.');
          }
          const savedOrder = await saveStoreOrder(currentUser.accessToken, {
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            notes: order.notes,
            deliveryMode: order.district === 'Өмнөговь, Даланзадгад' ? 'delivery' : 'vehicle',
            total: order.total,
            pointsToUse: order.pointsDiscount || 0,
            items: order.items.map((item) => ({ id: item.id, quantity: item.quantity })),
          });
          const newOrder: OrderDetails = {
            ...order,
            orderId: String((savedOrder as { id?: string }).id || order.orderId),
            orderNumber: (savedOrder as { order_number?: number }).order_number,
            status: 'new',
            paymentStatus: String((savedOrder as { payment_status?: string }).payment_status || 'Төлөөгүй')
          };
          // Best-effort push notification to any admin devices with the app installed.
          // Never blocks or fails the order if notifications are not set up or unreachable.
          fetch('/api/notify-new-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: newOrder.orderId,
              customerName: newOrder.customerName,
              total: newOrder.total,
              token: currentUser.accessToken,
            }),
          }).catch(() => {});
          const orderPhoneClean = order.phone?.replace(/\D/g, '').slice(-8) || '';
          const currentPhoneClean = currentUser?.phone?.replace(/\D/g, '').slice(-8) || '';
          const orderEmailClean = order.email?.trim().toLowerCase() || '';
          const currentEmailClean = currentUser?.email?.trim().toLowerCase() || '';
          const isCurrentAccount = Boolean(
            (orderPhoneClean && orderPhoneClean === currentPhoneClean) ||
            (orderEmailClean && orderEmailClean === currentEmailClean)
          );
          const prevUserSpent = isCurrentAccount ? userTotalSpent : 0;
          const nextSpent = prevUserSpent + (order.total || 0);

          let promotionMsg = '';
          if (isCurrentAccount) {
            if (nextSpent >= 2000000 && prevUserSpent < 2000000) {
              promotionMsg = ' 🎉 Баяр хүргэе! Та дээд түвшний Алтан VIP (5%) гишүүн боллоо!';
            } else if (nextSpent >= 1000000 && prevUserSpent < 1000000) {
              promotionMsg = ' 🎉 Баяр хүргэе! Та Мөнгөн (3%) гишүүн боллоо!';
            } else if (nextSpent >= 500000 && prevUserSpent < 500000) {
              promotionMsg = ' 🎉 Баяр хүргэе! Та Хүрэл (2%) гишүүн боллоо!';
            }
          }

          // Deduct stock quantity for ordered products
          if (cart.length > 0) {
            setProducts((prevProducts) =>
              prevProducts.map((prod) => {
                const purchasedItem = cart.find((item) => item.id === prod.id);
                if (purchasedItem) {
                  const currentStock = prod.stock_quantity !== undefined 
                    ? prod.stock_quantity 
                    : (prod.in_stock ? 18 : 0);
                  const newStock = Math.max(0, currentStock - purchasedItem.quantity);
                  return {
                    ...prod,
                    stock_quantity: newStock,
                    in_stock: newStock > 0
                  };
                }
                return prod;
              })
            );
          }

          setOrders((prev) => [newOrder, ...prev]);
          setCart([]);
          showToast(`Захиалга ${formatOrderNumber(newOrder)} амжилттай бүртгэгдлээ! Таны бүртгэл дээр түүх хадгалагдлаа.${promotionMsg}`);
          return newOrder;
        }}
      />

      <LoyaltyModal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        orders={orders}
        currentUser={currentUser}
        activeLoyalty={activeLoyalty}
        loyaltyTiers={activeLoyaltyTiers}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLoginUser={(newUser) => {
          setCurrentUser(newUser);
          localStorage.setItem('usk_current_user', JSON.stringify(newUser));
          const methodLabel = newUser.loginMethod === 'email' ? 'И-мэйлээр' : 'Утасны дугаараар';
          showToast(`${methodLabel} амжилттай нэвтэрлээ. Тавтай морил, ${newUser.name}!`);
        }}
        onLogoutUser={() => {
          setCurrentUser(null);
          localStorage.removeItem('usk_current_user');
          showToast('Бүртгэлээс гарлаа.');
        }}
      />

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        selectedDay={selectedDay}
        onAddToCart={(prod, qty) => {
          handleAddToCart(prod, qty);
        }}
        freeDeliveryThreshold={checkoutSettings.freeDeliveryThreshold}
        currentUser={currentUser}
        onRequireLogin={() => { setDetailProduct(null); setIsProfileOpen(true); showToast('Сэтгэгдэл бичихийн тулд эхлээд бүртгэлдээ нэвтэрнэ үү.'); }}
      />

      {/* Admin Panel Full Screen Dashboard */}
      {isAdminOpen && (
        <AdminPanel
          products={products}
          orders={orders}
          memberProfiles={memberProfiles}
          storeLogoUrl={storeLogoUrl}
          storeBannerUrl={storeBannerUrl}
          onSaveBranding={async (kind, file) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const token = currentUser.accessToken;
            const url = await uploadBrandingImage(token, file, kind);
            await saveStoreSettings(token, kind === 'logo' ? { store_logo_url: url } : { store_banner_url: url });
            if (kind === 'logo') setStoreLogoUrl(url); else setStoreBannerUrl(url);
            showToast(`${kind === 'logo' ? 'Лого' : 'Хаяг баннер'} төв санд хадгалагдлаа.`);
          }}
          onResetBranding={async (kind) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const token = currentUser.accessToken;
            await saveStoreSettings(token, kind === 'logo' ? { store_logo_url: null } : { store_banner_url: null });
            if (kind === 'logo') setStoreLogoUrl(null); else setStoreBannerUrl(null);
            showToast(`${kind === 'logo' ? 'Лого' : 'Хаяг баннер'} үндсэн зураг руу сэргээгдлээ.`);
          }}
          categoryImages={categoryImages}
          onSaveCategoryImages={async (categoryId, files) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const token = currentUser.accessToken;
            const urls = await Promise.all(files.map((file) => uploadCategoryImage(token, file)));
            const next = { ...categoryImages, [categoryId]: urls };
            await saveStoreSettings(token, { category_images: next });
            setCategoryImages(next);
            showToast('Ангилалын зураг төв санд хадгалагдлаа.');
          }}
          loyaltyTiersConfig={activeLoyaltyTiers}
          loyaltyCashbackPct={loyaltyCashbackPct}
          onSaveLoyaltyRules={async (updatedTiers, updatedCashbackPct) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            await saveStoreSettings(currentUser.accessToken, { loyalty_tiers_config: updatedTiers, loyalty_cashback_pct: updatedCashbackPct });
            setActiveLoyaltyTiers(updatedTiers);
            setLoyaltyCashbackPct(updatedCashbackPct);
          }}
          loyaltyTierOverrides={loyaltyTierOverrides}
          onSaveTierOverride={async (userId, tierId) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const next = { ...loyaltyTierOverrides };
            if (tierId) next[userId] = tierId; else delete next[userId];
            await saveStoreSettings(currentUser.accessToken, { loyalty_tier_overrides: next });
            setLoyaltyTierOverrides(next);
          }}
          loyaltyWallets={loyaltyWallets}
          onGrantBonusPoints={async (userId, amount) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            await adminGrantLoyaltyPoints(currentUser.accessToken, userId, amount);
            setLoyaltyWallets((previous) => {
              const existing = previous.find((w) => w.user_id === userId);
              if (existing) {
                return previous.map((w) => w.user_id === userId
                  ? { ...w, available_points: Math.max(0, w.available_points + amount), lifetime_earned: w.lifetime_earned + Math.max(0, amount) }
                  : w);
              }
              return [...previous, { user_id: userId, available_points: Math.max(0, amount), lifetime_earned: Math.max(0, amount) }];
            });
          }}
          onSaveProduct={handleSaveProduct}
          onDeleteProduct={handleDeleteProduct}
          onToggleStock={handleToggleStock}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onConfirmPayment={async (orderId) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            await confirmStoreOrderPayment(currentUser.accessToken, orderId);
            // Confirming payment must also move a still-"new" order forward to "confirmed" so
            // the customer's order-status steps reflect it immediately, not just the payment badge.
            const target = orders.find((order) => order.orderId === orderId);
            const shouldAdvanceStatus = !target?.status || target.status === 'new';
            if (shouldAdvanceStatus) {
              try {
                await updateStoreOrderStatus(currentUser.accessToken, orderId, 'Баталгаажсан');
              } catch {
                // The payment is already confirmed; a status-transition hiccup here must not block the UI update.
              }
            }
            setOrders((previous) => previous.map((order) => order.orderId === orderId
              ? { ...order, paymentStatus: 'Төлбөр баталгаажсан', status: shouldAdvanceStatus ? 'confirmed' : order.status }
              : order));
            showToast('Төлбөр баталгаажлаа. Захиалгын төлөв "Баталгаажсан" болж, баримт хэвлэх эрх нээгдлээ.');
          }}
          onResetProducts={handleResetProducts}
          onClose={() => setIsAdminOpen(false)}
          onLogout={handleAdminLogout}
          onChangePin={handleChangePin}
          onOpenForms={() => setIsFormsOpen(true)}
          onQuickUpdateStock={handleQuickUpdateStock}
          featuredProductId={featuredProductId}
          combos={comboPacks}
          onSaveCombo={async (combo) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const next = comboPacks.some((item) => item.id === combo.id)
              ? comboPacks.map((item) => (item.id === combo.id ? combo : item))
              : [...comboPacks, combo];
            await saveStoreSettings(currentUser.accessToken, { combo_packs: next });
            setComboPacks(next);
            showToast(`"${combo.name}" багц төв санд хадгалагдлаа.`);
          }}
          onDeleteCombo={async (comboId) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const next = comboPacks.filter((item) => item.id !== comboId);
            await saveStoreSettings(currentUser.accessToken, { combo_packs: next });
            setComboPacks(next);
            showToast('Багц устгагдлаа.');
          }}
          onSaveFeaturedProduct={async (productId) => { if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.'); await saveStoreSettings(currentUser.accessToken, { featured_product_id: productId }); setFeaturedProductId(productId); showToast('Өнөөдрийн онцлох бараа төв санд хадгалагдлаа.'); }}
          reviews={adminReviews}
          onRefreshReviews={refreshAdminReviews}
          siteVisitStats={siteVisitStats}
          onRefreshSiteVisitStats={refreshSiteVisitStats}
          supportThreads={supportThreads}
          onRefreshSupportThreads={refreshSupportThreads}
          onOpenSupportThread={handleOpenSupportThread}
          onSendSupportReply={handleSendSupportReply}
          onModerateReview={async (reviewId, approve) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            await moderateProductReview(currentUser.accessToken, reviewId, approve);
            setAdminReviews((previous) => previous.map((review) => review.id === reviewId
              ? { ...review, status: approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }
              : review));
            showToast(approve ? 'Сэтгэгдэл зөвшөөрөгдлөө.' : 'Сэтгэгдэл татгалзагдлаа.');
          }}
          onDeleteReview={async (reviewId) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            await deleteProductReview(currentUser.accessToken, reviewId);
            setAdminReviews((previous) => previous.filter((review) => review.id !== reviewId));
            showToast('Сэтгэгдэл устгагдлаа.');
          }}
          checkoutSettings={checkoutSettings}
          onSaveCheckoutSettings={async (settings) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const data = await saveStoreSettings(currentUser.accessToken, {
              delivery_fee: settings.deliveryFee,
              free_delivery_threshold: settings.freeDeliveryThreshold,
              bank_accounts: {
                bankName: settings.bankName,
                accountNumber: settings.accountNumber,
                iban: settings.iban,
                accountHolder: settings.accountHolder,
              },
              store_phone: settings.storePhone,
              store_email: settings.storeEmail,
              facebook_url: settings.facebookUrl,
              messenger_url: settings.messengerUrl,
              google_maps_url: settings.googleMapsUrl,
              store_address: settings.storeAddress,
              unpaid_cancellation_minutes: settings.unpaidCancellationMinutes,
            });
            setCheckoutSettings({
              deliveryFee: Number(data.delivery_fee ?? settings.deliveryFee),
              freeDeliveryThreshold: Number(data.free_delivery_threshold ?? settings.freeDeliveryThreshold),
              bankName: settings.bankName,
              accountNumber: settings.accountNumber,
              iban: settings.iban,
              accountHolder: settings.accountHolder,
              storePhone: settings.storePhone,
              storeEmail: settings.storeEmail,
              facebookUrl: settings.facebookUrl,
              messengerUrl: settings.messengerUrl,
              googleMapsUrl: settings.googleMapsUrl,
              storeAddress: settings.storeAddress,
              unpaidCancellationMinutes: settings.unpaidCancellationMinutes,
            });
          }}
        />
      )}

      {isInventoryOpen && currentUser?.accessToken && (
        <React.Suspense fallback={null}>
          <InventoryCameraModal
            isOpen={isInventoryOpen}
            onClose={() => setIsInventoryOpen(false)}
            accessToken={currentUser.accessToken}
            onChanged={() => {
              setIsInventoryOpen(false);
              window.location.reload();
            }}
          />
        </React.Suspense>
      )}

      {/* User Profile & Security Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onSaveUser={(updatedUser) => {
          setCurrentUser(updatedUser);
          localStorage.setItem('usk_current_user', JSON.stringify(updatedUser));
          showToast(`Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.`);
        }}
        onLogoutUser={() => {
          setCurrentUser(null);
          localStorage.removeItem('usk_current_user');
          showToast('Бүртгэлээс гарлаа. Хувийн мэдээлэл бүрэн цэвэрлэгдсэн.');
        }}
        orders={orders}
        activeLoyalty={activeLoyalty}
        totalSpent={userTotalSpent}
      />

      {/* Google Forms Integration Modal */}
      <GoogleFormsModal
        isOpen={isFormsOpen}
        onClose={() => setIsFormsOpen(false)}
        onNotify={(msg) => showToast(msg)}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLogin={handleAdminLogin}
      />

      {/* Direct Product Form Modal (for quick edit from catalog cards) */}
      <ProductFormModal
        isOpen={isDirectFormOpen}
        onClose={() => {
          setIsDirectFormOpen(false);
          setDirectEditProduct(null);
        }}
        productToEdit={directEditProduct}
        onSave={(updated) => {
          handleSaveProduct(updated);
          setIsDirectFormOpen(false);
          setDirectEditProduct(null);
        }}
      />

      {/* Floating Bottom Cart Bar for Mobile when items exist */}
      {cartCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer border border-stone-700 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Truck className="w-5 h-5 text-amber-400" />
                <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              </div>
              <span className="font-bold text-xs text-stone-200">Сагс үзэх ({cartCount} бараа)</span>
            </div>
            <span className="font-black text-sm text-amber-400">{formatMNT(cartCurrentPriceTotal)}</span>
          </button>
        </div>
      )}

      {currentUser?.accessToken && !isAdminOpen && (
        <button
          type="button"
          onClick={() => setIsSupportChatOpen(true)}
          className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-400 shadow-xl flex items-center justify-center cursor-pointer transition-colors border border-stone-700"
          title="Дэлгүүртэй холбогдох"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}
      {currentUser?.accessToken && (
        <React.Suspense fallback={null}>
          <SupportChatModal
            isOpen={isSupportChatOpen}
            onClose={() => setIsSupportChatOpen(false)}
            accessToken={currentUser.accessToken}
          />
        </React.Suspense>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

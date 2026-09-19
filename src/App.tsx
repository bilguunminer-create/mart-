import React, { useState, useEffect, useMemo } from 'react';
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
  LogOut
} from 'lucide-react';
import { 
  PRODUCTS, 
  CATEGORIES, 
  DAILY_DEALS, 
  LOYALTY_TIERS, 
  STORE_CONFIG, 
  formatMNT,
  getStoredLoyaltyTiers,
  getStoredCashbackPct,
  calculateLoyaltyTierBySpent
} from './data/storeData';
import { Product, CartItem, LoyaltyTier, ComboPack, OrderDetails, UserProfile } from './types';
import { Header } from './components/Header';
import { DailyDealBanner } from './components/DailyDealBanner';
import { ProductCard } from './components/ProductCard';
import { CombosSection } from './components/CombosSection';
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
import { getStoreCustomerProfiles, getStoreOrders, getStoreSettings, saveStoreOrder, saveStoreProducts, saveStoreSettings, hasStoreAdminAccess, refreshSession, updateStoreOrderStatus } from './services/supabaseAuth';

export default function App() {
  // The installed admin PWA starts with ?admin=1 and exposes only the secured admin flow.
  const isAdminApp = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1';

  // Today's day of week (0 = Sunday, 1 = Monday, ...)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return new Date().getDay();
  });

  // The public catalog is loaded from Supabase. PRODUCTS is only the first render fallback.
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [checkoutSettings, setCheckoutSettings] = useState<{ deliveryFee: number; bankName: string; accountNumber: string; iban: string; accountHolder: string; storePhone: string }>({
    deliveryFee: 3000, bankName: '', accountNumber: '', iban: '', accountHolder: '', storePhone: STORE_CONFIG.phone,
  });
  useEffect(() => {
    getStoreSettings().then((settings) => {
      const remoteProducts = settings.data.products;
      if (!Array.isArray(remoteProducts)) return;
      setProducts(remoteProducts.map((product: any) => ({
        ...product,
        stock_quantity: Number(product.stock ?? 0),
        in_stock: Boolean(product.in_stock) && Number(product.stock ?? 0) > 0,
      })) as Product[]);
      const bank = settings.data.bank_accounts as Record<string, unknown> | undefined;
      setCheckoutSettings({
        deliveryFee: Number(settings.data.delivery_fee ?? 3000),
        bankName: String(bank?.bankName ?? ''),
        accountNumber: String(bank?.accountNumber ?? ''),
        iban: String(bank?.iban ?? ''),
        accountHolder: String(bank?.accountHolder ?? ''),
        storePhone: String(settings.data.store_phone ?? checkoutSettings.storePhone),
      });
    }).catch(() => { /* The built-in catalog remains visible if the network is unavailable. */ });
  }, []);

  // Orders are loaded from Supabase after a user signs in.
  const [orders, setOrders] = useState<OrderDetails[]>([]);

  const [memberProfiles, setMemberProfiles] = useState<Array<{ user_id: string; name: string; phone: string; address: string; created_at?: string }>>([]);

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
  const [adminPin, setAdminPin] = useState<string>(() => {
    try {
      return localStorage.getItem('usk_admin_pin') || '1234';
    } catch {
      return '1234';
    }
  });
  const [directEditProduct, setDirectEditProduct] = useState<Product | null>(null);
  const [isDirectFormOpen, setIsDirectFormOpen] = useState(false);

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
    Promise.all([getStoreOrders(currentUser.accessToken), getStoreCustomerProfiles(currentUser.accessToken)])
      .then(([remoteOrders, profiles]) => {
        if (!active) return;
        setMemberProfiles(profiles);
        setOrders(remoteOrders.map((order) => ({
          orderId: order.id,
          customerId: order.customer_id,
          customerName: order.customer_name,
          phone: order.phone,
          address: order.address,
          district: 'Өмнөговь, Даланзадгад',
          notes: order.note || '',
          paymentMethod: 'cod',
          items: (order.items || []).map((item) => ({
            type: 'product',
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
          status: order.status === 'Дууссан' ? 'delivered' : order.status === 'Цуцалсан' ? 'cancelled' : order.status === 'Хүргэлтэд' ? 'shipping' : order.status === 'Баталгаажсан' ? 'confirmed' : 'new',
        })));
      })
      .catch(() => { if (active) setMemberProfiles([]); });
    return () => { active = false; };
  }, [currentUser?.accessToken]);

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

  // Active Loyalty Tiers from settings
  const [activeLoyaltyTiers, setActiveLoyaltyTiers] = useState<LoyaltyTier[]>(() => getStoredLoyaltyTiers());

  useEffect(() => {
    const handleConfigSync = () => {
      setActiveLoyaltyTiers(getStoredLoyaltyTiers());
    };
    window.addEventListener('usk_loyalty_config_updated', handleConfigSync);
    return () => window.removeEventListener('usk_loyalty_config_updated', handleConfigSync);
  }, []);

  // Active Loyalty Tier: Strictly visible & active only after logging in with email or phone
  const activeLoyalty = useMemo<LoyaltyTier | null>(() => {
    if (!currentUser || (!userPhoneClean && !userEmailClean)) {
      return null;
    }
    // Check if admin granted a VIP tier override for this email or phone
    try {
      const saved = localStorage.getItem('usk_loyalty_bonuses');
      if (saved) {
        const bonuses = JSON.parse(saved);
        const override = (userEmailClean && bonuses[userEmailClean]) || (userPhoneClean && bonuses[`tel_${userPhoneClean}`]);
        if (override?.forceTier) {
          const forced = activeLoyaltyTiers.find((t) => t.id === override.forceTier);
          if (forced) return forced;
        }
      }
    } catch {
      // ignore
    }

    return calculateLoyaltyTierBySpent(userTotalSpent, activeLoyaltyTiers);
  }, [currentUser, userPhoneClean, userEmailClean, userTotalSpent, activeLoyaltyTiers]);

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

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gobi_mart_cart', JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  // Sync loyalty to localStorage
  useEffect(() => {
    try {
      if (activeLoyalty) {
        localStorage.setItem('gobi_mart_loyalty', JSON.stringify(activeLoyalty));
      } else {
        localStorage.removeItem('gobi_mart_loyalty');
      }
    } catch {
      // ignore storage errors
    }
  }, [activeLoyalty]);


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
    void saveStoreProducts(currentUser.accessToken, nextProducts)
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
        showToast('Энэ бүртгэл админ эрхгүй байна. uskfamilymart@gmail.com эсвэл bilguunminer@gmail.com хаягаар нэвтэрнэ үү.');
        return;
      }
    } catch {
      showToast('Админ эрхийг төв сангаас шалгах боломжгүй байна.');
      return;
    }

    if (isAdminAuthenticated) setIsAdminOpen(true);
    else setIsAdminLoginOpen(true);
  };

  const handleAdminLoginSuccess = async () => {
    if (!currentUser?.accessToken || !await hasStoreAdminAccess(currentUser.accessToken)) {
      setIsAdminLoginOpen(false);
      setIsProfileOpen(true);
      showToast('Админ и-мэйлээр дахин нэвтэрч байж төв сангийн гишүүдийг харна.');
      return;
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

  // The dedicated installed admin app opens the secured management screen directly.
  useEffect(() => {
    if (!isAdminApp) return;
    void handleOpenAdmin();
  }, [isAdminApp, currentUser?.accessToken, isAdminAuthenticated]);

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
        showToast(`Захиалга #${orderId} төлөв төв санд хадгалагдлаа`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        showToast(message.includes('permission') || message.includes('policy')
          ? 'Энэ эрхээр захиалгын төлөв шинэчлэх боломжгүй байна. Админ и-мэйлээр дахин нэвтэрнэ үү.'
          : 'Төв санд төлөв шинэчлэх боломжгүй байна. Дахин оролдоно уу.');
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

  const handleChangePin = (newPin: string) => {
    setAdminPin(newPin);
    try {
      localStorage.setItem('usk_admin_pin', newPin);
    } catch {
      // ignore
    }
    showToast('ПИН код шинэчлэгдлээ');
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

    return {
      price: finalPrice,
      originalPrice: product.price,
      discountPercent,
      isDealActive
    };
  };

  // Add Product to Cart
  const handleAddToCart = (product: Product, quantity = 1) => {
    const pricing = getProductPricing(product);
    
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((i) => i.id === product.id);
      if (existingIndex > -1) {
        const next = [...prevCart];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          price: pricing.price,
          originalPrice: pricing.originalPrice
        };
        return next;
      } else {
        const newItem: CartItem = {
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
        };
        return [...prevCart, newItem];
      }
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
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
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
        if (!isDeal) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedOrigin, showDealsOnly, selectedDay, currentDeal]);

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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-8">
        {/* Official Store Banner: US&K Family Mart Даланзадгад хот */}
        <StoreHeroBanner
          onExploreClick={() => {
            const el = document.getElementById('products-grid-section');
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
          products={products}
        />

        {/* Curated Combos Section */}
        <CombosSection
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
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
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
                  {formatMNT(STORE_CONFIG.free_delivery_threshold)}-өөс дээш үнэгүй. Өмнөговь болон УБ хотод 1-2 цагт.
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
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-stone-800">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <BeeEmblemLogo size={38} className="w-9 h-9 shrink-0" />
                <div>
                  <span className="font-black text-white text-lg tracking-tight block">US&K Family Mart</span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Даланзадгад хот • 09:00 - 20:00</span>
                </div>
              </div>
              <p className="text-stone-400 text-xs max-w-md">
                АНУ болон БНСУ-ын дээд зэрэглэлийн чанартай хүнс, рамен, хүүхдийн живх, өргөн хэрэглээ, амин дэмийг шуурхай хүргэх цахим дэлгүүр.
              </p>
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
              <span>•</span>
              <span className="text-stone-400">{STORE_CONFIG.location}</span>
              <span>•</span>
              <a href={`tel:${checkoutSettings.storePhone}`} className="text-amber-400 font-bold hover:underline">
                Утас: {checkoutSettings.storePhone}
              </a>
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
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        activeLoyalty={activeLoyalty}
        dailyDiscountTotal={dailyDiscountTotal}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        orders={orders}
        currentUser={currentUser}
        dailyDiscountTotal={dailyDiscountTotal}
        onOrderSuccess={async (order) => {
          if (!currentUser?.accessToken) {
            throw new Error('Захиалгаа хадгалахын тулд эхлээд бүртгэлдээ нэвтэрнэ үү.');
          }
          await saveStoreOrder(currentUser.accessToken, {
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            notes: order.notes,
            total: order.total,
            pointsToUse: order.pointsDiscount || 0,
            items: order.items.map((item) => ({ id: item.id, quantity: item.quantity })),
          });
          const newOrder: OrderDetails = {
            ...order,
            status: 'new'
          };
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
          showToast(`Захиалга #${order.orderId} амжилттай бүртгэгдлээ! Таны бүртгэл дээр түүх хадгалагдлаа.${promotionMsg}`);
        }}
      />

      <LoyaltyModal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        orders={orders}
        currentUser={currentUser}
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
      />

      {/* Admin Panel Full Screen Dashboard */}
      {isAdminOpen && (
        <AdminPanel
          products={products}
          orders={orders}
          memberProfiles={memberProfiles}
          onSaveProduct={handleSaveProduct}
          onDeleteProduct={handleDeleteProduct}
          onToggleStock={handleToggleStock}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onResetProducts={handleResetProducts}
          onClose={() => setIsAdminOpen(false)}
          onLogout={handleAdminLogout}
          adminPin={adminPin}
          onChangePin={handleChangePin}
          onOpenForms={() => setIsFormsOpen(true)}
          onQuickUpdateStock={handleQuickUpdateStock}
          checkoutSettings={checkoutSettings}
          onSaveCheckoutSettings={async (settings) => {
            if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр нэвтэрнэ үү.');
            const data = await saveStoreSettings(currentUser.accessToken, {
              delivery_fee: settings.deliveryFee,
              bank_accounts: {
                bankName: settings.bankName,
                accountNumber: settings.accountNumber,
                iban: settings.iban,
                accountHolder: settings.accountHolder,
              },
              store_phone: settings.storePhone,
            });
            setCheckoutSettings({
              deliveryFee: Number(data.delivery_fee ?? settings.deliveryFee),
              bankName: settings.bankName,
              accountNumber: settings.accountNumber,
              iban: settings.iban,
              accountHolder: settings.accountHolder,
              storePhone: settings.storePhone,
            });
          }}
        />
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
        onLoginSuccess={handleAdminLoginSuccess}
        currentPin={adminPin}
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

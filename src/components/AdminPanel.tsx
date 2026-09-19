import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, 
  ShoppingBag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  ArrowLeft, 
  Truck, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Phone, 
  MapPin, 
  RotateCcw, 
  KeyRound, 
  Sparkles,
  DollarSign,
  Layers,
  Image as ImageIcon,
  LogOut,
  Award,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Gift,
  Star,
  UserCheck,
  Mail,
  Lock,
  Users,
  Settings2,
  Boxes,
  Minus,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { processImageFile } from '../utils/imageUtils';
import { Product, OrderDetails, LoyaltyTier } from '../types';
import { 
  CATEGORIES, 
  LOYALTY_TIERS, 
  formatMNT, 
  getStoredLoyaltyTiers, 
  getStoredCashbackPct,
  calculateLoyaltyTierBySpent
} from '../data/storeData';
import { ProductFormModal } from './ProductFormModal';
import { LoyaltyRulesModal } from './LoyaltyRulesModal';

interface AdminPanelProps {
  products: Product[];
  orders: OrderDetails[];
  memberProfiles?: Array<{ user_id: string; name: string; phone: string; address: string; created_at?: string }>;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleStock: (productId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled') => void;
  onResetProducts: () => void;
  onClose: () => void;
  onLogout?: () => void;
  adminPin: string;
  onChangePin: (newPin: string) => void;
  onOpenForms?: () => void;
  onQuickUpdateStock?: (productId: string, amount: number, isAbsolute?: boolean) => void;
  checkoutSettings?: { deliveryFee: number; bankName: string; accountNumber: string; iban: string; accountHolder: string; storePhone: string };
  onSaveCheckoutSettings?: (settings: { deliveryFee: number; bankName: string; accountNumber: string; iban: string; accountHolder: string; storePhone: string }) => Promise<void> | void;
}

export interface LoyaltyMember {
  id: string; // email or phone
  name: string;
  email: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
  deliveredCount: number;
  lastOrderDate: string;
  tier: LoyaltyTier | null;
  cashPoints: number;
  bonusPoints: number;
  totalPoints: number;
  nextTier: {
    name: string;
    remaining: number;
    progressPct: number;
  } | null;
  orders: OrderDetails[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  orders,
  memberProfiles = [],
  onSaveProduct,
  onDeleteProduct,
  onToggleStock,
  onUpdateOrderStatus,
  onResetProducts,
  onClose,
  onLogout,
  adminPin,
  onChangePin,
  onOpenForms,
  onQuickUpdateStock,
  checkoutSettings = { deliveryFee: 3000, bankName: '', accountNumber: '', iban: '', accountHolder: '', storePhone: '' },
  onSaveCheckoutSettings
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'loyalty' | 'stats' | 'settings'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOrigin, setSelectedOrigin] = useState<'ALL' | 'KR' | 'US'>('ALL');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [checkoutDraft, setCheckoutDraft] = useState(checkoutSettings);
  const [checkoutSettingsMessage, setCheckoutSettingsMessage] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  useEffect(() => {
    setCheckoutDraft(checkoutSettings);
  }, [checkoutSettings.deliveryFee, checkoutSettings.bankName, checkoutSettings.accountNumber, checkoutSettings.iban, checkoutSettings.accountHolder]);

  const openLoyaltyMembers = () => {
    setActiveTab('loyalty');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  // Product Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete confirmation
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Orders status filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Security: PIN change state with 3-step verification
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string | null>(null);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);

  // Security: Last login audit
  const lastLoginTime = useMemo(() => {
    try {
      return sessionStorage.getItem('usk_admin_last_login') || 'Одоогоор идэвхтэй';
    } catch {
      return 'Одоогоор идэвхтэй';
    }
  }, []);

  // Security: Auto-logout idle timer (15 minutes = 900 seconds)
  const [idleTimeRemaining, setIdleTimeRemaining] = useState<number>(900);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleUserActivity = () => {
      setIdleTimeRemaining(900);
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    idleTimerRef.current = setInterval(() => {
      setIdleTimeRemaining((prev) => {
        if (prev <= 1) {
          if (idleTimerRef.current) clearInterval(idleTimerRef.current);
          if (onLogout) onLogout();
          onClose();
          alert('Аюулгүй байдлын үүднээс идэвхгүй 15 минут болсон тул админ системээс автоматаар гарлаа.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [onLogout, onClose]);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Loyalty Management state
  const [loyaltySearch, setLoyaltySearch] = useState('');
  const [loyaltyFilter, setLoyaltyFilter] = useState<'all' | 'gold' | 'silver' | 'bronze' | 'standard'>('all');
  
  // Dynamic loyalty rules and cashback config
  const [loyaltyTiersConfig, setLoyaltyTiersConfig] = useState<LoyaltyTier[]>(() => getStoredLoyaltyTiers());
  const [cashbackPctConfig, setCashbackPctConfig] = useState<number>(() => getStoredCashbackPct());
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Sync when event dispatched
  useEffect(() => {
    const handleConfigUpdated = () => {
      setLoyaltyTiersConfig(getStoredLoyaltyTiers());
      setCashbackPctConfig(getStoredCashbackPct());
    };
    window.addEventListener('usk_loyalty_config_updated', handleConfigUpdated);
    return () => window.removeEventListener('usk_loyalty_config_updated', handleConfigUpdated);
  }, []);

  // Custom loyalty bonuses and manual overrides persisted in localStorage
  const [customLoyaltyData, setCustomLoyaltyData] = useState<Record<string, { bonusPoints?: number; forceTier?: string }>>(() => {
    try {
      const saved = localStorage.getItem('usk_loyalty_bonuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal for rewarding bonus points
  const [bonusTarget, setBonusTarget] = useState<{ email: string; name: string; currentPoints: number } | null>(null);
  const [bonusAmountInput, setBonusAmountInput] = useState<number>(5000);
  const [bonusSuccessMsg, setBonusSuccessMsg] = useState<string | null>(null);

  // Modal for changing manual tier override
  const [tierOverrideTarget, setTierOverrideTarget] = useState<{ email: string; name: string; currentTierId: string } | null>(null);

  // Save custom bonuses helper
  const handleGrantBonus = (email: string, amount: number) => {
    setCustomLoyaltyData((prev) => {
      const existing = prev[email] || {};
      const nextPoints = (existing.bonusPoints || 0) + amount;
      const updated = {
        ...prev,
        [email]: { ...existing, bonusPoints: nextPoints }
      };
      try {
        localStorage.setItem('usk_loyalty_bonuses', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setBonusSuccessMsg(`${amount.toLocaleString()} лояалти оноо амжилттай олгогдлоо!`);
    setTimeout(() => {
      setBonusSuccessMsg(null);
      setBonusTarget(null);
    }, 1500);
  };

  const handleSetTierOverride = (email: string, tierId: string) => {
    setCustomLoyaltyData((prev) => {
      const existing = prev[email] || {};
      const updated = {
        ...prev,
        [email]: { ...existing, forceTier: tierId === 'auto' ? undefined : tierId }
      };
      try {
        localStorage.setItem('usk_loyalty_bonuses', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setTierOverrideTarget(null);
  };

  // Branding Customization state (Exact user LOGO and Banner)
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('usk_custom_logo') || null;
    } catch {
      return null;
    }
  });
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('usk_custom_banner') || null;
    } catch {
      return null;
    }
  });
  const [isUploadingBranding, setIsUploadingBranding] = useState(false);
  const [brandingStatusMsg, setBrandingStatusMsg] = useState<string | null>(null);

  const handleUploadBrandingImage = async (type: 'logo' | 'banner', file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Зөвхөн зурган файл (PNG, JPG, WEBP) сонгоно уу.');
      return;
    }

    try {
      setIsUploadingBranding(true);
      setBrandingStatusMsg(`${type === 'logo' ? 'Лого' : 'Баннер'} файлыг боловсруулж байна...`);

      // Compress/process to avoid blowing storage while maintaining sharpness
      const maxDim = type === 'logo' ? 600 : 1600;
      const base64Data = await processImageFile(file, maxDim, maxDim, 0.92);

      // Save to localStorage
      const storageKey = type === 'logo' ? 'usk_custom_logo' : 'usk_custom_banner';
      try {
        localStorage.setItem(storageKey, base64Data);
      } catch {
        // quota exceeded fallback
      }

      // Also persist to server endpoint
      try {
        await fetch('/api/upload-branding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, dataBase64: base64Data })
        });
      } catch {
        // ignore server network issues
      }

      if (type === 'logo') {
        setCustomLogoUrl(base64Data);
      } else {
        setCustomBannerUrl(base64Data);
      }

      // Notify entire app of branding change
      window.dispatchEvent(new Event('usk_branding_updated'));
      setBrandingStatusMsg(`Таны ${type === 'logo' ? 'лого' : 'хаяг баннер'} амжилттай солигдлоо! Ямар ч өөрчлөлтгүйгээр суулаа.`);
      setTimeout(() => setBrandingStatusMsg(null), 3500);
    } catch (err: any) {
      alert('Зураг оруулахад алдаа гарлаа: ' + (err.message || ''));
    } finally {
      setIsUploadingBranding(false);
    }
  };

  const handleResetBranding = (type: 'logo' | 'banner') => {
    const storageKey = type === 'logo' ? 'usk_custom_logo' : 'usk_custom_banner';
    localStorage.removeItem(storageKey);
    if (type === 'logo') setCustomLogoUrl(null);
    if (type === 'banner') setCustomBannerUrl(null);
    window.dispatchEvent(new Event('usk_branding_updated'));
    setBrandingStatusMsg(`${type === 'logo' ? 'Лого' : 'Баннер'}-г анхдагч хэв маягт буцаалаа.`);
    setTimeout(() => setBrandingStatusMsg(null), 3000);
  };

  // Group all orders by the Supabase user ID. This keeps a profile and all of
  // its orders in one member record, even if the user changes name, phone, or email.
  const loyaltyMembers = useMemo<LoyaltyMember[]>(() => {
    const memberMap: Record<string, {
      name: string;
      email: string;
      phone: string;
      orders: OrderDetails[];
    }> = {};

    memberProfiles.forEach((profile) => {
      memberMap[profile.user_id] = {
        name: profile.name || 'Хэрэглэгч',
        email: '',
        phone: profile.phone || '',
        orders: [],
      };
    });

    orders.forEach((order) => {
      const memberId = order.customerId || (order.email
        ? `email_${order.email.trim().toLowerCase()}`
        : order.phone
          ? `tel_${order.phone.replace(/\D/g, '')}`
          : `order_${order.orderId}`);

      if (!memberMap[memberId]) {
        memberMap[memberId] = {
          name: order.customerName || 'Хэрэглэгч',
          email: order.email ? order.email.trim().toLowerCase() : '',
          phone: order.phone || '',
          orders: [],
        };
      }

      memberMap[memberId].orders.push(order);
      if (order.customerName && memberMap[memberId].name === 'Хэрэглэгч') {
        memberMap[memberId].name = order.customerName;
      }
      if (order.phone) {
        memberMap[memberId].phone = order.phone;
      }
    });

    return Object.entries(memberMap).map(([id, info]) => {
      const validOrders = info.orders.filter((order) => order.status === 'delivered');
      const totalSpent = validOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const deliveredCount = validOrders.length;
      const lastOrder = info.orders[0]?.date || 'Огноогүй';

      const sortedTiers = [...loyaltyTiersConfig].sort((a, b) => b.threshold - a.threshold);
      let autoTier: LoyaltyTier | null = null;
      for (const tier of sortedTiers) {
        if (totalSpent >= tier.threshold) {
          autoTier = tier;
          break;
        }
      }

      const override = customLoyaltyData[info.email || id];
      const effectiveTier = override?.forceTier
        ? loyaltyTiersConfig.find((tier) => tier.id === override.forceTier) || autoTier
        : autoTier;
      const bonusPoints = override?.bonusPoints || 0;

      const ascTiers = [...loyaltyTiersConfig].sort((a, b) => a.threshold - b.threshold);
      const nextTierTarget = ascTiers.find((tier) => totalSpent < tier.threshold);
      const nextTierInfo = nextTierTarget ? (() => {
        const previousTier = ascTiers[ascTiers.indexOf(nextTierTarget) - 1];
        const previousThreshold = previousTier?.threshold || 0;
        const span = nextTierTarget.threshold - previousThreshold;
        return {
          name: nextTierTarget.name.split(' ')[0],
          remaining: nextTierTarget.threshold - totalSpent,
          progressPct: span > 0 ? Math.min(100, Math.round(((totalSpent - previousThreshold) / span) * 100)) : 100,
        };
      })() : null;

      return {
        id,
        name: info.name,
        email: info.email,
        phone: info.phone,
        totalSpent,
        orderCount: info.orders.length,
        deliveredCount,
        lastOrderDate: lastOrder,
        tier: effectiveTier,
        cashPoints: 0,
        bonusPoints,
        totalPoints: bonusPoints,
        nextTier: nextTierInfo,
        orders: info.orders,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, memberProfiles, customLoyaltyData, loyaltyTiersConfig]);

  // Filtered loyalty members
  const filteredLoyaltyMembers = useMemo(() => {
    return loyaltyMembers.filter((m) => {
      const matchesSearch = 
        m.name.toLowerCase().includes(loyaltySearch.toLowerCase()) ||
        m.email.toLowerCase().includes(loyaltySearch.toLowerCase()) ||
        m.phone.includes(loyaltySearch);

      if (!matchesSearch) return false;

      if (loyaltyFilter === 'all') return true;
      if (loyaltyFilter === 'standard') return !m.tier;
      return m.tier?.id === loyaltyFilter;
    });
  }, [loyaltyMembers, loyaltySearch, loyaltyFilter]);

  // Inventory and product stats
  const totalProducts = products.length;
  const inStockCount = products.filter(p => p.in_stock && (p.stock_quantity === undefined || p.stock_quantity > 0)).length;
  const lowStockCount = products.filter(p => p.in_stock && p.stock_quantity === 1).length;
  const outOfStockCount = products.filter(p => !p.in_stock || (p.stock_quantity !== undefined && p.stock_quantity <= 0)).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock_quantity ?? (p.in_stock ? 18 : 0)), 0);

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || prod.category === selectedCategory;
    const matchesOrigin = selectedOrigin === 'ALL' || prod.origin === selectedOrigin;
    
    const isOut = !prod.in_stock || (prod.stock_quantity !== undefined && prod.stock_quantity <= 0);
    const isLow = prod.in_stock && prod.stock_quantity === 1;
    const isIn = prod.in_stock && (prod.stock_quantity === undefined || prod.stock_quantity > 0);

    const matchesStock = stockFilter === 'all' 
      ? true 
      : stockFilter === 'in_stock' 
        ? isIn 
        : stockFilter === 'low_stock' 
          ? isLow 
          : isOut;

    return matchesSearch && matchesCat && matchesOrigin && matchesStock;
  });

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (orderStatusFilter === 'all') return true;
    return (order.status || 'new') === orderStatusFilter;
  });

  // Overall order stats
  const totalOrders = orders.length;
  const newOrdersCount = orders.filter(o => !o.status || o.status === 'new').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const confirmDelete = (id: string) => {
    onDeleteProduct(id);
    setDeletingProductId(null);
  };

  // Secure 3-step PIN change
  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeMsg(null);

    if (currentPinInput.trim() !== adminPin) {
      setPinChangeError('Одоогийн хуучин ПИН код буруу байна!');
      return;
    }

    if (newPinInput.trim().length < 4) {
      setPinChangeError('Шинэ ПИН код хамгийн багадаа 4 оронтой байх ёстой!');
      return;
    }

    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeError('Шинэ ПИН код болон давтан оруулсан код хоорондоо тохирохгүй байна!');
      return;
    }

    onChangePin(newPinInput.trim());
    setPinChangeMsg('Админ ПИН код амжилттай шинэчлэгдлээ! Систем шинэ кодоор хамгаалагдлаа.');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setTimeout(() => setPinChangeMsg(null), 4000);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Баталгаажсан</span>;
      case 'shipping':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Хүргэлтэд гарсан</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Хүргэгдсэн</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Цуцлагдсан</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">Шинэ захиалга</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-100 overflow-y-auto flex flex-col">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-stone-900 text-white shadow-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Дэлгүүр рүү буцах"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Дэлгүүр рүү буцах</span>
            </button>
            <div className="h-5 w-px bg-stone-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                US&K
              </div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Админ Удирдлага
              </h1>
            </div>
          </div>

          {/* Quick Stats in Header for Desktop */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs text-stone-300 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
              <span>Нийт: <strong className="text-white">{totalProducts}</strong> бараа</span>
              <span>•</span>
              <span>Шинэ: <strong className="text-amber-400">{newOrdersCount}</strong> захиалга</span>
            </div>

            {onOpenForms && (
              <button
                id="admin-google-forms-btn"
                onClick={onOpenForms}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold rounded-xl border border-stone-700 transition-all cursor-pointer flex items-center gap-1.5"
                title="Google Forms судалгаа & хариултууд удирдах"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="#7248B9"/>
                  <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                  <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="hidden sm:inline">Forms Судалгаа</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold rounded-xl border border-stone-700 transition-all cursor-pointer flex items-center gap-1.5"
                title="Админ горимоос гарч хэрэглэгчийн харагдац руу шилжих"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Гарах</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Хаах</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between border-t border-stone-800/60 overflow-x-auto">
          <div className="flex gap-2">
            <button
              id="admin-tab-products"
              onClick={() => setActiveTab('products')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'products'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Бараа & үлдэгдэл</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-[10px] text-stone-300">
                {totalProducts}
              </span>
            </button>

            <button
              id="admin-tab-orders"
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Захиалга & хүргэлт</span>
              {newOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-[10px] text-white font-bold animate-pulse">
                  {newOrdersCount} шинэ
                </span>
              )}
            </button>

            <button
              id="admin-tab-loyalty"
              type="button"
              onClick={openLoyaltyMembers}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'loyalty'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Гишүүд & лояалти</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                {loyaltyMembers.length}
              </span>
            </button>

            <button
              id="admin-tab-stats"
              onClick={() => setActiveTab('stats')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'stats'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Тайлан & хяналт</span>
            </button>

            <button
              id="admin-tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Тохиргоо, төлбөр & хамгаалалт</span>
              {adminPin === '1234' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Анхдагч ПИН ашиглаж байна" />
              )}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 py-2 pr-2 text-[11px] text-stone-400">
            <span className="flex items-center gap-1 bg-stone-800/80 px-2.5 py-1 rounded-lg border border-stone-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Аюулгүй сесс: <strong className="text-emerald-300 font-mono">{Math.floor(idleTimeRemaining / 60)}:{String(idleTimeRemaining % 60).padStart(2, '0')}</strong></span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ================= PRODUCTS TAB ================= */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Inventory Overview KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div 
                onClick={() => setStockFilter('all')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  stockFilter === 'all' 
                    ? 'bg-stone-900 text-white border-stone-800 shadow-md' 
                    : 'bg-white text-stone-900 border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${stockFilter === 'all' ? 'text-stone-300' : 'text-stone-500'}`}>
                    Нийт бараа
                  </span>
                  <Boxes className="w-4 h-4 text-stone-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black">{totalProducts}</span>
                  <span className={`text-xs ${stockFilter === 'all' ? 'text-stone-400' : 'text-stone-500'}`}>
                    төрөл ({totalStockUnits} ш)
                  </span>
                </div>
              </div>

              <div 
                onClick={() => setStockFilter('in_stock')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  stockFilter === 'in_stock' 
                    ? 'bg-emerald-700 text-white border-emerald-600 shadow-md' 
                    : 'bg-white text-stone-900 border-stone-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${stockFilter === 'in_stock' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                    Бэлэн худалдаанд
                  </span>
                  <CheckCircle2 className={`w-4 h-4 ${stockFilter === 'in_stock' ? 'text-emerald-200' : 'text-emerald-600'}`} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black">{inStockCount}</span>
                  <span className={`text-xs ${stockFilter === 'in_stock' ? 'text-emerald-200' : 'text-stone-500'}`}>
                    төрөл бэлэн
                  </span>
                </div>
              </div>

              <div 
                onClick={() => setStockFilter('low_stock')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  stockFilter === 'low_stock' 
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md' 
                    : 'bg-white text-stone-900 border-stone-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${stockFilter === 'low_stock' ? 'text-amber-100' : 'text-amber-700'}`}>
                    Үлдэгдэл цөөн (≤5)
                  </span>
                  <AlertTriangle className={`w-4 h-4 ${stockFilter === 'low_stock' ? 'text-amber-200' : 'text-amber-600'}`} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-amber-500">{lowStockCount}</span>
                  <span className={`text-xs ${stockFilter === 'low_stock' ? 'text-amber-100' : 'text-stone-500'}`}>
                    төрөл татан авах
                  </span>
                </div>
              </div>

              <div 
                onClick={() => setStockFilter('out_of_stock')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  stockFilter === 'out_of_stock' 
                    ? 'bg-rose-700 text-white border-rose-600 shadow-md' 
                    : 'bg-white text-stone-900 border-stone-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${stockFilter === 'out_of_stock' ? 'text-rose-100' : 'text-rose-700'}`}>
                    Түр дууссан (0ш)
                  </span>
                  <AlertCircle className={`w-4 h-4 ${stockFilter === 'out_of_stock' ? 'text-rose-200' : 'text-rose-600'}`} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-rose-600">{outOfStockCount}</span>
                  <span className={`text-xs ${stockFilter === 'out_of_stock' ? 'text-rose-200' : 'text-stone-500'}`}>
                    төрөл захиалгагүй
                  </span>
                </div>
              </div>
            </div>

            {/* Top Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Барааны нэр, кодоор хайх..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-stone-50 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="all">Бүх ангилал ({products.length})</option>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Origin Filter */}
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value as any)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="ALL">Бүх улс</option>
                  <option value="KR">🇰🇷 БНСУ</option>
                  <option value="US">🇺🇸 АНУ</option>
                </select>

                {/* Stock Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white font-medium"
                >
                  <option value="all">Бүх үлдэгдэл ({totalProducts})</option>
                  <option value="in_stock">✅ Бэлэн байгаа ({inStockCount})</option>
                  <option value="low_stock">⚠️ Үлдэгдэл цөөн (≤5) ({lowStockCount})</option>
                  <option value="out_of_stock">🚫 Дууссан (0ш) ({outOfStockCount})</option>
                </select>
              </div>

              {/* Add Product Button */}
              <button
                id="admin-add-product-btn"
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Шинэ бараа нэмэх</span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((prod) => {
                const availableStock = prod.stock_quantity !== undefined 
                  ? prod.stock_quantity 
                  : (prod.in_stock ? 18 : 0);
                const isOut = !prod.in_stock || availableStock <= 0;
                const isLow = !isOut && availableStock <= 5;

                return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col overflow-hidden ${
                    isOut ? 'border-rose-200 bg-stone-50/50' : isLow ? 'border-amber-300' : 'border-stone-200'
                  }`}
                >
                  {/* Image container */}
                  <div className="relative h-44 bg-stone-100 overflow-hidden group">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className={`w-full h-full object-cover transition-transform group-hover:scale-105 duration-300 ${
                        isOut ? 'grayscale opacity-75' : ''
                      }`}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      <span className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold text-stone-800 shadow-xs flex items-center gap-1">
                        <span>{prod.flag}</span>
                        <span>{prod.country}</span>
                      </span>
                      {prod.badge && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs ${prod.badge_color || 'bg-rose-500'}`}>
                          {prod.badge}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs ${
                        isOut 
                          ? 'bg-rose-600 text-white' 
                          : isLow 
                            ? 'bg-amber-500 text-white animate-pulse' 
                            : 'bg-emerald-500 text-white'
                      }`}>
                        {isOut ? '0 ш (Дууссан)' : `${availableStock} ш бэлэн`}
                      </span>
                    </div>

                    {/* Quick In-Stock switch overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 bg-white text-stone-900 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Засах</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStock(prod.id)}
                        className={`p-2 rounded-xl text-white font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer ${
                          prod.in_stock ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <span>{prod.in_stock ? 'Дууссан болгох' : 'Бэлэн болгох'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                        <span className="font-mono">{prod.id}</span>
                        <span>{prod.category_name}</span>
                      </div>
                      <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">
                        {prod.weight} • {prod.description}
                      </p>
                    </div>

                    {/* Live Inventory Stock Bar & 1-Click Restock Controls */}
                    <div className="bg-stone-50 p-2 rounded-xl border border-stone-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500 font-medium">Үлдэгдэл:</span>
                        {isOut ? (
                          <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px] border border-rose-200">
                            0 ш (Түр дууссан)
                          </span>
                        ) : isLow ? (
                          <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px] border border-amber-300 animate-pulse">
                            ⚠️ {availableStock} ш (Бага!)
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                            {availableStock} ш бэлэн
                          </span>
                        )}
                      </div>

                      {/* Quick Restock Buttons */}
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-stone-200/60">
                        <span className="text-[10px] text-stone-400 font-semibold">Татан авах:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(0, availableStock - 1);
                              if (onQuickUpdateStock) {
                                onQuickUpdateStock(prod.id, -1);
                              } else {
                                onSaveProduct({
                                  ...prod,
                                  stock_quantity: next,
                                  in_stock: next > 0
                                });
                              }
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-stone-200 text-stone-700 font-bold rounded text-[10px] border border-stone-200 cursor-pointer"
                            title="1 ширхэгээр хасах"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = availableStock + 5;
                              if (onQuickUpdateStock) {
                                onQuickUpdateStock(prod.id, 5);
                              } else {
                                onSaveProduct({
                                  ...prod,
                                  stock_quantity: next,
                                  in_stock: true
                                });
                              }
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200 cursor-pointer"
                            title="5 ширхэгээр нэмэх"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = availableStock + 10;
                              if (onQuickUpdateStock) {
                                onQuickUpdateStock(prod.id, 10);
                              } else {
                                onSaveProduct({
                                  ...prod,
                                  stock_quantity: next,
                                  in_stock: true
                                });
                              }
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200 cursor-pointer"
                            title="10 ширхэгээр нэмэх"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Үнэ:</span>
                        <span className="font-black text-rose-600 text-sm">{formatMNT(prod.price)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Барааны мэдээлэл, зураг засах"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProductId(prod.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Устгах"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                <Package className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                <p className="font-bold text-stone-700 text-sm">Хайлтад тохирох бараа олдсонгүй</p>
                <p className="text-xs text-stone-400 mt-1">Шүүлтүүрээ өөрчлөх эсвэл шинээр бараа нэмнэ үү.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= ORDERS TAB ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Orders Filter */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-stone-700 mr-2">Төлөв:</span>
                {[
                  { id: 'all', label: `Бүгд (${orders.length})` },
                  { id: 'new', label: `Шинэ (${orders.filter(o => !o.status || o.status === 'new').length})` },
                  { id: 'confirmed', label: `Баталгаажсан (${orders.filter(o => o.status === 'confirmed').length})` },
                  { id: 'shipping', label: `Хүргэлтэд (${orders.filter(o => o.status === 'shipping').length})` },
                  { id: 'delivered', label: `Хүргэгдсэн (${orders.filter(o => o.status === 'delivered').length})` },
                  { id: 'cancelled', label: `Цуцлагдсан (${orders.filter(o => o.status === 'cancelled').length})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setOrderStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      orderStatusFilter === f.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-stone-400">
                Сүүлийн захиалгууд эхэндээ харагдана
              </span>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const currentStatus = order.status || 'new';

                return (
                  <div
                    key={order.orderId}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all p-5 space-y-4"
                  >
                    {/* Top Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg">
                          #{order.orderId}
                        </span>
                        {getStatusBadge(currentStatus)}
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{order.date}</span>
                        </span>
                      </div>

                      {/* Status changer select */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500 font-semibold">Төлөв солих:</span>
                        <select
                          value={currentStatus}
                          onChange={(e) => onUpdateOrderStatus(order.orderId, e.target.value as any)}
                          className="text-xs font-bold border border-stone-300 rounded-xl px-2.5 py-1.5 bg-stone-50 focus:outline-none focus:border-rose-500 cursor-pointer"
                        >
                          <option value="new">Шинэ</option>
                          <option value="confirmed">Баталгаажсан</option>
                          <option value="shipping">Хүргэлтэд гарсан</option>
                          <option value="delivered">Хүргэгдсэн</option>
                          <option value="cancelled">Цуцлагдсан</option>
                        </select>
                      </div>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Customer Info */}
                      <div className="space-y-1">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Хэрэглэгч
                        </span>
                        <p className="font-bold text-stone-900 text-sm">{order.customerName}</p>
                        <a
                          href={`tel:${order.phone}`}
                          className="inline-flex items-center gap-1.5 text-rose-600 font-bold hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{order.phone} (Залгах)</span>
                        </a>
                      </div>

                      {/* Delivery Address */}
                      <div className="space-y-1">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Хүргэлтийн хаяг
                        </span>
                        <p className="font-semibold text-stone-800 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span>{order.district}, {order.address}</span>
                        </p>
                        {order.notes && (
                          <p className="text-stone-500 italic bg-amber-50 p-1.5 rounded text-[11px] border border-amber-100">
                            Тэмдэглэл: {order.notes}
                          </p>
                        )}
                      </div>

                      {/* Payment details */}
                      <div className="space-y-1 md:text-right">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Төлбөрийн хэлбэр
                        </span>
                        <p className="font-bold text-stone-800 uppercase">
                          {order.paymentMethod === 'qpay' ? 'QPay QR код' : order.paymentMethod === 'bank' ? 'Хаан банк дансаар' : 'Хүлээн авахдаа (COD)'}
                        </p>
                        <p className="text-sm font-black text-rose-600">
                          Нийт: {formatMNT(order.total)}
                        </p>
                      </div>
                    </div>

                    {/* Ordered Items Accordion / Summary */}
                    <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-2">
                      <span className="text-[11px] font-bold text-stone-700 block">
                        Захиалсан бараанууд ({order.items.reduce((sum, i) => sum + i.quantity, 0)} ширхэг):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 bg-white p-2.5 rounded-lg border border-stone-200/60">
                            <span className="w-12 h-10 shrink-0 rounded-md bg-stone-900 text-amber-300 flex items-center justify-center text-[10px] font-black">#{String(item.id).slice(-6).toUpperCase()}</span>
                            <div className="text-xs min-w-0 flex-1">
                              <p className="font-bold text-stone-900 truncate">{item.name}</p>
                              <p className="text-[11px] text-stone-500">
                                Нэгж: {formatMNT(item.price)} · Тоо: <strong className="text-stone-800">{item.quantity}</strong> · Нийт: {formatMNT(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                  <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                  <p className="font-bold text-stone-700 text-sm">Одоогоор захиалга байхгүй байна</p>
                  <p className="text-xs text-stone-400 mt-1">Хэрэглэгч вэбээс худалдан авалт хийхэд энд шууд бүртгэгдэнэ.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STATS TAB ================= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Stat metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Бараа
                </span>
                <span className="text-2xl sm:text-3xl font-black text-stone-900">{totalProducts}</span>
                <p className="text-[11px] text-emerald-600 font-medium">Бүртгэлтэй нийт нэр төрөл</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Бэлэн байгаа
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{inStockCount}</span>
                <p className="text-[11px] text-stone-500 font-medium">Худалдаанд идэвхтэй</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Захиалга
                </span>
                <span className="text-2xl sm:text-3xl font-black text-stone-900">{totalOrders}</span>
                <p className="text-[11px] text-amber-600 font-medium">{newOrdersCount} шинэ захиалга хүлээгдэж байна</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Орлого
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600">{formatMNT(totalRevenue)}</span>
                <p className="text-[11px] text-stone-500 font-medium">Бүртгэгдсэн худалдан авалт</p>
              </div>
            </div>

            {/* Origin & Category breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <h4 className="font-bold text-stone-900 text-sm">Гарал үүслийн харьцаа</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🇰🇷</span>
                      <span>БНСУ (Солонгос)</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      {products.filter(p => p.origin === 'KR').length} бараа
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full"
                      style={{ width: `${(products.filter(p => p.origin === 'KR').length / totalProducts) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🇺🇸</span>
                      <span>АНУ (Америк)</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      {products.filter(p => p.origin === 'US').length} бараа
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(products.filter(p => p.origin === 'US').length / totalProducts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <h4 className="font-bold text-stone-900 text-sm">Ангиллаарх барааны тоо</h4>
                <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => {
                    const count = products.filter(p => p.category === cat.id).length;
                    return (
                      <div key={cat.id} className="flex items-center justify-between py-1 border-b border-stone-100">
                        <span className="text-stone-600">{cat.name}</span>
                        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Loyalty Automatic Tier System Overview with quick switch */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Лояалти гишүүнчлэлийн автомат систем</h4>
                    <p className="text-[11px] text-stone-500">
                      Худалдан авалтын бодит нийлбэр дүнгээр автоматаар олгогдоно (Гараар сонгон турших боломжгүй)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openLoyaltyMembers}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs w-fit"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Гишүүдийг удирдах ({loyaltyMembers.length})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {loyaltyTiersConfig.map((tier) => (
                  <div 
                    key={tier.id} 
                    className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                        <span>{tier.badge}</span>
                      </span>
                      <span className="font-bold text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                        {tier.discount_pct}% Байнгын
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-600 font-medium">
                      Босго: <strong>{formatMNT(tier.threshold)}+</strong>
                    </div>
                    {tier.admin_gift && (
                      <div className="text-[10px] text-stone-500 pt-1 border-t border-stone-200/60 truncate">
                        🎁 {tier.admin_gift}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= LOYALTY TAB ================= */}
        {activeTab === 'loyalty' && (
          <div className="space-y-5">
            <div className="bg-stone-900 text-white p-5 rounded-2xl">
              <h3 className="font-black text-lg">Лояалти гишүүд</h3>
              <p className="text-sm text-stone-300 mt-1">Бүртгэлтэй гишүүд болон тухайн гишүүний төв санд хадгалагдсан захиалгууд.</p>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {memberProfiles.length === 0 ? (
                <div className="p-8 text-center text-stone-500">
                  <p className="font-bold">Гишүүний мэдээлэл татагдсангүй.</p>
                  <p className="text-xs mt-1">Админ и-мэйлээр нэвтэрсэн эсэхээ шалгаад хуудсаа шинэчилнэ үү.</p>
                </div>
              ) : memberProfiles.map((profile) => {
                const profileOrders = orders.filter((order) => order.customerId === profile.user_id);
                const approved = profileOrders.filter((order) => ['confirmed', 'shipping', 'delivered'].includes(order.status || 'new'));
                const totalSpent = approved.reduce((sum, order) => sum + order.total, 0);
                const tiers = [...loyaltyTiersConfig].sort((a, b) => a.threshold - b.threshold);
                const currentTier = [...tiers].reverse().find((tier) => totalSpent >= tier.threshold);
                const nextTier = tiers.find((tier) => totalSpent < tier.threshold);
                const previous = nextTier ? (tiers[tiers.indexOf(nextTier) - 1]?.threshold || 0) : totalSpent;
                const remaining = nextTier ? Math.max(0, nextTier.threshold - totalSpent) : 0;
                const progress = nextTier ? Math.min(100, Math.round((totalSpent - previous) * 100 / Math.max(1, nextTier.threshold - previous))) : 100;
                return (
                  <div key={profile.user_id} className="p-5 border-b border-stone-100 last:border-b-0 bg-linear-to-r from-white to-amber-50/30">
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="lg:w-56">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-stone-900 text-amber-300 flex items-center justify-center font-black">{(profile.name || 'Х').slice(0, 1).toUpperCase()}</div>
                          <div><p className="font-black text-stone-900">{profile.name || 'Хэрэглэгч'}</p><p className="text-xs text-stone-500">{profile.phone || 'Утас бүртгээгүй'}</p></div>
                        </div>
                        <p className="mt-2 text-xs text-stone-500">{profile.address || 'Хаяг бүртгээгүй'}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-white border border-stone-200 p-3"><p className="text-[10px] font-bold text-stone-400">БАТАЛГААЖСАН ХУДАЛДАН АВАЛТ</p><p className="mt-1 font-black">{formatMNT(totalSpent)}</p><p className="text-[11px] text-stone-500">{approved.length} захиалга</p></div>
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3"><p className="text-[10px] font-bold text-amber-700">ОДООГИЙН ТҮВШИН</p><p className="mt-1 font-black text-amber-900">{currentTier ? currentTier.badge : 'Стандарт'}</p><p className="text-[11px] text-amber-700">{currentTier ? currentTier.discount_pct + '% VIP' : 'VIP эрх нээгдээгүй'}</p></div>
                        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3"><p className="text-[10px] font-bold text-blue-700">ДАРААГИЙН ТҮВШИН</p><p className="mt-1 font-black text-blue-900">{nextTier ? nextTier.badge : 'Дээд түвшин'}</p><p className="text-[11px] text-blue-700">{nextTier ? formatMNT(remaining) + ' дутуу' : 'Бүх шатанд хүрсэн'}</p></div>
                      </div>
                    </div>
                    <div className="mt-4 h-2 bg-stone-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-linear-to-r from-amber-400 to-rose-500" style={{ width: progress + '%' }} /></div>
                    {nextTier && <p className="mt-1 text-[11px] text-stone-500"><strong>{nextTier.name}</strong> түвшинд хүрэхэд {formatMNT(remaining)}-ийн худалдан авалт дутуу.</p>}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-black text-stone-800">Захиалсан барааны дэлгэрэнгүй</p>
                      {profileOrders.length === 0 ? <p className="text-xs text-stone-400">Захиалга бүртгэгдээгүй.</p> : profileOrders.map((order) => (
                        <div key={order.orderId} className="rounded-xl border border-stone-200 bg-white p-3">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><span className="font-mono font-bold">#{order.orderId.slice(0, 8)}</span><span className="font-black">{formatMNT(order.total)}</span><span className="font-bold text-emerald-700">{order.status === 'delivered' ? 'Хүргэгдсэн' : order.status === 'shipping' ? 'Хүргэлтэд' : order.status === 'confirmed' ? 'Баталгаажсан' : order.status === 'cancelled' ? 'Цуцалсан' : 'Шинэ'}</span><span className="text-stone-500">{order.date}</span></div>
                          <div className="mt-2 flex flex-wrap gap-1.5">{order.items.map((item) => <span key={item.id} className="px-2 py-1 rounded-lg bg-stone-50 border border-stone-200 text-[11px]">{item.name} <strong>×{item.quantity}</strong> · {formatMNT(item.price * item.quantity)}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy loyalty analytics kept disabled while the central member view is active. */}
        {false && activeTab === 'loyalty' && (
          <div className="space-y-6">
            {/* Loyalty Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-stone-500 font-medium">Нийт гишүүд</span>
                  <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-stone-900">
                  {loyaltyMembers.length}
                </div>
                <p className="text-[10px] text-stone-400 mt-1">Захиалга өгсөн нийт хэрэглэгч</p>
              </div>

              {loyaltyTiersConfig.map((tier) => (
                <div 
                  key={tier.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-stone-800 font-semibold truncate">{tier.badge} ({tier.discount_pct}%)</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">
                    {loyaltyMembers.filter((m) => m.tier?.id === tier.id).length}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">{formatMNT(tier.threshold)}-с дээш</p>
                </div>
              ))}

              <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-linear-to-b from-rose-50/40 to-white shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-rose-800 font-semibold">💎 Нийт оноо</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-900">
                  {loyaltyMembers.reduce((sum, m) => sum + m.totalPoints, 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-rose-600/80 mt-1">Админы олгосон бонус оноо</p>
              </div>
            </div>

            {/* Loyalty System Rules Banner */}
            <div className="bg-linear-to-r from-stone-900 to-stone-800 text-white p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-black">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                      <span>Автомат Лояалти Зэрэглэлийн Дүрэм</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                        Админ Засвар Нээлттэй
                      </span>
                    </h3>
                    <p className="text-xs text-stone-300">
                      Хэрэглэгч системд нэвтрэхэд бодит худалдан авалтын дүнгээр зэрэглэл автоматаар тооцогдож, сагсанд хөнгөлөлт шууд хасагдана.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Settings className="w-4 h-4" />
                  <span>Үндсэн тохиргоо руу очих</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-stone-700/80 text-xs">
                {loyaltyTiersConfig.map((tier) => (
                  <div 
                    key={tier.id}
                    className="bg-stone-800/80 p-3 rounded-xl border border-stone-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-amber-300 flex items-center gap-1">
                        <span>{tier.badge}</span>
                        <span className="text-stone-300 font-normal">({formatMNT(tier.threshold)}+)</span>
                      </div>
                      <div className="text-[11px] text-stone-400">Бүх бараанаас {tier.discount_pct}% байнгын хөнгөлөлт</div>
                      {tier.admin_gift && (
                        <div className="text-[10px] text-stone-400 truncate max-w-[190px] mt-0.5">🎁 {tier.admin_gift}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <span className="text-xs font-black text-white bg-stone-700 px-2 py-1 rounded-lg">{tier.discount_pct}%</span>
                      
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Loyalty Members Filter & Search */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Хэрэглэгчийн нэр, имэйл хаяг, утсаар хайх..."
                  value={loyaltySearch}
                  onChange={(e) => setLoyaltySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 bg-stone-50"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-stone-500 mr-1 whitespace-nowrap">Шүүлт:</span>
                {[
                  { id: 'all', label: 'Бүгд' },
                  { id: 'gold', label: '🥇 Алт' },
                  { id: 'silver', label: '🥈 Мөнгө' },
                  { id: 'bronze', label: '🥉 Хүрэл' },
                  { id: 'standard', label: 'Стандарт' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLoyaltyFilter(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap transition-all ${
                      loyaltyFilter === tab.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loyalty Members Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Гишүүнчлэлийн жагсаалт</h4>
                  <p className="text-xs text-stone-500">
                    Илэрц: <strong>{filteredLoyaltyMembers.length}</strong> хэрэглэгч
                  </p>
                </div>
                <div className="text-xs text-stone-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Оноо зөвхөн админаас олгосон бонусоор нэмэгдэнэ</span>
                </div>
              </div>

              {filteredLoyaltyMembers.length === 0 ? (
                <div className="p-12 text-center text-stone-400 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-sm font-semibold text-stone-600">Тохирох гишүүн олдсонгүй</p>
                  <p className="text-xs text-stone-400">Хайлтын утгаа өөрчлөх эсвэл шүүлтүүрээ арилгана уу.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredLoyaltyMembers.map((member) => (
                    <div key={member.id} className="p-4 sm:p-5 hover:bg-stone-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Member Info */}
                      <div className="flex items-start sm:items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          member.tier?.id === 'gold'
                            ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                            : member.tier?.id === 'silver'
                            ? 'bg-slate-100 text-slate-800 border-2 border-slate-300'
                            : member.tier?.id === 'bronze'
                            ? 'bg-amber-900/10 text-amber-900 border-2 border-amber-700/30'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {member.tier ? member.tier.badge.split(' ')[0] : '👤'}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-stone-900 text-sm">{member.name}</span>
                            {member.tier ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 ${
                                member.tier.id === 'gold'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : member.tier.id === 'silver'
                                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                  : 'bg-amber-900/10 text-amber-900 border border-amber-700/30'
                              }`}>
                                {member.tier.badge} ({member.tier.discount_pct}% хөнгөлөлт)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                                Стандарт гишүүн
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                            {member.email && (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-stone-600">
                                <Mail className="w-3 h-3 text-stone-400" />
                                {member.email}
                              </span>
                            )}
                            {member.phone && (
                              <span className="flex items-center gap-1 text-stone-600">
                                <Phone className="w-3 h-3 text-stone-400" />
                                {member.phone}
                              </span>
                            )}
                            <span>Сүүлийн захиалга: <strong>{member.lastOrderDate}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Financial & Loyalty Progress */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 bg-stone-50/80 p-3 rounded-xl border border-stone-200/60 text-xs">
                        <div>
                          <span className="text-[10px] text-stone-400 font-semibold block uppercase tracking-wider">Нийт худалдан авалт</span>
                          <span className="font-black text-stone-900 text-sm">{formatMNT(member.totalSpent)}</span>
                          <span className="block text-[10px] text-stone-500">{member.orderCount} захиалга ({member.deliveredCount} амжилттай)</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-stone-400 font-semibold block uppercase tracking-wider">Лояалти оноо</span>
                          <div className="flex items-center gap-1">
                            <span className="font-black text-rose-600 text-sm">{member.totalPoints.toLocaleString()}</span>
                            <span className="text-[10px] text-stone-500">оноо</span>
                          </div>
                          <span className="block text-[10px] text-stone-400">
                            {member.bonusPoints > 0 ? `Бонус: +${member.bonusPoints.toLocaleString()}` : 'Бонус оноо олгогдоогүй'}
                          </span>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-stone-400 font-semibold block uppercase tracking-wider">Дараагийн зэрэглэл</span>
                          {member.nextTier ? (
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-bold text-stone-700 mb-1">
                                <span>{member.nextTier.name}</span>
                                <span className="text-amber-600">{formatMNT(member.nextTier.remaining)} дутуу</span>
                              </div>
                              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-amber-500 h-full rounded-full transition-all"
                                  style={{ width: `${member.nextTier.progressPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 pt-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Дээд зэрэглэл (VIP)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Admin Override Actions */}
                      <div className="flex items-center gap-2 pt-2 lg:pt-0 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedMemberId((id) => id === member.id ? null : member.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {expandedMemberId === member.id ? 'Захиалга хаах' : `Захиалга (${member.orderCount})`}
                        </button>
                        <button
                          onClick={() => {
                            setBonusTarget({
                              email: member.email || member.id,
                              name: member.name,
                              currentPoints: member.totalPoints
                            });
                            setBonusAmountInput(5000);
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                          title="Хэрэглэгчид бонус оноо бэлэглэх"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>Бонус оноо</span>
                        </button>

                        <button
                          onClick={() => {
                            setTierOverrideTarget({
                              email: member.email || member.id,
                              name: member.name,
                              currentTierId: member.tier?.id || 'auto'
                            });
                          }}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                          title="VIP зэрэглэлийг шууд олгох эсвэл өөрчлөх"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>VIP Зэрэглэл</span>
                        </button>
                      </div>
                      {expandedMemberId === member.id && (
                        <div className="w-full lg:col-span-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs">
                          <p className="font-bold text-stone-800 mb-2">Гишүүний захиалгын түүх</p>
                          {member.orders.length === 0 ? (
                            <p className="text-stone-500">Захиалга бүртгэгдээгүй байна.</p>
                          ) : member.orders.map((order) => (
                            <div key={order.orderId} className="flex flex-wrap justify-between gap-2 border-t border-blue-100 py-2 first:border-t-0">
                              <span className="font-mono font-bold text-stone-700">#{order.orderId}</span>
                              <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} бараа · {formatMNT(order.total)}</span>
                              <span className="font-bold text-blue-700">{order.status === 'delivered' ? 'Хүргэгдсэн' : order.status === 'shipping' ? 'Хүргэлтэд' : order.status === 'confirmed' ? 'Баталгаажсан' : order.status === 'cancelled' ? 'Цуцалсан' : 'Шинэ'}</span>
                              <span className="text-stone-500">{order.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SETTINGS & SECURITY TAB ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            {/* Store Branding (Official Logo & Physical Store Banner) */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">Дэлгүүрийн Албан Ёсны Лого & Хаяг Баннер</h4>
                    <p className="text-xs text-stone-500">Өөрийн жинхэнэ LOGO.png болон delguur_hayg.png файлуудыг ямар ч өөрчлөлтгүйгээр шууд оруулах</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                  100% Оригинал
                </span>
              </div>

              {brandingStatusMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{brandingStatusMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. LOGO UPLOAD */}
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                      <span>1. Албан ёсны Лого (LOGO.png)</span>
                    </span>
                    {customLogoUrl && (
                      <button
                        onClick={() => handleResetBranding('logo')}
                        className="text-[11px] text-rose-600 hover:underline font-bold"
                      >
                        Сэргээх
                      </button>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="h-28 w-full bg-stone-900 rounded-xl flex items-center justify-center p-2 border border-stone-800 overflow-hidden">
                    {customLogoUrl ? (
                      <img
                        src={customLogoUrl}
                        alt="Custom Logo"
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-stone-400">
                        <ImageIcon className="w-6 h-6 text-stone-500" />
                        <span className="text-[10px]">Та өөрийн LOGO.png файлаа энд сонгоно уу</span>
                      </div>
                    )}
                  </div>

                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-stone-100 text-stone-900 text-xs font-bold rounded-xl border border-stone-300 cursor-pointer shadow-2xs transition-all">
                    <Upload className="w-4 h-4 text-amber-500" />
                    <span>{customLogoUrl ? 'LOGO.png файлаа дахин солих' : 'LOGO.png файл сонгож оруулах'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingBranding}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadBrandingImage('logo', e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-stone-500 text-center">
                    Таны оруулсан файл яг тэр чигтээ дээд навигаци, доод footer, баннер дээр харагдана.
                  </p>
                </div>

                {/* 2. STORE BANNER UPLOAD */}
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                      <span>2. Дэлгүүрийн Хаяг (delguur_hayg.png)</span>
                    </span>
                    {customBannerUrl && (
                      <button
                        onClick={() => handleResetBranding('banner')}
                        className="text-[11px] text-rose-600 hover:underline font-bold"
                      >
                        Сэргээх
                      </button>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="h-28 w-full bg-stone-900 rounded-xl flex items-center justify-center p-2 border border-stone-800 overflow-hidden">
                    {customBannerUrl ? (
                      <img
                        src={customBannerUrl}
                        alt="Custom Store Banner"
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-stone-400">
                        <ImageIcon className="w-6 h-6 text-stone-500" />
                        <span className="text-[10px]">Та өөрийн delguur_hayg.png файлаа энд сонгоно уу</span>
                      </div>
                    )}
                  </div>

                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-stone-100 text-stone-900 text-xs font-bold rounded-xl border border-stone-300 cursor-pointer shadow-2xs transition-all">
                    <Upload className="w-4 h-4 text-indigo-500" />
                    <span>{customBannerUrl ? 'Хаяг баннераа дахин солих' : 'delguur_hayg.png файл сонгох'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingBranding}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadBrandingImage('banner', e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-stone-500 text-center">
                    Нүүр хуудасны дээд талд таны дэлгүүрийн жинхэнэ хаяг ямар ч өөрчлөлтгүй шууд тавигдана.
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery & bank transfer settings */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-stone-900 text-sm">Хүргэлт ба дансаар төлөх тохиргоо</h4>
                  <p className="text-xs text-stone-500">Энд хадгалсан мэдээлэл хэрэглэгчийн захиалга төлөх хэсэгт гарна.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-bold text-stone-700">Хүргэлтийн төлбөр (₮)
                  <input type="number" min="0" value={checkoutDraft.deliveryFee}
                    onChange={(e) => setCheckoutDraft((value) => ({ ...value, deliveryFee: Math.max(0, Number(e.target.value) || 0) }))}
                    className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
                <label className="text-xs font-bold text-stone-700">Дэлгүүрийн холбоо барих утас
                  <input type="tel" value={checkoutDraft.storePhone} onChange={(e) => setCheckoutDraft((value) => ({ ...value, storePhone: e.target.value }))}
                    placeholder="Жишээ: 7700-1122" className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
                <label className="text-xs font-bold text-stone-700">Банкны нэр
                  <input value={checkoutDraft.bankName} onChange={(e) => setCheckoutDraft((value) => ({ ...value, bankName: e.target.value }))}
                    placeholder="Жишээ: Хаан банк" className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
                <label className="text-xs font-bold text-stone-700">Дансны дугаар
                  <input value={checkoutDraft.accountNumber} onChange={(e) => setCheckoutDraft((value) => ({ ...value, accountNumber: e.target.value }))}
                    placeholder="0000 0000 0000" className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
                <label className="text-xs font-bold text-stone-700">IBAN
                  <input value={checkoutDraft.iban} onChange={(e) => setCheckoutDraft((value) => ({ ...value, iban: e.target.value }))}
                    placeholder="MN..." className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
                <label className="text-xs font-bold text-stone-700 sm:col-span-2">Данс эзэмшигчийн нэр
                  <input value={checkoutDraft.accountHolder} onChange={(e) => setCheckoutDraft((value) => ({ ...value, accountHolder: e.target.value }))}
                    placeholder="Компанийн нэр / данс эзэмшигч" className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50" />
                </label>
              </div>
              {checkoutSettingsMessage && <p className="text-xs font-bold text-emerald-700">{checkoutSettingsMessage}</p>}
              <button type="button" onClick={() => {
                if (!onSaveCheckoutSettings) return;
                Promise.resolve(onSaveCheckoutSettings(checkoutDraft))
                  .then(() => setCheckoutSettingsMessage('Төв санд хадгаллаа.'))
                  .catch(() => setCheckoutSettingsMessage('Хадгалах эрх эсвэл холболтын алдаа гарлаа.'));
              }} className="px-4 py-2.5 bg-stone-900 text-white text-xs font-bold rounded-xl cursor-pointer">
                Хүргэлт, дансны мэдээлэл хадгалах
              </button>
            </div>

            {/* Admin Security & Session Status */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">Админ Системийн Хамгаалалт & Аюулгүй Байдал</h4>
                    <p className="text-xs text-stone-500">Нэвтрэлтийн сесс, ПИН хамгаалалт, автомат түгжээ</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Идэвхтэй хамгаалагдсан
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-stone-500 text-[11px] font-medium">Сессийн автомат түгжээ</span>
                  <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>{Math.floor(idleTimeRemaining / 60)} мин {idleTimeRemaining % 60} сек</span>
                  </div>
                  <p className="text-[10px] text-stone-400">15 мин идэвхгүй үед автоматаар түгжинэ</p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-stone-500 text-[11px] font-medium">Сүүлд нэвтэрсэн</span>
                  <div className="font-bold text-stone-900 text-xs truncate">
                    {lastLoginTime}
                  </div>
                  <p className="text-[10px] text-stone-400">Аудит бүртгэлд хадгалагдсан</p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-stone-500 text-[11px] font-medium">ПИН кодны статус</span>
                  <div className="font-bold text-xs">
                    {adminPin === '1234' ? (
                      <span className="text-amber-600 font-extrabold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Анхдагч (1234)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Өөрчилж хамгаалсан
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400">
                    {adminPin === '1234' ? 'Шинэ кодоор солихыг зөвлөж байна' : 'Хамгаалалт өндөр түвшинд'}
                  </p>
                </div>
              </div>

              {onLogout && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-4 py-2 bg-stone-100 hover:bg-rose-50 text-rose-700 hover:text-rose-800 text-xs font-bold rounded-xl border border-stone-200 hover:border-rose-200 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Админ эрхээс яг одоо гарах</span>
                  </button>
                </div>
              )}
            </div>

            {/* PIN Change Section with 3-Step Verification */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-800">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Админ ПИН код солих (Баталгаажуулалттай)</h4>
                  <p className="text-xs text-stone-500">Админ нэвтрэх 4 оронтой нууц кодоо шинэчлэх</p>
                </div>
              </div>

              {pinChangeMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{pinChangeMsg}</span>
                </div>
              )}

              {pinChangeError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold">{pinChangeError}</span>
                </div>
              )}

              <form onSubmit={handleSavePin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    1. Одоогийн хуучин ПИН код
                  </label>
                  <input
                    type="password"
                    placeholder="Одоо ашиглаж буй ПИН (Анхдагч: 1234)"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono tracking-widest bg-stone-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      2. Шинэ ПИН код (Дор хаяж 4 орон)
                    </label>
                    <input
                      type="password"
                      placeholder="Жишээ: 8899"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono tracking-widest"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      3. Шинэ ПИН код давтан оруулах
                    </label>
                    <input
                      type="password"
                      placeholder="Шинэ кодоо дахин бичнэ үү"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono tracking-widest"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>ПИН кодыг баталгаажуулж хадгалах</span>
                </button>
              </form>
            </div>

            {/* Reset to default catalog */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Каталогийг анхны хэвэнд нь оруулах</h4>
                  <p className="text-xs text-stone-500">Хэрэв өгөгдлөө алдаатай оруулсан бол анхдагч 24 барааг буцааж сэргээнэ</p>
                </div>
              </div>

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Анхны каталогийг сэргээх
                </button>
              ) : (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-3 text-xs text-rose-900">
                  <p className="font-bold">Та өөрийн нэмсэн болон өөрчилсөн бараануудыг устгаад анхны төлөвт нь оруулахдаа итгэлтэй байна уу?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onResetProducts();
                        setShowResetConfirm(false);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Тийм, сэргээ
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3.5 py-1.5 bg-white border border-stone-300 text-stone-700 font-bold rounded-lg cursor-pointer"
                    >
                      Болих
                    </button>
                  </div>
                </div>
              )}
              {/* Loyalty System Configuration in Settings */}
              <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Лояалти Зэрэглэл & Урамшууллын Дүрэм</h4>
                      <p className="text-[11px] text-stone-500">
                        Босго дүн, хөнгөлөлтийн хувь, тусгай бэлэг, кэшбэк хувийг эндээс тохируулна.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRulesModalOpen(true)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs w-fit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Дүрэм засах</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 font-bold block">Суурь кэшбэк</span>
                    <span className="text-xs font-black text-rose-600">{cashbackPctConfig}%</span>
                  </div>
                  {loyaltyTiersConfig.map((tier) => (
                    <div key={tier.id} className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                      <span className="text-[10px] text-stone-500 font-bold block truncate">{tier.badge}</span>
                      <span className="text-xs font-black text-stone-900">{formatMNT(tier.threshold)}</span>
                      <span className="text-[10px] text-amber-600 font-bold ml-1">(-{tier.discount_pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bonus Points Reward Modal */}
      {bonusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-stone-900 text-sm">Бонус оноо олгох</h4>
              </div>
              <button
                onClick={() => setBonusTarget(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-stone-600">
                Хэрэглэгч: <strong className="text-stone-900">{bonusTarget.name}</strong>
              </p>
              <p className="text-stone-500 font-mono text-[11px]">{bonusTarget.email}</p>
              <p className="text-stone-600">
                Одоогийн нийт оноо: <strong className="text-rose-600">{bonusTarget.currentPoints.toLocaleString()}</strong> оноо
              </p>
            </div>

            {bonusSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{bonusSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Нэмж олгох бонус оноо (₮):
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBonusAmountInput(amt)}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border cursor-pointer ${
                      bonusAmountInput === amt
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="500"
                step="500"
                value={bonusAmountInput}
                onChange={(e) => setBonusAmountInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBonusTarget(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={() => handleGrantBonus(bonusTarget.email, bonusAmountInput)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Оноо олгох</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Tier Override Modal */}
      {tierOverrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-stone-900 text-sm">VIP Зэрэглэл Тохируулах</h4>
              </div>
              <button
                onClick={() => setTierOverrideTarget(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="text-stone-600">
                Хэрэглэгч: <strong className="text-stone-900">{tierOverrideTarget.name}</strong>
              </p>
              <p className="text-stone-500 font-mono text-[11px]">{tierOverrideTarget.email}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Олгох зэрэглэлийг сонгоно уу:
              </label>
              <div className="space-y-1.5">
                {[
                  { id: 'auto', name: '⚡ Автомат горим', desc: 'Худалдан авалтын бодит дүнгээр' },
                  { id: 'bronze', name: '🥉 Хүрэл гишүүн', desc: '2% байнгын хөнгөлөлт' },
                  { id: 'silver', name: '🥈 Мөнгөн гишүүн', desc: '3% байнгын хөнгөлөлт' },
                  { id: 'gold', name: '🥇 Алтан VIP гишүүн', desc: '5% байнгын VIP хөнгөлөлт' }
                ].map((tierOpt) => (
                  <button
                    key={tierOpt.id}
                    type="button"
                    onClick={() => handleSetTierOverride(tierOverrideTarget.email, tierOpt.id)}
                    className="w-full text-left p-2.5 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-stone-900">{tierOpt.name}</div>
                      <div className="text-[11px] text-stone-500">{tierOpt.desc}</div>
                    </div>
                    {tierOverrideTarget.currentTierId === tierOpt.id && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setTierOverrideTarget(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Rules Configuration Modal */}
      <LoyaltyRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        tiers={loyaltyTiersConfig}
        cashbackPct={cashbackPctConfig}
        onSave={(updatedTiers, updatedCashback) => {
          setLoyaltyTiersConfig(updatedTiers);
          setCashbackPctConfig(updatedCashback);
        }}
      />

      {/* Product Form Modal (Add / Edit) */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={editingProduct}
        onSave={onSaveProduct}
      />

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-stone-900 text-base">Энэ барааг устгах уу?</h4>
            <p className="text-xs text-stone-500">
              Барааг устгаснаар дэлгүүрийн жагсаалтаас бүрмөсөн хасагдана.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Болих
              </button>
              <button
                onClick={() => confirmDelete(deletingProductId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Award, 
  Check, 
  Gift, 
  Calendar, 
  Sparkles, 
  Lock, 
  ShoppingBag, 
  ShieldCheck, 
  TrendingUp, 
  Phone, 
  Mail,
  UserCheck,
  User,
  ArrowRight,
  LogOut,
  KeyRound,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  LOYALTY_TIERS, 
  formatMNT, 
  getStoredLoyaltyTiers, 
  getStoredCashbackPct, 
  calculateLoyaltyTierBySpent 
} from '../data/storeData';
import { LoyaltyTier, OrderDetails, UserProfile } from '../types';

interface LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderDetails[];
  currentUser: UserProfile | null;
  onOpenProfile?: () => void;
  onLoginUser?: (user: UserProfile) => void;
  onLogoutUser?: () => void;
}

export const LoyaltyModal: React.FC<LoyaltyModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentUser,
  onOpenProfile,
  onLoginUser,
  onLogoutUser
}) => {
  // Login form state when user is not logged in
  const [loginStep, setLoginStep] = useState<'input' | 'otp'>('input');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Reset inputs when modal opens or user logs out
  useEffect(() => {
    if (isOpen) {
      setLoginError('');
      setOtpInput('');
      if (!currentUser) {
        setLoginStep('input');
      }
    }
  }, [isOpen, currentUser]);

  // Clean email of the currently logged in user
  const userEmailClean = currentUser?.email ? currentUser.email.trim().toLowerCase() : '';

  // Filter orders strictly for the logged-in user's email
  const userOrders = useMemo(() => {
    if (!userEmailClean) return [];
    return orders.filter((o) => o.email && o.email.trim().toLowerCase() === userEmailClean);
  }, [orders, userEmailClean]);

  // Account-specific spent
  const accountSpent = useMemo(() => {
    return userOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [userOrders]);

  const ordersCount = userOrders.length;

  // Read admin bonuses or tier overrides from localStorage
  const adminOverride = useMemo(() => {
    if (!userEmailClean) return null;
    try {
      const saved = localStorage.getItem('usk_loyalty_bonuses');
      if (saved) {
        const bonuses = JSON.parse(saved);
        return bonuses[userEmailClean] || null;
      }
    } catch {
      // ignore
    }
    return null;
  }, [userEmailClean]);

  const [tiersConfig, setTiersConfig] = useState<LoyaltyTier[]>(() => getStoredLoyaltyTiers());
  const [cashbackRate, setCashbackRate] = useState<number>(() => getStoredCashbackPct());

  useEffect(() => {
    const handleSync = () => {
      setTiersConfig(getStoredLoyaltyTiers());
      setCashbackRate(getStoredCashbackPct());
    };
    window.addEventListener('usk_loyalty_config_updated', handleSync);
    return () => window.removeEventListener('usk_loyalty_config_updated', handleSync);
  }, []);

  const bonusPoints = adminOverride?.bonusPoints || 0;
  const cashPoints = Math.floor(accountSpent * (cashbackRate / 100));
  const totalPoints = cashPoints + bonusPoints;

  // Active loyalty for the logged-in user
  const activeLoyalty = useMemo<LoyaltyTier | null>(() => {
    if (!currentUser || !userEmailClean) return null;
    if (adminOverride?.forceTier) {
      const forced = tiersConfig.find((t) => t.id === adminOverride.forceTier);
      if (forced) return forced;
    }
    return calculateLoyaltyTierBySpent(accountSpent, tiersConfig);
  }, [currentUser, userEmailClean, accountSpent, adminOverride, tiersConfig]);

  // Check existing orders matching unauthenticated input email
  const inputEmailClean = emailInput.trim().toLowerCase();

  const detectedInputOrders = useMemo(() => {
    if (!inputEmailClean || !inputEmailClean.includes('@')) return [];
    return orders.filter((o) => o.email && o.email.trim().toLowerCase() === inputEmailClean);
  }, [orders, inputEmailClean]);

  const detectedInputSpent = useMemo(() => {
    return detectedInputOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [detectedInputOrders]);

  // Calculate next tier and remaining amount dynamically from tiersConfig (sorted asc by threshold)
  const sortedAscTiers = useMemo(() => {
    return [...tiersConfig].sort((a, b) => a.threshold - b.threshold);
  }, [tiersConfig]);

  const targetNextTier = sortedAscTiers.find((t) => accountSpent < t.threshold) || null;
  let nextTier: LoyaltyTier | null = targetNextTier;
  let remainingForNext = 0;
  let overallProgressPct = 0;

  if (targetNextTier) {
    remainingForNext = targetNextTier.threshold - accountSpent;
    const prevThresholdIndex = sortedAscTiers.indexOf(targetNextTier) - 1;
    const prevThreshold = prevThresholdIndex >= 0 ? sortedAscTiers[prevThresholdIndex].threshold : 0;
    const span = targetNextTier.threshold - prevThreshold;
    const progress = Math.max(0, accountSpent - prevThreshold);
    overallProgressPct = span > 0 ? Math.min(100, Math.round((progress / span) * 100)) : 100;
  } else {
    nextTier = null;
    remainingForNext = 0;
    overallProgressPct = 100;
  }

  // Mask helpers
  const maskPhone = (phoneStr: string) => {
    const clean = phoneStr.replace(/\D/g, '');
    if (clean.length === 8) {
      return clean.slice(0, 4) + '****';
    }
    return phoneStr;
  };

  const maskEmail = (emailStr?: string) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr || '';
    const parts = emailStr.split('@');
    const namePart = parts[0];
    const masked = namePart.length > 2 ? namePart.slice(0, 2) + '***' : namePart + '***';
    return masked + '@' + parts[1];
  };

  // Handle request OTP in modal
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!nameInput.trim()) {
      setLoginError('Та өөрийн нэрээ оруулна уу.');
      return;
    }

    const cleanMail = emailInput.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@') || !cleanMail.includes('.')) {
      setLoginError('Зөв и-мэйл хаяг оруулна уу (жишээ нь: bat@gmail.com).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanMail, name: nameInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'И-мэйл илгээхэд алдаа гарлаа.');
      }

      setGeneratedOtp(data.previewCode || '');
      setOtpNotice(data.message || `${cleanMail} хаяг руу 6 оронтой баталгаажуулах код амжилттай илгээгдлээ!`);
      setLoginStep('otp');
    } catch (err: any) {
      setLoginError(err.message || 'Сүлжээний алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verify OTP in modal
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const enteredOtp = otpInput.trim();
    if (!enteredOtp) {
      setLoginError('Баталгаажуулах кодоо оруулна уу.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), code: enteredOtp }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Баталгаажуулах код буруу байна.');
      }

      const newUser: UserProfile = {
        id: 'usr_' + Date.now(),
        name: nameInput.trim(),
        email: emailInput.trim().toLowerCase(),
        loginMethod: 'email',
        address: '',
        district: 'Өмнөговь, Даланзадгад',
        createdAt: new Date().toLocaleDateString('mn-MN'),
        isVerified: true,
        privacyMasking: true
      };

      if (onLoginUser) {
        onLoginUser(newUser);
      } else {
        localStorage.setItem('usk_current_user', JSON.stringify(newUser));
      }
    } catch (err: any) {
      setLoginError(err.message || 'Баталгаажуулахад алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="loyalty-modal-overlay"
    >
      <div 
        id="loyalty-modal-container"
        className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-2xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black tracking-tight">Лояалти Гишүүнчлэлийн Хөтөлбөр</h3>
                {currentUser ? (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    ✓ Нэвтэрсэн
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Нэвтрэх шаардлагатай
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-300">
                {currentUser 
                  ? `${currentUser.name} (${currentUser.email ? maskEmail(currentUser.email) : maskPhone(currentUser.phone)}) бүртгэлийн худалдан авалтын түүх & хөнгөлөлт`
                  : 'Үнэгүй И-мэйл эсвэл утсаар нэвтэрсний дараа таны худалдан авалтын түүх & зэрэглэл нээгдэнэ'}
              </p>
            </div>
          </div>
          <button
            id="loyalty-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* CASE 1: USER IS NOT LOGGED IN -> REQUIRE EMAIL / PHONE LOGIN */}
          {!currentUser ? (
            <div className="py-2 space-y-5 animate-in fade-in duration-200">
              {/* Lock Gate Notice Card */}
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-800 space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-700">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-amber-950">
                      Худалдан Авалтын Дүнгээр Шууд Лояалти Хөнгөлөлт Олгогдоно
                    </h4>
                    <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                      Манай дэлгүүрийн бүх хөнгөлөлт (<strong>Хүрэл 2%</strong>, <strong>Мөнгөн 3%</strong>, <strong>Алтан VIP 5%</strong>) болон 1% буцаан олголтын оноо нь таны хувийн хаяг дээр <strong>автоматаар бүртгэгддэг</strong>.
                    </p>
                    <p className="text-xs text-amber-800/80 mt-1">
                      Зэрэглэл, хуримтлагдсан оноогоо харахын тулд өөрийн И-мэйл хаяг эсвэл утасны дугаараараа нэвтэрнэ үү.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seamless In-Modal Login Form */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-stone-900 text-xs">
                      {loginStep === 'input' 
                        ? '✉️ И-мэйл хаягаар нэвтрэх (Үнэгүй OTP)' 
                        : '🔒 6 оронтой кодоор баталгаажуулах'}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    100% Үнэгүй И-мэйл код ✓
                  </span>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {loginStep === 'input' ? (
                  <form onSubmit={handleRequestOtp} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Таны нэр <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={nameInput}
                          onChange={(e) => {
                            setNameInput(e.target.value);
                            setLoginError('');
                          }}
                          placeholder="Жишээ: Батбаяр"
                          className="w-full px-4 py-2.5 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900"
                        />
                        <User className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Цахим шуудан (И-мэйл хаяг) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => {
                            setEmailInput(e.target.value);
                            setLoginError('');
                          }}
                          placeholder="Жишээ: bat@gmail.com"
                          className="w-full px-4 py-2.5 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900"
                        />
                        <Mail className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        Баталгаажуулах 6 оронтой код таны и-мэйл рүү үнэгүй илгээгдэнэ.
                      </span>
                    </div>

                    {/* Detected prior orders for typed email */}
                    {detectedInputOrders.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                        <span className="font-medium">
                          ✨ Энэ и-мэйл хаягт өмнө нь <strong>{detectedInputOrders.length} захиалга</strong> бүртгэгдсэн байна.
                        </span>
                        <span className="font-bold text-emerald-700">
                          {formatMNT(detectedInputSpent)}
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          <span>И-мэйл код илгээж байна...</span>
                        </>
                      ) : (
                        <>
                          <span>И-мэйл код авах (Үнэгүй OTP)</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                      <p className="text-[11px] text-amber-900 font-medium">
                        {otpNotice || `Таны ${emailInput} хаяг руу илгээсэн нэг удаагийн кодыг оруулна уу.`}
                      </p>
                      {generatedOtp && (
                        <div className="font-bold text-amber-900 flex items-center justify-between pt-1">
                          <span>Туршилтын баталгаажуулах код:</span>
                          <span className="font-mono text-base font-black text-rose-600 bg-white px-2.5 py-0.5 rounded-lg border border-amber-300">
                            {generatedOtp}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        6 оронтой код оруулах
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.trim())}
                        placeholder="------"
                        className="w-full px-4 py-3 text-center text-xl tracking-widest font-mono font-bold bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLoginStep('input')}
                        className="flex-1 py-2.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Буцах
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Шалгаж байна...</span>
                          </>
                        ) : (
                          <>
                            <Award className="w-4 h-4" />
                            <span>Нэвтэрч Лояалти Үзэх</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Alternative trigger to open main profile modal */}
              {onOpenProfile && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProfile();
                    }}
                    className="text-xs text-stone-600 hover:text-stone-900 font-semibold underline cursor-pointer"
                  >
                    Эсвэл "Хэрэглэгчийн Бүртгэл & Нууцлал" цонхоор нэвтрэх
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CASE 2: USER IS LOGGED IN -> SHOW FULL PERSONALIZED LOYALTY PROGRAM */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Logged in User Bar */}
              <div className="p-3.5 bg-stone-100 rounded-2xl border border-stone-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-stone-800">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    Нэвтэрсэн хэрэглэгч: <strong>{currentUser.name}</strong> ({currentUser.email ? maskEmail(currentUser.email) : maskPhone(currentUser.phone)})
                  </span>
                </div>
                {onLogoutUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogoutUser();
                    }}
                    className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-rose-600 transition-colors cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Бүртгэлээс гарах</span>
                  </button>
                )}
              </div>

              {/* User's Purchase History & Loyalty Summary Card */}
              <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white rounded-2xl p-5 shadow-md border border-stone-700/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-700/60">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-stone-400 tracking-wider">
                      Таны нийт худалдан авалтын дүн
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-0.5">
                      {formatMNT(accountSpent)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-300 flex-wrap">
                      <ShoppingBag className="w-3.5 h-3.5 text-stone-400" />
                      <span>Нийт бүртгэгдсэн: <strong>{ordersCount} захиалга</strong></span>
                      <span>•</span>
                      <span>Оноо: <strong className="text-amber-300">{totalPoints.toLocaleString()} оноо</strong></span>
                      {bonusPoints > 0 && (
                        <span className="text-rose-300 text-[10px] bg-rose-950/60 border border-rose-700/50 px-1.5 py-0.5 rounded font-bold">
                          +{bonusPoints.toLocaleString()} админ бонус
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[11px] uppercase font-bold text-stone-400 tracking-wider">
                      Одоогийн зэрэглэл
                    </span>
                    <div className="mt-1">
                      {activeLoyalty ? (
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-black text-sm shadow-sm">
                          <span>{activeLoyalty.badge}</span>
                          <span>{activeLoyalty.name}</span>
                          <span className="bg-stone-950 text-amber-400 px-1.5 py-0.2 rounded text-xs font-black">
                            {activeLoyalty.discount_pct}% ХӨНГӨЛӨЛТ
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 font-semibold text-xs border border-stone-700">
                          <span>Энгийн Гишүүн (0% хөнгөлөлт)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress to Next Tier */}
                <div className="pt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      {nextTier ? (
                        <>Дараагийн түвшин: <strong className="text-white">{nextTier.name} ({nextTier.discount_pct}%)</strong></>
                      ) : (
                        <strong className="text-amber-400">🎉 Баяр хүргэе! Та дээд түвшний Алтан VIP гишүүн болсон байна.</strong>
                      )}
                    </span>
                    {nextTier && (
                      <span className="text-amber-300 font-bold">
                        {formatMNT(remainingForNext)} дутуу
                      </span>
                    )}
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden p-0.5 border border-stone-700">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-500"
                      style={{ width: `${overallProgressPct}%` }}
                    />
                  </div>

                  {/* Milestones markers */}
                  <div className="grid grid-cols-4 text-[10px] text-stone-400 pt-1 font-medium text-center">
                    <div className="text-left">
                      <span>0 ₮</span>
                      <span className="block text-[9px] text-stone-500">Эхлэл</span>
                    </div>
                    <div>
                      <span className={accountSpent >= 500000 ? 'text-amber-400 font-bold' : ''}>500,000 ₮</span>
                      <span className="block text-[9px] text-stone-500">🥉 Хүрэл (2%)</span>
                    </div>
                    <div>
                      <span className={accountSpent >= 1000000 ? 'text-amber-400 font-bold' : ''}>1,000,000 ₮</span>
                      <span className="block text-[9px] text-stone-500">🥈 Мөнгөн (3%)</span>
                    </div>
                    <div className="text-right">
                      <span className={accountSpent >= 2000000 ? 'text-amber-400 font-bold' : ''}>2,000,000 ₮</span>
                      <span className="block text-[9px] text-stone-500">🥇 Алтан VIP (5%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Policy Note */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-stone-900">Худалдан авалтын түүх бүртгэгдэх зарчим:</p>
                  <p className="mt-0.5 text-stone-600 leading-relaxed">
                    Та дэлгүүрээс захиалга өгөх бүртээ өөрийн бүртгэлтэй {currentUser.email ? `и-мэйл (${maskEmail(currentUser.email)})` : `утасны дугаар (${maskPhone(currentUser.phone)})`}-аа оруулснаар худалдан авалт автоматаар энд нэмэгдэж, лояалти хөнгөлөлт тооцогдоно.
                  </p>
                </div>
              </div>

              {/* Detailed Tier Breakdown */}
              <div className="space-y-3 pt-1">
                <h4 className="font-black text-sm text-stone-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  Гишүүнчлэлийн Зэрэглэл & Урамшуулал
                </h4>

                {tiersConfig.map((tier) => {
                  const isCurrent = activeLoyalty?.id === tier.id;
                  const isAchieved = accountSpent >= tier.threshold;

                  return (
                    <div
                      key={tier.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-2 ring-amber-400/20'
                          : isAchieved
                          ? 'border-stone-300 bg-stone-50/70'
                          : 'border-stone-200 bg-white opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tier.badge}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-extrabold text-sm text-stone-900">{tier.name}</h5>
                              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-black">
                                {tier.discount_pct}% ХӨНГӨЛӨЛТ
                              </span>
                            </div>
                            <span className="text-xs text-stone-500 font-medium">
                              Босго: {formatMNT(tier.threshold)} худалдан авалт
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          {isCurrent ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-stone-950 font-black text-xs inline-flex items-center gap-1 shadow-2xs">
                              <Check className="w-3.5 h-3.5" /> Идэвхтэй
                            </span>
                          ) : isAchieved ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                              Хүрсэн ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-stone-400 font-medium">
                              <Lock className="w-3 h-3 text-stone-400" />
                              <span>{formatMNT(tier.threshold - accountSpent)} дутуу</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Highlights */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-stone-700">
                        <div className="flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span><strong>Бэлэг:</strong> {tier.admin_gift}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span><strong>Төрсөн өдөр:</strong> {tier.birthday_reward}</span>
                        </div>
                      </div>

                      {/* Benefits list */}
                      <div className="mt-3 pt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {tier.benefits.map((b, idx) => (
                          <span key={idx} className="flex items-center gap-1.5 text-[11px] text-stone-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{b}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-600 font-medium">
            {currentUser ? (
              activeLoyalty 
                ? `Таны бүртгэлд "${activeLoyalty.name}" (${activeLoyalty.discount_pct}%) хөнгөлөлт тооцогдоно.`
                : 'Худалдан авалтын нийлбэр 500,000 ₮ хүрснээр Хүрэл гишүүнчлэл автоматаар нээгдэнэ.'
            ) : (
              'Лояалти зэрэглэлээ шалгахын тулд И-мэйл эсвэл утсаараа нэвтэрнэ үү.'
            )}
          </span>
          <div className="flex gap-2">
            {currentUser && onOpenProfile && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
              >
                Миний сан үзэх
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-all"
            >
              Хаах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

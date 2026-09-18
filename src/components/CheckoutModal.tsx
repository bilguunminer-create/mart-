import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckCircle2, QrCode, CreditCard, Banknote, Truck, ShieldCheck, Copy, Check, Printer, Award, Phone, Mail } from 'lucide-react';
import { CartItem, LoyaltyTier, OrderDetails, UserProfile } from '../types';
import { STORE_CONFIG, LOYALTY_TIERS, formatMNT, getStoredLoyaltyTiers, calculateLoyaltyTierBySpent } from '../data/storeData';
import { getLoyaltyWallet } from '../services/supabaseAuth';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  orders: OrderDetails[];
  currentUser?: UserProfile | null;
  dailyDiscountTotal: number;
  onOrderSuccess: (order: OrderDetails) => Promise<void> | void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  orders,
  currentUser,
  dailyDiscountTotal,
  onOrderSuccess
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('Өмнөговь, Даланзадгад');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'qpay' | 'bank' | 'cod'>('bank');
  const [selectedBank, setSelectedBank] = useState('khan');
  const [copied, setCopied] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderDetails | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [walletPoints, setWalletPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);

  // Sync with currentUser when opened
  useEffect(() => {
    if (isOpen && currentUser) {
      if (currentUser.name && !customerName) setCustomerName(currentUser.name);
      if (currentUser.phone && currentUser.phone !== 'Бүртгээгүй' && !phone) setPhone(currentUser.phone);
      if (currentUser.email && !email) setEmail(currentUser.email);
      if (currentUser.address && !address) setAddress(currentUser.address);
      if (currentUser.district && !district) setDistrict(currentUser.district);
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    setCompletedOrder(null);
    setUsePoints(false);
    if (!currentUser?.accessToken) {
      setWalletPoints(0);
      return;
    }
    getLoyaltyWallet(currentUser.accessToken)
      .then((wallet) => setWalletPoints(Math.max(0, wallet.available_points || 0)))
      .catch(() => setWalletPoints(0));
  }, [isOpen, currentUser?.accessToken]);

  // Clean phone and email inputs for real-time order history tracking
  const cleanPhone = phone.replace(/\D/g, '').slice(-8);
  const cleanEmail = email.trim().toLowerCase();

  // Purchase history specifically tied to this phone number or email
  const accountOrders = useMemo(() => {
    if (cleanPhone.length < 8 && (!cleanEmail || !cleanEmail.includes('@'))) return [];
    return orders.filter((o) => {
      const matchPhone = cleanPhone.length >= 8 && o.phone && o.phone.replace(/\D/g, '').slice(-8) === cleanPhone;
      const matchEmail = cleanEmail.includes('@') && o.email && o.email.trim().toLowerCase() === cleanEmail;
      return matchPhone || matchEmail;
    });
  }, [orders, cleanPhone, cleanEmail]);

  const accountSpent = useMemo(() => {
    return accountOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [accountOrders]);

  // Loyalty tier dynamically calculated for this account (phone or email)
  const accountLoyaltyTier = useMemo<LoyaltyTier | null>(() => {
    const activeTiers = getStoredLoyaltyTiers();
    // Check manual override if any
    try {
      const saved = localStorage.getItem('usk_loyalty_bonuses');
      if (saved) {
        const bonuses = JSON.parse(saved);
        const override = (cleanEmail && bonuses[cleanEmail]) || (cleanPhone && bonuses[`tel_${cleanPhone}`]);
        if (override?.forceTier) {
          const forced = activeTiers.find((t) => t.id === override.forceTier);
          if (forced) return forced;
        }
      }
    } catch {
      // ignore
    }

    return calculateLoyaltyTierBySpent(accountSpent, activeTiers);
  }, [accountSpent, cleanEmail, cleanPhone]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const itemsPriceAfterDailyDeal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const loyaltyDiscountPct = accountLoyaltyTier ? accountLoyaltyTier.discount_pct : 0;
  const loyaltyDiscountAmount = Math.round((itemsPriceAfterDailyDeal * loyaltyDiscountPct) / 100);

  const isGoldVIP = accountLoyaltyTier?.id === 'gold';
  const qualifiesForFreeDelivery = itemsPriceAfterDailyDeal >= STORE_CONFIG.free_delivery_threshold || isGoldVIP;
  const deliveryFee = qualifiesForFreeDelivery || items.length === 0 ? 0 : STORE_CONFIG.delivery_fee;
  const totalBeforePoints = Math.max(0, itemsPriceAfterDailyDeal - loyaltyDiscountAmount + deliveryFee);
  const pointsDiscount = usePoints ? Math.min(walletPoints, totalBeforePoints) : 0;
  const total = totalBeforePoints - pointsDiscount;

  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!customerName.trim()) newErrors.name = 'Нэрээ оруулна уу';
    if (!phone.trim()) {
      newErrors.phone = 'Утасны дугаараа оруулна уу';
    } else if (!/^[0-9]{8}$/.test(phone.replace(/\s+/g, ''))) {
      newErrors.phone = '8 оронтой зөв дугаар оруулна уу (жишээ: 99112233)';
    }
    if (email.trim() && (!email.includes('@') || !email.includes('.'))) {
      newErrors.email = 'Зөв и-мэйл хаяг оруулна уу (жишээ: bat@gmail.com)';
    }
    if (!address.trim()) newErrors.address = 'Хүргүүлэх хаяг, байр, орц, тоотоо тодорхой бичнэ үү';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const orderId = `USK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: OrderDetails = {
      orderId,
      customerName,
      phone: phone.replace(/\s+/g, ''),
      email: email.trim().toLowerCase() || undefined,
      address,
      district,
      notes,
      paymentMethod,
      items: [...items],
      subtotal,
      dailyDiscount: dailyDiscountTotal,
      loyaltyDiscount: loyaltyDiscountAmount,
      pointsDiscount,
      deliveryFee,
      total,
      date: new Date().toLocaleString('mn-MN')
    };

    try {
      await onOrderSuccess(newOrder);
      setCompletedOrder(newOrder);
    } catch (error: any) {
      setErrors({ form: error?.message || 'Захиалгыг төв санд хадгалах боломжгүй байна.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {completedOrder ? (
          /* Order Success Receipt View */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-stone-900">Захиалга амжилттай баталгаажлаа!</h3>
              <p className="text-sm text-stone-600">
                Захиалгын дугаар: <strong className="text-rose-600 font-mono text-base">{completedOrder.orderId}</strong>
              </p>
              <p className="text-xs text-stone-500">
                Манай менежер таны <strong>{completedOrder.phone}</strong> дугаарт удахгүй холбогдож хүргэлтийг эхлүүлнэ.
              </p>
            </div>

            {/* Receipt Summary Box */}
            <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[11px]">Хүлээн авагч:</span>
                  <span className="font-bold text-stone-800 text-sm">{completedOrder.customerName}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Утас:</span>
                  <span className="font-bold text-stone-800 text-sm">{completedOrder.phone}</span>
                </div>
                {completedOrder.email && (
                  <div className="col-span-2">
                    <span className="text-stone-400 block text-[11px]">И-мэйл хаяг:</span>
                    <span className="font-bold text-stone-800">{completedOrder.email}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-stone-400 block text-[11px]">Хүргэлтийн хаяг:</span>
                  <span className="font-medium text-stone-800">{completedOrder.district}, {completedOrder.address}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="font-bold text-stone-700 block">Захиалсан бараанууд:</span>
                {completedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-stone-700">
                    <span className="truncate max-w-[240px]">
                      {item.name} <strong className="text-stone-500">x{item.quantity}</strong>
                    </span>
                    <span className="font-semibold">{formatMNT(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <div className="flex justify-between">
                  <span>Хүргэлт:</span>
                  <span className="font-bold text-emerald-600">
                    {completedOrder.deliveryFee === 0 ? 'ҮНЭГҮЙ' : formatMNT(completedOrder.deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-sm pt-1 border-t border-stone-300">
                  <span className="font-black text-stone-900">Төлсөн / Төлөх дүн:</span>
                  <span className="text-lg font-black text-rose-600">{formatMNT(completedOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Account Purchase History Registration Badge */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Захиалга бүртгэгдлээ. Хүргэгдэж дууссаны дараа лояалти дүнд нэмэгдэнэ</span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                Таны <strong className="font-mono text-stone-900">{completedOrder.phone}</strong> {completedOrder.email ? `болон ${completedOrder.email} хаягт` : 'дугаарт'} энэхүү <strong className="text-stone-900">{formatMNT(completedOrder.total)}</strong>-ийн худалдан авалт амжилттай бүртгэгдэж, нийт хуримтлагдсан дүн <strong className="text-emerald-700">{formatMNT(accountSpent + completedOrder.total)}</strong> болж ахилаа.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Баримт хэвлэх</span>
              </button>

              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Дэлгүүр рүү буцах
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form View */
          <div>
            {/* Header */}
            <div className="p-5 sm:p-6 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-black">Захиалга Баталгаажуулах</h3>
                <p className="text-xs text-stone-400">Хүргэлтийн мэдээлэл болон төлбөрийн хэлбэр сонгох</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {errors.form && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{errors.form}</p>}
              {/* Recipient Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-rose-600" />
                  Хүргэлтийн мэдээлэл
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Хүлээн авагчийн нэр *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: Батбаяр"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
                    />
                    {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Хүргэлтийн холбоо барих утас *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Жишээ: 99112233"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      Хүргэлтийн жолооч тантай холбогдох дугаар
                    </span>
                    {errors.phone && <p className="text-[11px] text-rose-600 mt-1">{errors.phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-stone-700">
                        Цахим шуудан / И-мэйл (заавал биш)
                      </label>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Лояалти хуримтлал & Баримт авах
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="Жишээ: bat@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    {errors.email && <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* Real-time Phone / Email Purchase History & Loyalty Status Banner */}
                {(cleanPhone.length === 8 || cleanEmail.includes('@')) && (
                  <div className="p-3 bg-gradient-to-r from-stone-50 to-amber-50/40 border border-stone-200 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-stone-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        Хадгалагдсан худалдан авалтын түүх:
                      </span>
                      <span className="font-black text-stone-900">
                        {formatMNT(accountSpent)} <span className="font-normal text-stone-500 text-[11px]">({accountOrders.length} захиалга)</span>
                      </span>
                    </div>

                    {accountLoyaltyTier ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span>{accountLoyaltyTier.name} түвшин ({accountLoyaltyTier.discount_pct}% хөнгөлөлт)</span>
                        </div>
                        <span className="font-black text-rose-600">
                          -{formatMNT(loyaltyDiscountAmount)} хөнгөлөгдөнө
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-600 flex items-center justify-between bg-white/70 p-2 rounded-xl border border-stone-200">
                        <span>500,000 ₮ хүрснээр Хүрэл (2%) хөнгөлөлтийн эрх нээгдэнэ</span>
                        <span className="text-amber-700 font-bold ml-2">
                          {formatMNT(Math.max(0, 500000 - accountSpent))} дутуу
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {walletPoints > 0 && (
                  <label className="flex items-start gap-3 p-3 rounded-2xl border border-emerald-200 bg-emerald-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={(event) => setUsePoints(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-xs text-emerald-950">
                      <strong className="block">Хуримтлуулсан оноогоо энэ захиалгад ашиглах</strong>
                      <span>Боломжит оноо: {formatMNT(walletPoints)}. Сонгохгүй бол оноо таны дансанд хадгалагдана.</span>
                    </span>
                  </label>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Бүс нутаг, Аймаг / Хот
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="Өмнөговь, Даланзадгад">Өмнөговь, Даланзадгад (Шуурхай хүргэлт)</option>
                    <option value="Өмнөговь, Ханбогд (Оюутолгой)">Өмнөговь, Ханбогд (Оюутолгой бүс)</option>
                    <option value="Өмнөговь, Цогтцэций (Тавантолгой)">Өмнөговь, Цогтцэций (Тавантолгой)</option>
                    <option value="Улаанбаатар хот">Улаанбаатар хот (Бүх дүүрэгт)</option>
                    <option value="Бусад аймаг, сум">Бусад аймаг, орон нутгийн унаанд тавих</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Дэлгэрэнгүй хаяг (Баг/Хороо, Байр/Гудамж, Орц, Тоот) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Жишээ: 3-р баг, Шинэ хороолол, 12-р байр, 2-р орц, 24 тоот"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
                  />
                  {errors.address && <p className="text-[11px] text-rose-600 mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Хүргэгчид өгөх нэмэлт тайлбар (заавал биш)
                  </label>
                  <input
                    type="text"
                    placeholder="Жишээ: Орохдоо кодоо хийнэ үү, эсвэл үүдэнд үлдээнэ үү"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-3 border-t border-stone-200">
                <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-600" />
                  Төлбөрийн хэлбэр сонгох
                </h4>

                <div className="rounded-2xl border-2 border-indigo-500 bg-indigo-50/60 p-4 text-center">
                  <CreditCard className="mx-auto mb-2 h-6 w-6 text-indigo-600" />
                  <p className="font-bold text-indigo-950">Дансаар шилжүүлэх</p>
                  <p className="mt-1 text-xs text-indigo-800">QPay болон ПОС төлбөр түр идэвхгүй байна.</p>
                </div>

                {/* QPay Details */}
                {paymentMethod === 'qpay' && (
                  <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 flex flex-col sm:flex-row items-center gap-4 text-xs">
                    <div className="p-3 bg-white rounded-xl shadow-xs border border-stone-200 text-center shrink-0">
                      {/* Realistic simulated QR code */}
                      <div className="w-24 h-24 bg-stone-900 rounded-lg flex flex-col items-center justify-center text-white p-2">
                        <QrCode className="w-16 h-16 text-white" />
                        <span className="text-[9px] font-bold text-amber-300">QPAY ИДЭВХТЭЙ</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-stone-600 text-center sm:text-left">
                      <p className="font-bold text-stone-900">Бүх банкны апп-аар шууд уншуулна</p>
                      <p>Хаан банк, Голомт, Хас, Төрийн банк, SocialPay зэрэг 14 банкны аппликейшнээр шилжүүлэг хийх боломжтой.</p>
                      <div className="flex flex-wrap gap-1 pt-1 justify-center sm:justify-start">
                        {['Хаан', 'Голомт', 'Төрийн', 'Хас', 'Юнител/Монпэй'].map((b) => (
                          <span key={b} className="bg-white border border-stone-200 px-2 py-0.5 rounded text-[10px] font-medium">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Transfer Details */}
                {paymentMethod === 'bank' && (
                  <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-stone-200">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Хүлээн авагч банк:</span>
                        <span className="font-black text-stone-800">Хаан Банк (US&K Family Mart)</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Дансны дугаар:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-stone-900">5084 1122 3344</span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount('508411223344')}
                            className="text-stone-500 hover:text-stone-900 p-1 cursor-pointer"
                            title="Данс хуулах"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Гүйлгээний утга дээр өөрийн утасны дугаарыг бичнэ үү. Төлбөр орсон даруйд хүргэлт баталгаажна.
                    </p>
                  </div>
                )}

                {/* COD Details */}
                {paymentMethod === 'cod' && (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p>
                      Бараагаа гэрийн хаягтаа хүлээн авч шалгасны дараа хүргэгчийн пос машинд карт уншуулах эсвэл бэлнээр тооцоо хийх боломжтой.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Барааны нийт дүн:</span>
                  <span className="font-semibold text-stone-900">{formatMNT(itemsPriceAfterDailyDeal)}</span>
                </div>

                {dailyDiscountTotal > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Өдрийн онцлох хямдрал:</span>
                    <span className="font-bold">-{formatMNT(dailyDiscountTotal)}</span>
                  </div>
                )}

                {loyaltyDiscountAmount > 0 && accountLoyaltyTier && (
                  <div className="flex justify-between text-amber-800 font-bold bg-amber-500/10 p-2 rounded-lg border border-amber-300/40">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      Лояалти хөнгөлөлт ({accountLoyaltyTier.name} {accountLoyaltyTier.discount_pct}%):
                    </span>
                    <span className="font-black text-rose-600">-{formatMNT(loyaltyDiscountAmount)}</span>
                  </div>
                )}

                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <span>Хуримтлуулсан оноо ашигласан:</span>
                    <span className="font-black">-{formatMNT(pointsDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-stone-600">
                  <span>Хүргэлтийн төлбөр:</span>
                  <span className="font-semibold text-stone-900">
                    {deliveryFee === 0 ? <strong className="text-emerald-600">ҮНЭГҮЙ</strong> : formatMNT(deliveryFee)}
                  </span>
                </div>
              </div>

              {/* Order Final Total Bar */}
              <div className="bg-stone-900 text-white rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-400 block">Төлөх нийт дүн:</span>
                  <span className="text-xl font-black text-amber-400">{formatMNT(total)}</span>
                </div>
                <div className="text-right text-xs text-stone-300">
                  <span>{items.reduce((c, i) => c + i.quantity, 0)} бараа</span>
                  <span className="block text-[11px] text-emerald-400">
                    {deliveryFee === 0 ? 'Хүргэлт ҮНЭГҮЙ' : `Хүргэлт: ${formatMNT(deliveryFee)}`}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Буцах
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3.5 px-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  Захиалга Илгээх ({formatMNT(total)})
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

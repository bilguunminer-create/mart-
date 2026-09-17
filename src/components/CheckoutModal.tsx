import React, { useState } from 'react';
import { X, CheckCircle2, QrCode, CreditCard, Banknote, Truck, ShieldCheck, Copy, Check, Printer } from 'lucide-react';
import { CartItem, LoyaltyTier, OrderDetails } from '../types';
import { STORE_CONFIG, formatMNT } from '../data/storeData';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  activeLoyalty: LoyaltyTier | null;
  dailyDiscountTotal: number;
  onOrderSuccess: (order: OrderDetails) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  activeLoyalty,
  dailyDiscountTotal,
  onOrderSuccess
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Өмнөговь, Даланзадгад');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'qpay' | 'bank' | 'cod'>('qpay');
  const [selectedBank, setSelectedBank] = useState('khan');
  const [copied, setCopied] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderDetails | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const itemsPriceAfterDailyDeal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const loyaltyDiscountPct = activeLoyalty ? activeLoyalty.discount_pct : 0;
  const loyaltyDiscountAmount = Math.round((itemsPriceAfterDailyDeal * loyaltyDiscountPct) / 100);

  const isGoldVIP = activeLoyalty?.id === 'gold';
  const qualifiesForFreeDelivery = itemsPriceAfterDailyDeal >= STORE_CONFIG.free_delivery_threshold || isGoldVIP;
  const deliveryFee = qualifiesForFreeDelivery || items.length === 0 ? 0 : STORE_CONFIG.delivery_fee;
  const total = Math.max(0, itemsPriceAfterDailyDeal - loyaltyDiscountAmount + deliveryFee);

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
    if (!address.trim()) newErrors.address = 'Хүргүүлэх хаяг, байр, орц, тоотоо тодорхой бичнэ үү';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const orderId = `USK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: OrderDetails = {
      orderId,
      customerName,
      phone,
      address,
      district,
      notes,
      paymentMethod,
      items: [...items],
      subtotal,
      dailyDiscount: dailyDiscountTotal,
      loyaltyDiscount: loyaltyDiscountAmount,
      deliveryFee,
      total,
      date: new Date().toLocaleString('mn-MN')
    };

    setCompletedOrder(newOrder);
    onOrderSuccess(newOrder);
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
                      Утасны дугаар *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Жишээ: 99112233"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono"
                    />
                    {errors.phone && <p className="text-[11px] text-rose-600 mt-1">{errors.phone}</p>}
                  </div>
                </div>

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

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qpay')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'qpay'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700 font-bold'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-rose-600" />
                    <span className="text-xs">QPay QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'bank'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700 font-bold'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <span className="text-xs">Дансаар</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700 font-bold'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Бэлнээр / Карт</span>
                  </button>
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

import React from 'react';
import { X, Plus, Minus, Trash2, Truck, ShoppingBag, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { CartItem, LoyaltyTier } from '../types';
import { STORE_CONFIG, formatMNT } from '../data/storeData';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
  activeLoyalty: LoyaltyTier | null;
  dailyDiscountTotal: number;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  activeLoyalty,
  dailyDiscountTotal
}) => {
  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const itemsPriceAfterDailyDeal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Loyalty discount applies on remaining total
  const loyaltyDiscountPct = activeLoyalty ? activeLoyalty.discount_pct : 0;
  const loyaltyDiscountAmount = Math.round((itemsPriceAfterDailyDeal * loyaltyDiscountPct) / 100);

  const isGoldVIP = activeLoyalty?.id === 'gold';
  const qualifiesForFreeDelivery = itemsPriceAfterDailyDeal >= STORE_CONFIG.free_delivery_threshold || isGoldVIP;
  const deliveryFee = qualifiesForFreeDelivery || items.length === 0 ? 0 : STORE_CONFIG.delivery_fee;

  const total = Math.max(0, itemsPriceAfterDailyDeal - loyaltyDiscountAmount + deliveryFee);
  const progressToFreeDelivery = Math.min(100, Math.round((itemsPriceAfterDailyDeal / STORE_CONFIG.free_delivery_threshold) * 100));
  const remainingForFree = Math.max(0, STORE_CONFIG.free_delivery_threshold - itemsPriceAfterDailyDeal);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-rose-600" />
              <h3 className="font-extrabold text-stone-900 text-lg">Таны Сагс</h3>
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {items.reduce((cnt, i) => cnt + i.quantity, 0)} ширхэг
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free Delivery Bar */}
          <div className="p-4 bg-amber-50/70 border-b border-amber-200/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold flex items-center gap-1.5 text-stone-800">
                <Truck className="w-4 h-4 text-amber-600" />
                {qualifiesForFreeDelivery ? (
                  <span className="text-emerald-700 font-extrabold">🎉 Танд үнэгүй хүргэгдэнэ!</span>
                ) : (
                  <span>
                    Үнэгүй хүргэлтэд <strong className="text-rose-600">{formatMNT(remainingForFree)}</strong> дутуу
                  </span>
                )}
              </span>
              <span className="text-stone-600 font-bold">{progressToFreeDelivery}%</span>
            </div>
            <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${qualifiesForFreeDelivery ? 100 : progressToFreeDelivery}%` }}
              />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-8 h-8 text-stone-300" />
                </div>
                <h4 className="font-bold text-stone-700 text-base">Таны сагс хоосон байна</h4>
                <p className="text-xs text-stone-500 mt-1 max-w-xs">
                  АНУ, БНСУ-аас импортолсон шилдэг хүнс, амттан, витаминуудаас сагсандаа нэмээрэй.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Бараа үзэх
                </button>
              </div>
            ) : (
              items.map((item) => {
                const hasDiscount = item.originalPrice > item.price;
                return (
                  <div key={item.id} className="py-3 flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-cover rounded-xl border border-stone-200 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        {item.flag && <span>{item.flag}</span>}
                        {item.weight && <span>{item.weight}</span>}
                        {item.type === 'combo' && (
                          <span className="bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded text-[10px]">
                            Багц
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-stone-900 text-xs truncate" title={item.name}>
                        {item.name}
                      </h5>

                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="font-black text-xs text-stone-900">
                          {formatMNT(item.price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-stone-400 line-through">
                            {formatMNT(item.originalPrice)}
                          </span>
                        )}
                      </div>
                      {item.stock_quantity !== undefined && item.quantity >= item.stock_quantity && (
                        <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                          Дээд үлдэгдэл: {item.stock_quantity}ш
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white rounded transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          disabled={item.stock_quantity !== undefined && item.quantity >= item.stock_quantity}
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                            item.stock_quantity !== undefined && item.quantity >= item.stock_quantity
                              ? 'text-stone-300 cursor-not-allowed'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-white cursor-pointer'
                          }`}
                          title={item.stock_quantity !== undefined && item.quantity >= item.stock_quantity ? 'Агуулахын дээд үлдэгдэлд хүрсэн' : 'Нэмэх'}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Calculations & CTA */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 space-y-3">
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Барааны үндсэн дүн:</span>
                  <span className="font-semibold text-stone-900">{formatMNT(subtotal)}</span>
                </div>

                {dailyDiscountTotal > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Өдрийн хямдрал:
                    </span>
                    <span>-{formatMNT(dailyDiscountTotal)}</span>
                  </div>
                )}

                {loyaltyDiscountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>{activeLoyalty?.name} ({loyaltyDiscountPct}%):</span>
                    <span>-{formatMNT(loyaltyDiscountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-stone-200">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Хүргэлтийн төлбөр:
                  </span>
                  {qualifiesForFreeDelivery ? (
                    <span className="font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                      ҮНЭГҮЙ
                    </span>
                  ) : (
                    <span className="font-semibold text-stone-900">
                      {formatMNT(STORE_CONFIG.delivery_fee)}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-stone-300 text-sm">
                  <span className="font-extrabold text-stone-900">Төлөх нийт дүн:</span>
                  <span className="text-xl font-black text-rose-600">{formatMNT(total)}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={onProceedToCheckout}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-600/25 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Захиалга баталгаажуулах</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Баталгаат чанар, түргэн хүргэлт
                  </span>
                  <button
                    onClick={onClearCart}
                    className="hover:text-rose-600 underline cursor-pointer"
                  >
                    Сагс цэвэрлэх
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

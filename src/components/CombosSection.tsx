import React from 'react';
import { Package, Sparkles, Check, ShoppingBag } from 'lucide-react';
import { COMBOS, formatMNT, PRODUCTS } from '../data/storeData';
import { ComboPack } from '../types';

interface CombosSectionProps {
  onAddComboToCart: (combo: ComboPack) => void;
  onOpenProductDetail: (productId: string) => void;
}

export const CombosSection: React.FC<CombosSectionProps> = ({
  onAddComboToCart,
  onOpenProductDetail
}) => {
  return (
    <section className="my-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Хэмнэлттэй багцууд</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Бэлэн Комбо Багцууд
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Шилдэг хүнс, амттан, витаминыг нэг дор цуглуулж хамгийн өндөр хэмнэлтийг олгоно.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COMBOS.map((combo) => {
          const discountPct = Math.round(((combo.orig_price - combo.price) / combo.orig_price) * 100);
          
          return (
            <div
              key={combo.id}
              className="relative flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 group"
            >
              {/* Image with overlay badge */}
              <div className="relative aspect-16/9 w-full bg-stone-100 overflow-hidden">
                <img
                  src={combo.image}
                  alt={combo.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md">
                    {combo.badge}
                  </span>
                  <span className="bg-stone-900/85 backdrop-blur-xs text-amber-300 text-xs font-bold px-2 py-1 rounded-lg">
                    -{discountPct}% Хэмнэлт
                  </span>
                </div>
              </div>

              {/* Combo Info */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base sm:text-lg leading-snug">
                    {combo.name}
                  </h3>

                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                    {combo.description}
                  </p>

                  {/* Included items chips */}
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <span className="text-[11px] font-bold text-stone-700 block mb-1.5">
                      Багцад багтсан бараанууд:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {combo.items.map((itemId) => {
                        const itemProduct = PRODUCTS.find((p) => p.id === itemId);
                        if (!itemProduct) return null;
                        return (
                          <button
                            key={itemId}
                            onClick={() => onOpenProductDetail(itemId)}
                            className="inline-flex items-center gap-1 text-[10px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            title="Барааны мэдээлэл харах"
                          >
                            <span>{itemProduct.flag}</span>
                            <span className="truncate max-w-[110px]">{itemProduct.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pricing & CTA */}
                <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg sm:text-xl font-black text-rose-600">
                        {formatMNT(combo.price)}
                      </span>
                      <span className="text-xs text-stone-400 line-through">
                        {formatMNT(combo.orig_price)}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      Нийт {formatMNT(combo.orig_price - combo.price)} хэмнэнэ
                    </span>
                  </div>

                  <button
                    onClick={() => onAddComboToCart(combo)}
                    className="flex items-center gap-1.5 bg-stone-900 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Багц авах</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

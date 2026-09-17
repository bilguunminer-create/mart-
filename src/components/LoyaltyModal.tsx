import React from 'react';
import { X, Award, Check, Gift, Truck, Calendar, Sparkles } from 'lucide-react';
import { LOYALTY_TIERS, formatMNT } from '../data/storeData';
import { LoyaltyTier } from '../types';

interface LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLoyalty: LoyaltyTier | null;
  onSelectTier: (tier: LoyaltyTier | null) => void;
}

export const LoyaltyModal: React.FC<LoyaltyModalProps> = ({
  isOpen,
  onClose,
  activeLoyalty,
  onSelectTier
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black">Лояалти Гишүүнчлэлийн Хөтөлбөр</h3>
              <p className="text-xs text-stone-300">Байнгын худалдан авагчдад зориулсан онцгой урамшуулал</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-stone-900">Хэрхэн гишүүн болох вэ?</p>
              <p className="mt-0.5 text-stone-600">
                Та US&K Family Mart дэлгүүрээс хийсэн нийт худалдан авалтынхаа хэмжээнээс хамааран дараах шатлалуудад хамрагдаж, байнгын хөнгөлөлт, бэлэг эдэлнэ.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {LOYALTY_TIERS.map((tier) => {
              const isSelected = activeLoyalty?.id === tier.id;
              
              return (
                <div
                  key={tier.id}
                  className={`rounded-2xl border-2 transition-all p-5 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/40 shadow-md'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{tier.badge.split(' ')[0]}</span>
                      <div>
                        <h4 className="font-black text-stone-900 text-base">{tier.name}</h4>
                        <span className="text-xs text-stone-500">{tier.range}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-lg font-black text-amber-600">
                          {tier.discount_pct}% Байнгын
                        </span>
                        <span className="block text-[10px] text-stone-500">бүх захиалгад</span>
                      </div>

                      <button
                        onClick={() => onSelectTier(isSelected ? null : tier)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        {isSelected ? 'Идэвхтэй байна ✓' : 'Сонгож турших'}
                      </button>
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
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{b}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {activeLoyalty ? `Одоогоор ${activeLoyalty.name} идэвхтэй байна.` : 'Энгийн хэрэглэгчийн горим'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};

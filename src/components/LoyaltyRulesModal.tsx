import React, { useState } from 'react';
import { 
  Award, 
  Sparkles, 
  X, 
  Check, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Gift, 
  Percent, 
  Coins, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { LoyaltyTier } from '../types';
import { 
  formatMNT, 
  saveStoredLoyaltyTiers, 
  saveStoredCashbackPct, 
  resetStoredLoyaltyTiers, 
  LOYALTY_TIERS 
} from '../data/storeData';

interface LoyaltyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tiers: LoyaltyTier[];
  cashbackPct: number;
  onSave: (updatedTiers: LoyaltyTier[], updatedCashbackPct: number) => void;
}

export const LoyaltyRulesModal: React.FC<LoyaltyRulesModalProps> = ({
  isOpen,
  onClose,
  tiers,
  cashbackPct,
  onSave
}) => {
  const [editedTiers, setEditedTiers] = useState<LoyaltyTier[]>(() => JSON.parse(JSON.stringify(tiers)));
  const [editedCashback, setEditedCashback] = useState<number>(cashbackPct);
  const [activeTierIndex, setActiveTierIndex] = useState<number>(0);
  const [newBenefitText, setNewBenefitText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync state if props change when opened
  React.useEffect(() => {
    if (isOpen) {
      setEditedTiers(JSON.parse(JSON.stringify(tiers)));
      setEditedCashback(cashbackPct);
      setSaveSuccess(false);
      setShowResetConfirm(false);
    }
  }, [isOpen, tiers, cashbackPct]);

  if (!isOpen) return null;

  const currentTier = editedTiers[activeTierIndex];

  const handleUpdateTierField = (field: keyof LoyaltyTier, value: any) => {
    setEditedTiers((prev) => {
      const copy = [...prev];
      copy[activeTierIndex] = {
        ...copy[activeTierIndex],
        [field]: value
      };
      // Keep range in sync if threshold changed
      if (field === 'threshold') {
        copy[activeTierIndex].range = `Нийт ${formatMNT(Number(value))} худалдан авалтаас`;
      }
      return copy;
    });
  };

  const handleAddBenefit = () => {
    if (!newBenefitText.trim()) return;
    setEditedTiers((prev) => {
      const copy = [...prev];
      const tier = copy[activeTierIndex];
      copy[activeTierIndex] = {
        ...tier,
        benefits: [...(tier.benefits || []), newBenefitText.trim()]
      };
      return copy;
    });
    setNewBenefitText('');
  };

  const handleRemoveBenefit = (indexToRemove: number) => {
    setEditedTiers((prev) => {
      const copy = [...prev];
      const tier = copy[activeTierIndex];
      copy[activeTierIndex] = {
        ...tier,
        benefits: tier.benefits.filter((_, idx) => idx !== indexToRemove)
      };
      return copy;
    });
  };

  const handleUpdateBenefit = (index: number, text: string) => {
    setEditedTiers((prev) => {
      const copy = [...prev];
      const tier = copy[activeTierIndex];
      const nextBenefits = [...tier.benefits];
      nextBenefits[index] = text;
      copy[activeTierIndex] = {
        ...tier,
        benefits: nextBenefits
      };
      return copy;
    });
  };

  const handleSaveAll = () => {
    // Security bounds & validation for numbers
    const sanitizedTiers = editedTiers.map((t) => {
      const validThreshold = Math.max(0, Math.min(500000000, Math.floor(Number(t.threshold) || 0)));
      const validDiscountPct = Math.max(0, Math.min(90, Math.round(Number(t.discount_pct) || 0)));
      return {
        ...t,
        threshold: validThreshold,
        discount_pct: validDiscountPct,
        range: `Нийт ${formatMNT(validThreshold)} худалдан авалтаас`,
        admin_gift: (t.admin_gift || '').trim().slice(0, 100),
        benefits: (t.benefits || []).map((b) => b.trim().slice(0, 150)).filter(Boolean)
      };
    });
    const sanitizedCashback = Math.max(0, Math.min(50, Math.round(Number(editedCashback) || 0)));

    saveStoredLoyaltyTiers(sanitizedTiers);
    saveStoredCashbackPct(sanitizedCashback);
    onSave(sanitizedTiers, sanitizedCashback);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const handleResetToDefaults = () => {
    const defaultTiers = resetStoredLoyaltyTiers();
    setEditedTiers(JSON.parse(JSON.stringify(defaultTiers)));
    setEditedCashback(1);
    onSave(defaultTiers, 1);
    setShowResetConfirm(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Лояалти Зэрэглэлийн Дүрэм & Урамшуулал Засах</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-extrabold px-2 py-0.5 rounded-full">
                  Админ тохиргоо
                </span>
              </h3>
              <p className="text-xs text-stone-300">
                Худалдан авалтын босго дүн, хөнгөлөлтийн хувь, бэлэг болон болзол нөхцөлийг өөрчлөх
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Cashback Rate Control Banner */}
        <div className="bg-amber-50/70 border-b border-amber-200/80 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                <span>Бүх худалдан авалтын суурь бэлэн онооны кэшбэк хувь</span>
              </div>
              <div className="text-[11px] text-stone-600">
                Хэрэглэгч бүр захиалга хийх бүрт дүнгийн тодорхой хувь лояалти оноо болон хуримтлагдана.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-stone-700">Онооны хувь:</span>
            <div className="flex items-center bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={editedCashback}
                onChange={(e) => setEditedCashback(Math.max(0, Number(e.target.value)))}
                className="w-12 text-center text-xs font-black text-rose-600 focus:outline-none"
              />
              <span className="text-xs font-black text-stone-600">%</span>
            </div>
          </div>
        </div>

        {/* Modal Body - Tier Selection Tabs & Tier Editor */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Tier Navigation Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-stone-100 rounded-2xl">
            {editedTiers.map((tier, idx) => (
              <button
                key={tier.id}
                onClick={() => setActiveTierIndex(idx)}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 shadow-2xs ${
                  activeTierIndex === idx
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 ring-2 ring-amber-500/20'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <span className="text-sm">{tier.badge.split(' ')[0]}</span>
                <span className="truncate">{tier.name.split(' ')[0]}</span>
                <span className="text-[10px] bg-stone-200/80 text-stone-700 font-bold px-1.5 py-0.2 rounded-full">
                  {tier.discount_pct}%
                </span>
              </button>
            ))}
          </div>

          {currentTier && (
            <div className="space-y-5">
              {/* Primary Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1.5">
                    Зэрэглэлийн бүтэн нэр
                  </label>
                  <input
                    type="text"
                    value={currentTier.name}
                    onChange={(e) => handleUpdateTierField('name', e.target.value)}
                    placeholder="Жишээ: Хүрэл Гишүүн (Bronze)"
                    className="w-full px-3.5 py-2.5 text-xs font-bold border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-stone-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1.5">
                    Энгэрийн тэмдэг (Badge)
                  </label>
                  <input
                    type="text"
                    value={currentTier.badge}
                    onChange={(e) => handleUpdateTierField('badge', e.target.value)}
                    placeholder="Жишээ: 🥉 Хүрэл"
                    className="w-full px-3.5 py-2.5 text-xs font-bold border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-stone-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1.5 flex items-center justify-between">
                    <span>Худалдан авалтын босго дүн (₮)</span>
                    <span className="text-[11px] font-mono text-amber-700">{formatMNT(currentTier.threshold)}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="50000"
                      min="0"
                      value={currentTier.threshold}
                      onChange={(e) => handleUpdateTierField('threshold', Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs font-black border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 pr-12 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">₮</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">Хэрэглэгч энэ дүнд хүрэхэд уг зэрэглэлд автоматаар дэвшинэ.</p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-800 mb-1.5 flex items-center justify-between">
                    <span>Байнгын хөнгөлөлтийн хувь (%)</span>
                    <span className="text-[11px] font-mono text-rose-600">-{currentTier.discount_pct}%</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={currentTier.discount_pct}
                      onChange={(e) => handleUpdateTierField('discount_pct', Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs font-black border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 pr-12 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">%</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">Сагсанд байрлах барааны нийт үнээс шууд хасагдах хувь.</p>
                </div>
              </div>

              {/* Gifts and Rewards Section */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-stone-900 pb-1 border-b border-stone-200">
                  <Gift className="w-4 h-4 text-rose-500" />
                  <span>Тусгай урамшуулал & Бэлэг</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Админы захиалгын бэлэг
                    </label>
                    <input
                      type="text"
                      value={currentTier.admin_gift}
                      onChange={(e) => handleUpdateTierField('admin_gift', e.target.value)}
                      placeholder="Жишээ: Солонгос амттан, чипсний бэлэг"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Төрсөн өдрийн ваучер / урамшуулал
                    </label>
                    <input
                      type="text"
                      value={currentTier.birthday_reward}
                      onChange={(e) => handleUpdateTierField('birthday_reward', e.target.value)}
                      placeholder="Жишээ: 5,000 ₮ бэлгийн ваучер"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Benefits & Conditions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Урамшууллын болзол нөхцөл & Давуу талууд ({currentTier.benefits?.length || 0})</span>
                  </label>
                  <span className="text-[10px] text-stone-400">Хэрэглэгчид харагдах давуу талуудын жагсаалт</span>
                </div>

                <div className="space-y-2">
                  {(currentTier.benefits || []).map((benefit, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        ✓
                      </div>
                      <input
                        type="text"
                        value={benefit}
                        onChange={(e) => handleUpdateBenefit(bIdx, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBenefit(bIdx)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add New Benefit Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Шинэ урамшуулал, болзол эсвэл давуу тал бичих..."
                      value={newBenefitText}
                      onChange={(e) => setNewBenefitText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBenefit();
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-dashed border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-stone-50"
                    />
                    <button
                      type="button"
                      onClick={handleAddBenefit}
                      className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Нэмэх</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:px-6 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs font-bold text-stone-500 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Анхдагч дүрэм рүү сэргээх</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-600">Үйлдвэрийн төлөвт шилжүүлэх үү?</span>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-rose-700"
                >
                  Тийм, сэргээ
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-1 text-stone-500 hover:text-stone-800 text-[11px] font-bold cursor-pointer"
                >
                  Болих
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                <Check className="w-4 h-4" />
                Амжилттай хадгалагдлаа!
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Хаах
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Дүрмийн өөрчлөлтийг батлах</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

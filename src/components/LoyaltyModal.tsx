import React, { useMemo } from 'react';
import { X, Award, ShoppingBag, TrendingUp, LogOut } from 'lucide-react';
import { LoyaltyTier, OrderDetails, UserProfile } from '../types';
import { formatMNT, getStoredLoyaltyTiers, calculateLoyaltyTierBySpent } from '../data/storeData';

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
  onLogoutUser,
}) => {
  const accountOrders = useMemo(() => {
    const email = currentUser?.email?.trim().toLowerCase();
    const phone = currentUser?.phone?.replace(/\D/g, '').slice(-8);
    if (!email && !phone) return [];

    return orders.filter((order) => {
      const orderEmail = order.email?.trim().toLowerCase();
      const orderPhone = order.phone?.replace(/\D/g, '').slice(-8);
      return Boolean((email && orderEmail === email) || (phone && orderPhone === phone));
    });
  }, [orders, currentUser]);

  const totalSpent = useMemo(
    () => accountOrders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.total || 0), 0),
    [accountOrders],
  );

  const tiers = useMemo(
    () => [...getStoredLoyaltyTiers()].sort((a, b) => a.threshold - b.threshold),
    [],
  );
  const currentTier: LoyaltyTier | null = currentUser
    ? calculateLoyaltyTierBySpent(totalSpent, tiers)
    : null;
  const nextTier = tiers.find((tier) => tier.threshold > totalSpent) || null;
  const remaining = nextTier ? Math.max(0, nextTier.threshold - totalSpent) : 0;

  if (!isOpen) return null;

  const openAccount = () => {
    onClose();
    onOpenProfile?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-stone-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
              <Award className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-black">Лояалти гишүүнчлэл</h2>
              <p className="text-xs text-stone-300">Таны бүртгэлтэй автоматаар холбогдоно</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10" aria-label="Хаах">
            <X className="h-5 w-5" />
          </button>
        </header>

        {!currentUser ? (
          <div className="space-y-5 p-6">
            <p className="text-sm leading-6 text-stone-600">
              Лояалтид тусдаа нэвтрэх, дахин бүртгүүлэх шаардлагагүй. Нэг удаа
              <b> Бүртгэл</b> үүсгэснээр захиалга, худалдан авалтын түүх, гишүүнчлэл нэг дор хадгалагдана.
            </p>
            <button onClick={openAccount} className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-800">
              <ShoppingBag className="h-4 w-4" /> Нэвтрэх / бүртгүүлэх
            </button>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Таны одоогийн зэрэглэл</p>
              <p className="mt-1 text-xl font-black text-stone-900">
                {currentTier ? `${currentTier.badge} ${currentTier.name}` : 'Энгийн хэрэглэгч'}
              </p>
              <p className="mt-2 text-sm text-stone-700">
                VIP-д тооцогдох худалдан авалт: <b>{formatMNT(totalSpent)}</b>
              </p>
            </div>

            {nextTier ? (
              <div className="flex gap-3 rounded-2xl border border-stone-200 p-4 text-sm text-stone-700">
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p><b>{nextTier.name}</b> зэрэглэлд ороход {formatMNT(remaining)} дутуу байна.</p>
              </div>
            ) : (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Та хамгийн дээд гишүүнчлэлийн зэрэглэлд хүрсэн байна.
              </p>
            )}

            <p className="text-xs leading-5 text-stone-500">
              Зэрэглэлийг гараар сонгох боломжгүй. Таны бүртгэлд холбогдсон, цуцлагдаагүй захиалгын дүнгээр автоматаар шинэчлэгдэнэ.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={openAccount} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50">
                Миний бүртгэл
              </button>
              <button onClick={() => { onLogoutUser?.(); onClose(); }} className="flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-800">
                <LogOut className="h-4 w-4" /> Гарах
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

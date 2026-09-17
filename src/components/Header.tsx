import React, { useRef } from 'react';
import { ShoppingBag, Search, Sparkles, Truck, Phone, Award, ShieldCheck, LogOut } from 'lucide-react';
import { STORE_CONFIG, formatMNT } from '../data/storeData';
import { LoyaltyTier } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenLoyalty: () => void;
  onOpenAdmin: () => void;
  onLogoutAdmin?: () => void;
  isAdminActive?: boolean;
  activeLoyalty: LoyaltyTier | null;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  dailyDealTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenLoyalty,
  onOpenAdmin,
  onLogoutAdmin,
  isAdminActive,
  activeLoyalty,
  selectedDay,
  setSelectedDay,
  dailyDealTitle
}) => {
  const logoClickCountRef = useRef(0);
  const logoTimerRef = useRef<any>(null);

  const handleLogoClick = () => {
    logoClickCountRef.current += 1;
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);

    if (logoClickCountRef.current >= 3) {
      logoClickCountRef.current = 0;
      onOpenAdmin();
    } else {
      logoTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 1500);
    }
  };
  const days = [
    { num: 1, short: 'Дав' },
    { num: 2, short: 'Мяг' },
    { num: 3, short: 'Лха' },
    { num: 4, short: 'Пүр' },
    { num: 5, short: 'Баа' },
    { num: 6, short: 'Бям' },
    { num: 0, short: 'Ням' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
      {/* Top Banner */}
      <div className="bg-stone-900 text-stone-200 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-amber-300 font-medium">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatMNT(STORE_CONFIG.free_delivery_threshold)}-өөс дээш үнэгүй хүргэлттэй</span>
            </span>
            <span className="hidden md:inline-block text-stone-400">|</span>
            <span className="hidden md:inline-block text-stone-300">
              🇺🇸 АНУ & 🇰🇷 БНСУ шууд импортын баталгаат бараа
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-stone-300 ml-auto">
            <button
              onClick={onOpenLoyalty}
              className="flex items-center gap-1 hover:text-amber-300 transition-colors text-xs cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeLoyalty ? activeLoyalty.name : 'Лояалти гишүүнчлэл'}</span>
            </button>
            <span className="text-stone-500">|</span>
            <a href={`tel:${STORE_CONFIG.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="w-3.5 h-3.5" />
              <span>{STORE_CONFIG.phone}</span>
            </a>

            {/* Admin link only visible when admin is actively logged in */}
            {isAdminActive && (
              <>
                <span className="text-stone-500">|</span>
                <button
                  id="admin-header-top-btn"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1 hover:text-rose-300 text-rose-400 transition-colors text-xs cursor-pointer font-bold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Админ удирдлага</span>
                </button>
                {onLogoutAdmin && (
                  <button
                    onClick={onLogoutAdmin}
                    className="text-stone-400 hover:text-rose-300 text-[11px] cursor-pointer"
                    title="Админаас гарах"
                  >
                    (Гарах)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Logo (With secret 3-tap trigger for admin login) */}
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none group"
            title="US&K Family Mart"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white font-black text-xs tracking-tight shadow-md shadow-rose-600/20 px-1 text-center leading-none group-hover:scale-105 transition-transform">
              US&K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-stone-900 leading-none">
                  US&K Family Mart
                </h1>
                <span className="px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-700 text-[10px] font-bold tracking-wider uppercase">
                  MART
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">АНУ & БНСУ Баталгаат Бараа • Түргэн Хүргэлт</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="hidden sm:flex flex-1 max-w-md mx-2">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Бараа хайх... (жишээ: Buldak, Spam, Витамин C, Tide...)"
                className="w-full pl-10 pr-4 py-2 text-sm bg-stone-100 border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-semibold"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Loyalty tier badge if selected */}
            <button
              onClick={onOpenLoyalty}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                activeLoyalty
                  ? `${activeLoyalty.bg_color} ${activeLoyalty.text_color} border-amber-300/60`
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{activeLoyalty ? activeLoyalty.badge : 'Хөнгөлөлтийн карт'}</span>
            </button>

            {/* Admin Center Button ONLY visible when logged in as admin */}
            {isAdminActive && (
              <div className="flex items-center gap-1">
                <button
                  id="admin-action-btn"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 shadow-xs transition-all cursor-pointer"
                  title="Админ удирдлагын цонх нээх"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Админ удирдлага</span>
                </button>
                {onLogoutAdmin && (
                  <button
                    onClick={onLogoutAdmin}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl border border-stone-200 transition-colors cursor-pointer"
                    title="Админ горимоос гарах (Хэрэглэгчийн харагдац руу буцах)"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Cart Button */}
            <button
              id="cart-trigger-button"
              onClick={onOpenCart}
              className="relative flex items-center gap-2.5 bg-stone-900 hover:bg-stone-800 text-white px-3.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-transform active:scale-95 shadow-md shadow-stone-900/10 cursor-pointer"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col text-left leading-none">
                <span className="text-[10px] text-stone-400 uppercase font-medium">Сагс</span>
                <span className="text-xs font-bold text-amber-300">{formatMNT(cartTotal)}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2.5 sm:hidden">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Бараа хайх... (Рамен, кофе, живх...)"
              className="w-full pl-9 pr-4 py-2 text-xs bg-stone-100 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-500 focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Day Selector Quick Bar */}
        <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs text-stone-600 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-semibold text-stone-800">Өдөр тутмын онцгой хямдрал:</span>
          </div>
          <div className="flex items-center gap-1">
            {days.map((d) => {
              const isSelected = selectedDay === d.num;
              return (
                <button
                  key={d.num}
                  onClick={() => setSelectedDay(d.num)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

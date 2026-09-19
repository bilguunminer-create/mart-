import React, { useRef } from 'react';
import { ShoppingBag, Search, Sparkles, Truck, Phone, Award, ShieldCheck, LogOut, User, MapPin } from 'lucide-react';
import { STORE_CONFIG, formatMNT } from '../data/storeData';
import { LoyaltyTier, UserProfile } from '../types';
import { BeeEmblemLogo } from './BeeEmblemLogo';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenLoyalty: () => void;
  onOpenProfile?: () => void;
  user?: UserProfile | null;
  onOpenForms?: () => void;
  onOpenAdmin: () => void;
  onLogoutAdmin?: () => void;
  isAdminActive?: boolean;
  activeLoyalty: LoyaltyTier | null;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  dailyDealTitle: string;
  storePhone: string;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenLoyalty,
  onOpenProfile,
  user,
  onOpenForms,
  onOpenAdmin,
  onLogoutAdmin,
  isAdminActive,
  activeLoyalty,
  selectedDay,
  setSelectedDay,
  dailyDealTitle,
  storePhone
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
              title={user ? 'Лояалти зэрэглэл & оноо харах' : 'Гишүүнчлэл нь таны Бүртгэлтэй автоматаар холбогдоно'}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {user 
                  ? (activeLoyalty ? `${activeLoyalty.name} (${activeLoyalty.discount_pct}%)` : 'Гишүүнчлэл') 
                  : 'Гишүүнчлэл'}
              </span>
            </button>
            <span className="text-stone-500">|</span>
            <a href={`tel:${storePhone}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="w-3.5 h-3.5" />
              <span>{storePhone}</span>
            </a>

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
            <div className="relative group-hover:scale-105 transition-transform shrink-0">
              <BeeEmblemLogo size={46} className="w-11 h-11" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-xl tracking-tight text-stone-900 leading-none flex items-center gap-1.5">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-stone-900 font-serif font-black">
                    US&K
                  </span>
                  <span className="text-stone-900 font-sans font-extrabold">Family Mart</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 text-[10px] font-bold tracking-wider uppercase border border-amber-300/40">
                  ДАЛАНЗАДГАД
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">АНУ & БНСУ Баталгаат Бараа • 09:00 - 20:00</p>
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
            {/* Loyalty tier badge */}
            <button
              id="header-loyalty-btn"
              onClick={onOpenLoyalty}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                user && activeLoyalty
                  ? `${activeLoyalty.bg_color} ${activeLoyalty.text_color} border-amber-300/60 shadow-2xs`
                  : user
                  ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/70'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900'
              }`}
              title={
                user 
                  ? (activeLoyalty ? `${activeLoyalty.name} (${activeLoyalty.discount_pct}% хөнгөлөлттэй)` : 'Гишүүнчлэл') 
                  : 'Гишүүнчлэл нь таны Бүртгэлтэй автоматаар холбогдоно'
              }
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              {user ? (
                <>
                  <span className="hidden sm:inline">
                    {activeLoyalty ? `${activeLoyalty.badge} (${activeLoyalty.discount_pct}%)` : 'Лояалти (0%)'}
                  </span>
                  <span className="sm:hidden">
                    {activeLoyalty ? `${activeLoyalty.discount_pct}%` : 'Лояалти'}
                  </span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Гишүүнчлэл</span>
                  <span className="sm:hidden">Лояалти</span>
                </>
              )}
            </button>

            {/* User Profile & Security Button */}
            {onOpenProfile && (
              <button
                id="user-profile-trigger-btn"
                onClick={onOpenProfile}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/60 text-stone-700 hover:text-emerald-800 shadow-2xs transition-all cursor-pointer"
                title="Хэрэглэгчийн бүртгэл & Аюулгүй байдал, нууцлал"
              >
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-stone-600" />
                  {user && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-1 ring-white" />
                  )}
                </div>
                <span className="hidden sm:inline">
                  {user ? user.name : 'Бүртгэл'}
                </span>
                <span className="sm:hidden text-[11px] font-bold">
                  {user ? user.name.slice(0, 4) : 'Профайл'}
                </span>
              </button>
            )}

            {/* Google Forms Integration Button */}
            {onOpenForms && (
              <button
                id="google-forms-trigger-btn"
                onClick={onOpenForms}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-200 hover:border-purple-300 hover:bg-purple-50/60 text-stone-700 hover:text-purple-800 shadow-2xs transition-all cursor-pointer"
                title="Google Forms - Санал асуулга & Судалгаа"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="#7248B9"/>
                  <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                  <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="hidden sm:inline">Санал асуулга</span>
                <span className="sm:hidden text-[11px] font-bold">Forms</span>
              </button>
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

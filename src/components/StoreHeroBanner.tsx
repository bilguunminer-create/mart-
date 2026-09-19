import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Phone, Sparkles } from 'lucide-react';
import { BeeEmblemLogo } from './BeeEmblemLogo';
import { DEFAULT_STORE_BANNER } from '../data/brandAssets';

interface StoreHeroBannerProps {
  onExploreClick?: () => void;
  storePhone?: string;
}

export const StoreHeroBanner: React.FC<StoreHeroBannerProps> = ({ onExploreClick, storePhone = '7700-1122' }) => {
  const [customBanner, setCustomBanner] = useState<string | null>(() => {
    try {
      return localStorage.getItem('usk_custom_banner') || DEFAULT_STORE_BANNER;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        setCustomBanner(localStorage.getItem('usk_custom_banner') || null);
      } catch {
        // ignore
      }
    };
    window.addEventListener('usk_branding_updated', handleUpdate);
    return () => window.removeEventListener('usk_branding_updated', handleUpdate);
  }, []);

  // If user uploaded the exact original delguur_hayg.png file, show the raw full image directly
  if (customBanner) {
    return (
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border border-stone-800 bg-stone-950">
        <img
          src={customBanner}
          alt="US&K Family Mart Дэлгүүрийн Хаяг"
          className="w-full h-auto object-cover max-h-[360px] sm:max-h-[440px] block"
          referrerPolicy="no-referrer"
        />
        {/* Quick actions strip below banner */}
        <div className="bg-white text-stone-900 px-4 py-2 sm:py-2.5 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold">
          <div className="flex items-center gap-2 text-stone-900">
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <span className="tracking-wide uppercase font-extrabold text-stone-900">
              ДАЛАНЗАДГАД ХОТ
            </span>
            <span className="hidden sm:inline-block text-stone-400 font-normal">
              (Өмнөговь аймаг)
            </span>
          </div>

          <div className="flex items-center gap-4 text-stone-800 ml-auto sm:ml-0">
            <div className="flex items-center gap-1.5 text-stone-700">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="font-extrabold text-stone-900">09:00 - 20:00</span>
            </div>

            <span className="text-stone-300">|</span>

            <a 
              href={"tel:" + storePhone.replace(/\D/g, '')} 
              className="flex items-center gap-1.5 text-stone-900 hover:text-rose-600 transition-colors font-bold"
            >
              <Phone className="w-3.5 h-3.5 text-rose-600" />
              <span>Утас: {storePhone}</span>
            </a>

            {onExploreClick && (
              <button
                onClick={onExploreClick}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs px-3.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer ml-2"
              >
                Бараа үзэх
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default high-fidelity layout
  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border border-stone-800 bg-[#071329] text-white">
      {/* Top Accent Stripe: Orange & Purple Gradient */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-500" />

      {/* Main Banner Body */}
      <div className="relative px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
        
        {/* Left Section: Logo & Brand Name */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <div className="relative group">
            {/* Ambient glow behind logo */}
            <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-xl group-hover:bg-amber-500/30 transition-all pointer-events-none" />
            <div className="relative bg-stone-900/90 p-2 sm:p-2.5 rounded-2xl border border-amber-500/40 shadow-inner">
              <BeeEmblemLogo size={74} className="w-16 h-16 sm:w-20 sm:h-20" />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 sm:w-6 bg-amber-400" />
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 drop-shadow-sm font-serif">
                US & K
              </h1>
              <span className="h-0.5 w-4 sm:w-6 bg-amber-400" />
            </div>
            <h2 className="text-xs sm:text-base font-extrabold tracking-[0.22em] text-white uppercase mt-0.5 drop-shadow-md">
              FAMILY MART
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs text-amber-300/90 font-medium">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Баталгаат импортын бараа</span>
            </div>
          </div>
        </div>

        {/* Center Vertical Divider (Desktop) */}
        <div className="hidden lg:block w-px h-28 bg-gradient-to-b from-transparent via-stone-700 to-transparent" />

        {/* Center & Right: Catchphrase & Value Proposition */}
        <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start gap-3">
          {/* Main Title Badge: АМЕРИК & СОЛОНГОС БАРАА */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-md">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">АМЕРИК</span>
              {' & '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-400">СОЛОНГОС</span>
              {' '}БАРАА
            </h2>
          </div>

          {/* Sub Banner Pill: ХЯМД & ЧАНАРТАЙ ОНЦЛОХ ДЭЛГҮҮР */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-rose-600 via-purple-600 to-cyan-500 px-4 py-1.5 sm:py-2 rounded-full shadow-lg border border-white/20">
            <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide uppercase drop-shadow-xs">
              ✨ ХЯМД & ЧАНАРТАЙ
            </span>
            <span className="hidden sm:inline-block text-white/50">•</span>
            <span className="font-bold text-xs sm:text-sm text-amber-200 tracking-wide uppercase drop-shadow-xs">
              ОНЦЛОХ ДЭЛГҮҮР
            </span>
          </div>

          {/* Flags & Guarantee tag */}
          <p className="text-stone-300 text-xs sm:text-sm font-medium flex items-center gap-2 mt-1">
            <span>🇺🇸 АНУ-ын Costco, Kirkland</span>
            <span className="text-stone-500">|</span>
            <span>🇰🇷 БНСУ-ын шууд үйлдвэрийн хүнс & гоо сайхан</span>
          </p>
        </div>

        {/* Right CTA Button (Optional click) */}
        {onExploreClick && (
          <div className="shrink-0 flex items-center justify-center mt-2 lg:mt-0">
            <button
              onClick={onExploreClick}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              Бараа үзэх
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar: Location & Working Hours */}
      <div className="bg-white text-stone-900 px-4 py-2 sm:py-2.5 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold">
        {/* Location */}
        <div className="flex items-center gap-2 text-stone-900">
          <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="tracking-wide uppercase font-extrabold text-stone-900">
            ДАЛАНЗАДГАД ХОТ
          </span>
          <span className="hidden sm:inline-block text-stone-400 font-normal">
            (Өмнөговь аймаг, Төв хүргэлтийн цэг)
          </span>
        </div>

        {/* Hours & Contact */}
        <div className="flex items-center gap-4 text-stone-800 ml-auto sm:ml-0">
          <div className="flex items-center gap-1.5 text-stone-700">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="font-extrabold text-stone-900">09:00 - 20:00</span>
          </div>

          <span className="text-stone-300">|</span>

          <a 
            href={"tel:" + storePhone.replace(/\D/g, '')} 
            className="flex items-center gap-1.5 text-stone-900 hover:text-rose-600 transition-colors font-bold"
          >
            <Phone className="w-3.5 h-3.5 text-rose-600" />
            <span>Утас: {storePhone}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

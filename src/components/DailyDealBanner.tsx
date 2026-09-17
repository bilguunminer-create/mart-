import React from 'react';
import { Tag, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DAILY_DEALS } from '../data/storeData';

interface DailyDealBannerProps {
  selectedDay: number;
  onFilterDealCategory: (category: string) => void;
}

export const DailyDealBanner: React.FC<DailyDealBannerProps> = ({
  selectedDay,
  onFilterDealCategory
}) => {
  const deal = DAILY_DEALS[selectedDay.toString()] || DAILY_DEALS["1"];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white shadow-lg border border-stone-800">
      {/* Decorative gradient overlay */}
      <div className={`absolute top-0 right-0 w-96 h-96 rounded-full bg-gradient-to-br ${deal.color} opacity-25 blur-3xl -translate-y-12 translate-x-12 pointer-events-none`} />

      <div className="relative p-5 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <Tag className="w-3 h-3 text-rose-400" />
              {deal.day_name}-ийн онцлох хямдрал
            </span>
            <span className="flex items-center gap-1 text-[11px] text-stone-400">
              <Clock className="w-3 h-3 text-amber-400" />
              Өнөөдрийн 24:00 хүртэл идэвхтэй
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            {deal.title} <span className="text-rose-400">-{deal.discount_percent}%</span>
          </h2>

          <p className="text-stone-300 text-sm sm:text-base font-medium leading-relaxed">
            {deal.tagline}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-300">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Хямдрал сагсанд шууд бодогдоно
            </span>
            <span className="text-stone-600">•</span>
            <span>100,000 ₮-өөс дээш үнэгүй хүргэлттэй</span>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={() => onFilterDealCategory(deal.category)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md shadow-rose-900/40 transition-all cursor-pointer group"
          >
            <span>Энэ ангиллын барааг харах</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

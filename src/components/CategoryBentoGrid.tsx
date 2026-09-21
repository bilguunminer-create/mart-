import React from 'react';
import { LucideIcon, Utensils, Coffee, Pill, Baby, Home, Cookie, Sparkle } from 'lucide-react';
import { CATEGORIES } from '../data/storeData';
import { Product } from '../types';

interface CategoryBentoGridProps {
  products: Product[];
  onSelectCategory: (categoryId: string) => void;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  drinks: Coffee,
  vitamins: Pill,
  baby: Baby,
  household: Home,
  snacks: Cookie,
  beauty: Sparkle
};

// First tile renders as the large 2x2 hero cell; the rest fill the remaining grid cells.
const HERO_CATEGORY_ID = 'food';

export const CategoryBentoGrid: React.FC<CategoryBentoGridProps> = ({ products, onSelectCategory }) => {
  const tiles = CATEGORIES.filter((cat) => cat.id !== 'all');
  const heroTile = tiles.find((cat) => cat.id === HERO_CATEGORY_ID) ?? tiles[0];
  const restTiles = tiles.filter((cat) => cat.id !== heroTile.id);

  const countFor = (categoryId: string) =>
    products.filter((p) => p.category === categoryId && p.in_stock).length;

  const HeroIcon = CATEGORY_ICONS[heroTile.id] ?? Sparkle;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
          Ангиллаараа хайх
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 auto-rows-[132px] sm:auto-rows-[150px]">
        <button
          onClick={() => onSelectCategory(heroTile.id)}
          className="group col-span-2 row-span-2 rounded-2xl p-5 flex flex-col justify-between text-left bg-gradient-to-br from-amber-600 to-rose-700 text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <HeroIcon className="w-8 h-8 text-white/90" strokeWidth={1.6} />
          <div>
            <p className="font-serif font-semibold text-lg sm:text-xl leading-snug">{heroTile.name}</p>
            <p className="text-xs text-white/80 mt-0.5">{countFor(heroTile.id)} бараа</p>
          </div>
        </button>

        {restTiles.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] ?? Sparkle;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group rounded-2xl p-4 flex flex-col justify-between text-left bg-stone-100 hover:bg-amber-50 border border-stone-200/70 hover:border-amber-300 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <Icon className="w-6 h-6 text-stone-700 group-hover:text-amber-700 transition-colors" strokeWidth={1.6} />
              <div>
                <p className="font-bold text-stone-900 text-sm leading-snug">{cat.name}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{countFor(cat.id)} бараа</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

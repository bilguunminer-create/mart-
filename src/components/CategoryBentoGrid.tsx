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

// Real product photography representing each category, so the tiles show what's actually sold rather than generic icon art.
const CATEGORY_IMAGES: Record<string, string> = {
  food: '/categories/food.jpg',
  drinks: '/categories/drinks.jpg',
  baby: '/categories/baby.jpg',
  household: '/categories/household.jpg',
  snacks: '/categories/snacks.jpg',
  beauty: '/categories/beauty.jpg'
};

// Categories shown as a 2x2 collage of real supplement-bottle photos instead of
// one photo, so the tile reads as recognizable vitamin brands/bottles at a
// glance rather than a single close-up of loose pills (which reads as medicine).
const CATEGORY_COLLAGES: Record<string, [string, string, string, string]> = {
  vitamins: [
    '/categories/vitamins-1.jpg', // gummy vitamins jar
    '/categories/vitamins-2.jpg', // fish oil / omega softgel bottle
    '/categories/vitamins-3.jpg', // classic amber supplement bottle
    '/categories/vitamins-4.jpg'  // capsule bottle
  ]
};

const TileMedia: React.FC<{ categoryId: string; alt: string }> = ({ categoryId, alt }) => {
  const collage = CATEGORY_COLLAGES[categoryId];
  if (collage) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        {collage.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ))}
      </div>
    );
  }
  return (
    <img
      src={CATEGORY_IMAGES[categoryId]}
      alt={alt}
      referrerPolicy="no-referrer"
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
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
          className="group relative col-span-2 row-span-2 rounded-2xl overflow-hidden text-left shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <TileMedia categoryId={heroTile.id} alt={heroTile.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/25 to-stone-950/10" />
          <div className="relative h-full p-5 flex flex-col justify-between">
            <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <HeroIcon className="w-5 h-5 text-white" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-serif font-semibold text-lg sm:text-xl leading-snug text-white drop-shadow-sm">{heroTile.name}</p>
              <p className="text-xs text-white/85 mt-0.5">{countFor(heroTile.id)} бараа</p>
            </div>
          </div>
        </button>

        {restTiles.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] ?? Sparkle;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group relative rounded-2xl overflow-hidden text-left shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <TileMedia categoryId={cat.id} alt={cat.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/15 to-transparent" />
              <div className="relative h-full p-4 flex flex-col justify-between">
                <span className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-xs flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-bold text-white text-sm leading-snug drop-shadow-sm">{cat.name}</p>
                  <p className="text-[11px] text-white/80 mt-0.5">{countFor(cat.id)} бараа</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

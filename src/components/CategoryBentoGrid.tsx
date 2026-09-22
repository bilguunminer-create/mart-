import React from 'react';
import { LucideIcon, Utensils, Coffee, Pill, Baby, Home, Cookie, Sparkle } from 'lucide-react';
import { CATEGORIES } from '../data/storeData';
import { DEFAULT_CATEGORY_IMAGES } from '../data/categoryImageDefaults';
import { Product } from '../types';

interface CategoryBentoGridProps {
  products: Product[];
  categoryImages?: Record<string, string[]>;
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

// Renders 1 image full-bleed, or a collage grid for 2-4 images (admin-uploaded
// sets can be any count from 1 to 4; the built-in defaults are 1 or 4).
const TileMedia: React.FC<{ images: string[]; alt: string }> = ({ images, alt }) => {
  if (images.length <= 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }
  const gridClass = images.length === 2 ? 'grid-cols-2 grid-rows-1' : images.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2';
  return (
    <div className={`absolute inset-0 grid ${gridClass} gap-0.5`}>
      {images.slice(0, 4).map((src, i) => (
        <img
          key={i}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${images.length === 3 && i === 0 ? 'row-span-2' : ''}`}
        />
      ))}
    </div>
  );
};

// First tile renders as the large 2x2 hero cell; the rest fill the remaining grid cells.
const HERO_CATEGORY_ID = 'food';

export const CategoryBentoGrid: React.FC<CategoryBentoGridProps> = ({ products, categoryImages = {}, onSelectCategory }) => {
  const tiles = CATEGORIES.filter((cat) => cat.id !== 'all');
  const heroTile = tiles.find((cat) => cat.id === HERO_CATEGORY_ID) ?? tiles[0];
  const restTiles = tiles.filter((cat) => cat.id !== heroTile.id);

  const countFor = (categoryId: string) =>
    products.filter((p) => p.category === categoryId && p.in_stock).length;

  const imagesFor = (categoryId: string) => {
    const configured = categoryImages[categoryId];
    return configured && configured.length > 0 ? configured : (DEFAULT_CATEGORY_IMAGES[categoryId] ?? []);
  };

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
          <TileMedia images={imagesFor(heroTile.id)} alt={heroTile.name} />
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
              <TileMedia images={imagesFor(cat.id)} alt={cat.name} />
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

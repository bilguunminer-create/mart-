import React from 'react';
import { Plus, Minus, ShoppingBag, Eye } from 'lucide-react';
import { Product } from '../types';
import { formatMNT, DAILY_DEALS } from '../data/storeData';

interface ProductCardProps {
  product: Product;
  selectedDay: number;
  cartQuantity: number;
  onAddToCart: (product: Product, quantity?: number) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onOpenDetail: (product: Product) => void;
  isAdmin?: boolean;
  onEditProduct?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  selectedDay,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetail,
  isAdmin,
  onEditProduct
}) => {
  const currentDeal = DAILY_DEALS[selectedDay.toString()];
  // Check if this product is part of today's deal (respects day_deal === -1 for no deal)
  const isDealActive = product.day_deal !== -1 && (
    product.day_deal !== undefined 
      ? product.day_deal === selectedDay 
      : currentDeal?.category === product.category
  );
  const discountPercent = isDealActive ? (currentDeal?.discount_percent || 10) : 0;

  const finalPrice = discountPercent > 0
    ? Math.round(product.price * (1 - discountPercent / 100))
    : product.price;

  // A standing sale (admin-set old_price) only shows when today's rotating deal isn't already discounting this product.
  const hasStandingSale = !isDealActive && product.old_price != null && product.old_price > product.price;
  const standingSalePercent = hasStandingSale ? Math.round(((product.old_price! - product.price) / product.old_price!) * 100) : 0;

  const availableStock = product.stock_quantity !== undefined 
    ? product.stock_quantity 
    : (product.in_stock ? 18 : 0);
  const isOutOfStock = !product.in_stock || availableStock <= 0;
  const isLowStock = !isOutOfStock && availableStock <= 5;
  const isMaxInCart = cartQuantity >= availableStock;
  const oldPrice = isDealActive ? product.price : hasStandingSale ? product.old_price! : null;
  const savingPercent = isDealActive ? discountPercent : standingSalePercent;
  // One badge on the photo keeps the product visible; the most useful one wins.
  const badge = isOutOfStock
    ? { text: 'Түр дууссан', className: 'bg-stone-900/90 text-white' }
    : savingPercent > 0
      ? { text: `-${savingPercent}%`, className: 'bg-rose-600 text-white' }
      : isLowStock
        ? { text: 'Цөөн үлдсэн', className: 'bg-amber-500 text-stone-950' }
        : product.badge
          ? { text: product.badge, className: `${product.badge_color || 'bg-stone-900'} text-white` }
          : null;
  const details = [product.category_name, product.weight].map((part) => part?.trim()).filter(Boolean).join(' · ');

  return (
    <div className={`group relative flex flex-col overflow-hidden bg-white rounded-2xl border transition-all duration-300 ${
      isOutOfStock
        ? 'border-stone-200 opacity-80'
        : 'border-stone-200/80 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-900/10'
    }`}>
      {/* Photo: square and uniform so rows line up. The image is absolutely filled
          because a percentage height does not resolve inside this flex item. */}
      <div className="relative aspect-square w-full bg-stone-100 overflow-hidden cursor-pointer" onClick={() => onOpenDetail(product)}>
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
            !isOutOfStock ? 'group-hover:scale-105' : 'grayscale'
          }`}
          loading="lazy"
        />

        {badge && (
          <span className={`absolute top-2 left-2 ${badge.className} text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm`}>
            {badge.text}
          </span>
        )}

        {/* Origin flag & admin edit */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {isAdmin && onEditProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditProduct(product);
              }}
              className="bg-stone-900/90 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-md text-xs cursor-pointer transition-colors"
              title="Админ: Бараа засах"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <span
            className="w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-sm"
            title={product.origin === 'KR' ? 'Солонгос' : 'АНУ'}
          >
            {product.flag}
          </span>
        </div>
      </div>

      {/* Product Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col">
        {details && (
          <p className="text-[11px] text-stone-500 font-medium truncate">{details}</p>
        )}
        <h3
          onClick={() => onOpenDetail(product)}
          className="mt-0.5 font-semibold text-stone-900 text-sm sm:text-[15px] leading-snug line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] hover:text-rose-600 transition-colors cursor-pointer"
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Price and Actions */}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline flex-wrap gap-x-1.5 mb-2.5">
            <span className={`text-lg sm:text-xl font-black tracking-tight ${oldPrice ? 'text-rose-600' : 'text-stone-900'}`}>
              {formatMNT(finalPrice)}
            </span>
            {oldPrice && (
              <span className="text-xs text-stone-400 line-through">{formatMNT(oldPrice)}</span>
            )}
          </div>

          {/* Cart Quantity or Add Button */}
          {isOutOfStock ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-1.5 bg-stone-100 text-stone-400 font-semibold text-xs py-2.5 px-3 rounded-xl cursor-not-allowed"
            >
              <span>Түр дууссан</span>
            </button>
          ) : cartQuantity > 0 ? (
            <div className="flex items-center justify-between bg-stone-900 text-white rounded-xl p-1">
              <button
                onClick={() => onUpdateQuantity(product.id, cartQuantity - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone-800 transition-colors cursor-pointer text-white"
                aria-label="Багасгах"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="text-center">
                <span className="font-bold text-sm px-2 text-amber-400">{cartQuantity}</span>
                {isMaxInCart && (
                  <span className="block text-[9px] text-amber-300 font-medium leading-none">Дээд хязгаар</span>
                )}
              </div>
              <button
                disabled={isMaxInCart}
                onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isMaxInCart 
                    ? 'text-stone-600 cursor-not-allowed opacity-50' 
                    : 'text-white hover:bg-stone-800 cursor-pointer'
                }`}
                title={isMaxInCart ? 'Үлдэгдэлд хүрсэн байна' : 'Нэмэх'}
                aria-label="Нэмэх"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(product, 1)}
              className="w-full flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-rose-600 active:scale-[0.98] text-white font-bold text-xs sm:text-sm py-2.5 px-3 rounded-xl transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Сагслах</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

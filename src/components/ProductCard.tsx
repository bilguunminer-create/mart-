import React from 'react';
import { Plus, Minus, Star, ShoppingBag, Eye } from 'lucide-react';
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

  const availableStock = product.stock_quantity !== undefined 
    ? product.stock_quantity 
    : (product.in_stock ? 18 : 0);
  const isOutOfStock = !product.in_stock || availableStock <= 0;
  const isLowStock = !isOutOfStock && availableStock <= 5;
  const isMaxInCart = cartQuantity >= availableStock;

  return (
    <div className={`group relative flex flex-col bg-white rounded-2xl border transition-all duration-300 ${
      isOutOfStock 
        ? 'border-stone-200 opacity-80' 
        : 'border-stone-200/90 hover:shadow-xl hover:border-rose-300'
    }`}>
      {/* Top Image Container */}
      <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden cursor-pointer" onClick={() => onOpenDetail(product)}>
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-transform duration-500 ${
            !isOutOfStock ? 'group-hover:scale-105' : 'grayscale'
          }`}
          loading="lazy"
        />

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {product.badge && (
            <span className={`${product.badge_color} text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md shadow-xs`}>
              {product.badge}
            </span>
          )}

          {isDealActive && !isOutOfStock && (
            <span className="bg-rose-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs animate-pulse">
              -{discountPercent}% Онцгой
            </span>
          )}

          {isOutOfStock ? (
            <span className="bg-stone-900 text-rose-300 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md shadow-xs">
              Түр дууссан
            </span>
          ) : isLowStock ? (
            <span className="bg-amber-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs animate-pulse">
              Цөөн: {availableStock}ш
            </span>
          ) : null}
        </div>

        {/* Origin Flag Badge & Admin Edit Button */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
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
          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full text-xs font-semibold text-stone-800 shadow-xs flex items-center gap-1 border border-stone-200/60">
            <span>{product.flag}</span>
            <span>{product.origin === 'KR' ? 'Солонгос' : 'АНУ'}</span>
          </div>
        </div>

        {/* Quick View Hover Button */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 backdrop-blur-xs text-stone-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5" /> Дэлгэрэнгүй
          </span>
        </div>
      </div>

      {/* Product Content */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          {/* Category & Weight */}
          <div className="flex items-center justify-between text-[11px] text-stone-600 mb-1 font-medium">
            <span>{product.category_name}</span>
            <span className="bg-stone-100 text-stone-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">
              {product.weight}
            </span>
          </div>

          {/* Title */}
          <h3 
            onClick={() => onOpenDetail(product)}
            className="font-bold text-stone-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-rose-600 transition-colors cursor-pointer"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Description snippet */}
          <p className="text-stone-600 text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Bottom Price and Actions */}
        <div className="mt-4 pt-3 border-t border-stone-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  {formatMNT(finalPrice)}
                </span>
                {isDealActive && (
                  <span className="text-xs text-stone-500 line-through">
                    {formatMNT(product.price)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-500">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-bold text-stone-800">{product.rating}</span>
                <span className="text-stone-500">(баталгаат)</span>
              </div>
            </div>

            {isOutOfStock ? (
              <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Дууссан
              </span>
            ) : isLowStock ? (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                Үлдэгдэл {availableStock} ш
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Үлдэгдэл {availableStock} ш
              </span>
            )}
          </div>

          {/* Cart Quantity or Add Button */}
          {isOutOfStock ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-1.5 bg-stone-100 text-stone-400 font-semibold text-xs py-2 px-3 rounded-xl cursor-not-allowed border border-stone-200"
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
              className="w-full flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-900 hover:text-white text-stone-900 font-bold text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer group/btn"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-stone-600 group-hover/btn:text-amber-400 transition-colors" />
              <span>Сагслах</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Star, ShoppingBag, Plus, Minus, Truck, ShieldCheck, Check, MessageSquare, Clock } from 'lucide-react';
import { Product, UserProfile, ProductReview } from '../types';
import { formatMNT, DAILY_DEALS } from '../data/storeData';
import { getProductReviews, getMyProductReview, submitProductReview } from '../services/supabaseAuth';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  selectedDay: number;
  onAddToCart: (product: Product, quantity: number) => void;
  freeDeliveryThreshold: number;
  currentUser?: UserProfile | null;
  onRequireLogin?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  selectedDay,
  onAddToCart,
  freeDeliveryThreshold,
  currentUser,
  onRequireLogin
}) => {
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  // Reviews & ratings
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    if (!product) return;
    let active = true;
    setReviewsLoading(true);
    setReviewMessage('');
    const loadReviews = getProductReviews(product.id)
      .then((rows) => { if (active) setReviews(rows); })
      .catch(() => { if (active) setReviews([]); });
    const loadMine = currentUser?.accessToken
      ? getMyProductReview(currentUser.accessToken, product.id)
          .then((row) => { if (active) { setMyReview(row); if (row) { setReviewRating(row.rating); setReviewComment(row.comment); } } })
          .catch(() => { if (active) setMyReview(null); })
      : Promise.resolve();
    Promise.all([loadReviews, loadMine]).finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [product?.id, currentUser?.accessToken]);

  const handleSubmitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    if (!currentUser?.accessToken) { onRequireLogin?.(); return; }
    if (!reviewComment.trim()) { setReviewMessage('Сэтгэгдэлээ бичнэ үү.'); return; }
    setReviewBusy(true);
    setReviewMessage('');
    try {
      const saved = await submitProductReview(currentUser.accessToken, product.id, reviewRating, reviewComment.trim());
      setMyReview(saved);
      setReviewMessage('Баярлалаа! Таны сэтгэгдэл админ зөвшөөрсний дараа бусад хэрэглэгчдэд харагдана.');
    } catch (error: any) {
      setReviewMessage(error?.message || 'Сэтгэгдэл илгээхэд алдаа гарлаа.');
    } finally {
      setReviewBusy(false);
    }
  };

  if (!product) return null;

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : product.rating;

  const currentDeal = DAILY_DEALS[selectedDay.toString()];
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

  const handleAdd = () => {
    if (isOutOfStock) return;
    const safeQty = Math.min(quantity, availableStock);
    onAddToCart(product, safeQty);
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 my-6 flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close Button: sticky so it stays reachable even after scrolling the modal content. (position:fixed does not
            work here because the backdrop's blur filter creates its own containing block for fixed descendants; and the
            card itself must not use overflow-hidden, since that would make sticky stick to the card instead of the
            viewport. Corner rounding is applied to the first/last child below instead.) */}
        <div className="sticky top-0 z-20 h-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Image Banner */}
        <div className="relative aspect-16/10 w-full bg-stone-100 overflow-hidden rounded-t-3xl">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

          <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
            {product.badge && (
              <span className={`${product.badge_color} text-white text-xs font-bold px-3 py-1 rounded-lg shadow-md`}>
                {product.badge}
              </span>
            )}
            {isDealActive && (
              <span className="bg-rose-600 text-white text-xs font-black px-3 py-1 rounded-lg shadow-md animate-pulse">
                -{discountPercent}% Өдрийн хямдрал
              </span>
            )}
          </div>

          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold text-stone-800 shadow-md flex items-center gap-1.5 border border-stone-200">
            <span className="text-base">{product.flag}</span>
            <span>{product.country} импорт</span>
          </div>
        </div>

        {/* Details Content */}
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
              <span>{product.category_name}</span>
              <span className="bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded">
                Савлагаа: {product.weight}
              </span>
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 leading-tight">
              {product.name}
            </h3>

            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-black text-stone-900 text-sm">{product.rating}</span>
              </div>
              <span className="text-stone-300">•</span>
              {isOutOfStock ? (
                <span className="text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                  🚫 Агуулахад дууссан (0 ш)
                </span>
              ) : isLowStock ? (
                <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 animate-pulse">
                  ⚠️ Үлдэгдэл цөөн: {availableStock} ширхэг
                </span>
              ) : (
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  Бэлэн байгаа ({availableStock} ширхэг)
                </span>
              )}
            </div>
          </div>

          <p className="text-stone-600 text-sm leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">
            {product.description}
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs text-stone-600 pt-1">
            <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
              <Truck className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formatMNT(freeDeliveryThreshold)}-өөс дээш үнэгүй</span>
            </div>
            <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Үйлдвэрийн лацтай оригинал</span>
            </div>
          </div>

          {/* Pricing & Add to Cart Controls */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-stone-400 block font-medium">Нэгжийн үнэ:</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-stone-900">
                  {formatMNT(finalPrice)}
                </span>
                {isDealActive && (
                  <span className="text-sm text-stone-400 line-through">
                    {formatMNT(product.price)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quantity Picker */}
              {!isOutOfStock && (
                <div className="flex items-center bg-stone-100 border border-stone-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-bold text-stone-900 text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= availableStock}
                    onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      quantity >= availableStock 
                        ? 'text-stone-300 cursor-not-allowed' 
                        : 'text-stone-700 hover:bg-white cursor-pointer'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Add Button */}
              {isOutOfStock ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-stone-200 text-stone-500 font-bold px-6 py-3 rounded-xl cursor-not-allowed min-w-[140px]"
                >
                  <span>Бараа түр дууссан</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold px-6 py-3 rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer min-w-[140px]"
                >
                  {addedAnimation ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Сагсаллаа!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Сагслах ({formatMNT(finalPrice * quantity)})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reviews & Ratings */}
        <div className="border-t border-stone-200 bg-stone-50/60 p-6 space-y-4 rounded-b-3xl">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-stone-900 text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-rose-600" />
              <span>Хэрэглэгчийн сэтгэгдэл</span>
            </h4>
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-black text-stone-900">{averageRating.toFixed(1)}</span>
              <span className="text-stone-500">({reviews.length} сэтгэгдэл)</span>
            </div>
          </div>

          {currentUser?.accessToken ? (
            myReview && myReview.status !== 'rejected' ? (
              <div className={`rounded-xl border p-3 text-xs ${myReview.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <p className="font-bold flex items-center gap-1.5">
                  {myReview.status === 'approved' ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{myReview.status === 'approved' ? 'Таны сэтгэгдэл нийтлэгдсэн байна' : 'Таны сэтгэгдэл админы шалгалтад орсон байна'}</span>
                </p>
                <p className="mt-1 text-stone-600">"{myReview.comment}"</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setReviewRating(star)} className="cursor-pointer">
                      <Star className={`w-5 h-5 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Энэ бараатай холбоотой сэтгэгдэлээ бичнэ үү..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
                />
                {reviewMessage && <p className="text-[11px] text-rose-600 font-medium">{reviewMessage}</p>}
                <button
                  type="submit"
                  disabled={reviewBusy}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {reviewBusy ? 'Илгээж байна…' : 'Сэтгэгдэл илгээх'}
                </button>
              </form>
            )
          ) : (
            <button
              type="button"
              onClick={() => onRequireLogin?.()}
              className="w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-xs font-bold text-stone-600 hover:border-rose-300 hover:text-rose-600 cursor-pointer"
            >
              Сэтгэгдэл бичихийн тулд бүртгэлдээ нэвтэрнэ үү
            </button>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {reviewsLoading ? (
              <p className="text-xs text-stone-400 text-center py-3">Сэтгэгдэл ачаалж байна...</p>
            ) : reviews.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-3">Одоогоор сэтгэгдэл алга. Эхний сэтгэгдлийг та үлдээгээрэй!</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-stone-200 bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{review.customer_name}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-stone-600 leading-relaxed">{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

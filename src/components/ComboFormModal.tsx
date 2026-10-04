import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Check, AlertCircle, Sparkles, Trash2, Search } from 'lucide-react';
import { ComboPack, Product } from '../types';
import { processImageFile } from '../utils/imageUtils';

interface ComboFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  comboToEdit: ComboPack | null;
  products: Product[];
  preselectedProductIds?: string[];
  onSave: (combo: ComboPack) => Promise<void> | void;
  onDelete?: (comboId: string) => Promise<void> | void;
}

const DISCOUNT_OPTIONS = [5, 10, 15, 20];
const DEFAULT_DISCOUNT = 10;
const priceWithDiscount = (total: number, pct: number) => Math.max(100, Math.round((total * (100 - pct)) / 100 / 100) * 100);

export const ComboFormModal: React.FC<ComboFormModalProps> = ({
  isOpen,
  onClose,
  comboToEdit,
  products,
  preselectedProductIds = [],
  onSave,
  onDelete
}) => {
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('Багц');
  const [price, setPrice] = useState<number>(0);
  // While a discount button is active, the price follows the selected items' total.
  const [discountPct, setDiscountPct] = useState<number | null>(DEFAULT_DISCOUNT);
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const [search, setSearch] = useState('');

  const [useUrlMode, setUseUrlMode] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(comboToEdit);

  const selectedProducts = itemIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
  const itemsTotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);

  useEffect(() => {
    if (!isOpen) return;
    if (comboToEdit) {
      setName(comboToEdit.name);
      setBadge(comboToEdit.badge || 'Багц');
      setPrice(comboToEdit.price);
      setDiscountPct(null);
      setImage(comboToEdit.image);
      setDescription(comboToEdit.description);
      setItemIds(comboToEdit.items || []);
      setPublished(comboToEdit.published !== false);
      setUseUrlMode(Boolean(comboToEdit.image) && !comboToEdit.image.startsWith('data:'));
    } else {
      setName('');
      setBadge('Багц');
      setDiscountPct(DEFAULT_DISCOUNT);
      setImage('');
      setDescription('');
      setItemIds(preselectedProductIds);
      setPublished(false);
      setUseUrlMode(false);
    }
    setSearch('');
    setImageError(null);
    setFormError(null);
    setShowDeleteConfirm(false);
  }, [comboToEdit, isOpen]);

  if (!isOpen) return null;

  // While a discount button is active the price is derived from the items' total.
  const effectivePrice = discountPct !== null ? (itemsTotal > 0 ? priceWithDiscount(itemsTotal, discountPct) : 0) : price;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Зөвхөн зураг (JPG, PNG, WEBP) сонгоно уу.');
      return;
    }
    try {
      setIsProcessingImage(true);
      setImageError(null);
      setImage(await processImageFile(file));
    } catch (err: any) {
      setImageError(err?.message || 'Зураг боловсруулахад алдаа гарлаа.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const toggleItem = (productId: string) => {
    setItemIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  // Without an uploaded picture the combo uses its first product's photo.
  const effectiveImage = image.trim() || selectedProducts[0]?.image || '';
  const query = search.trim().toLowerCase();
  const visibleProducts = query ? products.filter((p) => p.name.toLowerCase().includes(query)) : products;
  const savingsAmount = Math.max(0, itemsTotal - Math.round(Number(effectivePrice) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (itemIds.length < 2) {
      setFormError('Багцад дор хаяж 2 бараа сонгоно уу.');
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Багцын нэрийг оруулна уу.');
      return;
    }
    const cleanPrice = Math.round(Number(effectivePrice));
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
      setFormError('Багцын зарах үнийг зөв оруулна уу.');
      return;
    }
    if (cleanPrice > itemsTotal) {
      setFormError('Багцын үнэ бараануудыг тусад нь авахаас үнэтэй байж болохгүй.');
      return;
    }
    const cleanImage = effectiveImage.trim();
    if (!cleanImage) {
      setFormError('Багцын зургийг оруулна уу.');
      return;
    }
    const lowerImage = cleanImage.toLowerCase();
    if (lowerImage.startsWith('javascript:') || lowerImage.startsWith('vbscript:') || lowerImage.startsWith('data:text/html')) {
      setFormError('Аюулгүй байдлын үүднээс буруу эсвэл сэжигтэй линк оруулахыг хориглоно.');
      return;
    }

    const savedCombo: ComboPack = {
      id: comboToEdit ? comboToEdit.id : `COMBO-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      badge: badge.trim().slice(0, 30) || 'Багц',
      price: cleanPrice,
      orig_price: itemsTotal,
      image: cleanImage,
      description: description.trim().slice(0, 2000) || selectedProducts.map((p) => p.name).join(' + '),
      items: itemIds,
      published,
    };

    setIsSaving(true);
    setFormError(null);
    try {
      await onSave(savedCombo);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Багц хадгалагдсангүй. Дахин оролдоно уу.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!comboToEdit || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(comboToEdit.id);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Багц устгагдсангүй. Дахин оролдоно уу.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const stepTitle = (step: number, title: string) => (
    <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center shrink-0">{step}</span>
      <span>{title}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold">
              {isEditing ? 'Багц засах' : 'Шинэ багц үүсгэх'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Items */}
          <div className="space-y-2">
            {stepTitle(1, `Бараа сонгох (${itemIds.length} сонгосон, дор хаяж 2)`)}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleItem(product.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg cursor-pointer hover:bg-indigo-100"
                    title="Багцаас хасах"
                  >
                    <span className="truncate max-w-[140px]">{product.name}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Барааны нэрээр хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-2xl p-1.5 space-y-0.5">
              {visibleProducts.map((product) => (
                <label
                  key={product.id}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl cursor-pointer text-xs ${itemIds.includes(product.id) ? 'bg-indigo-50' : 'hover:bg-stone-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={itemIds.includes(product.id)}
                    onChange={() => toggleItem(product.id)}
                    className="shrink-0"
                  />
                  <img src={product.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0" />
                  <span className="flex-1 truncate font-medium text-stone-800">{product.name}</span>
                  <span className="text-stone-500 shrink-0">{product.price.toLocaleString()}₮</span>
                </label>
              ))}
              {visibleProducts.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">{products.length === 0 ? 'Эхлээд бараа бүртгэнэ үү.' : 'Хайлтад тохирох бараа олдсонгүй.'}</p>
              )}
            </div>
          </div>

          {/* 2. Price */}
          <div className="space-y-2">
            {stepTitle(2, 'Үнэ')}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600">Тусад нь авбал нийт:</span>
                <span className="font-bold text-stone-900">{itemsTotal.toLocaleString()}₮</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-stone-600 mb-1.5">Хөнгөлөлт сонгох:</span>
                <div className="flex flex-wrap gap-1.5">
                  {DISCOUNT_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPct(pct)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${discountPct === pct ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-stone-700 border-stone-300 hover:border-indigo-400'}`}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="block text-[11px] font-semibold text-stone-600 mb-1">Багцын зарах үнэ (₮) — хүсвэл гараар өөрчилнө</span>
                <input
                  type="number"
                  required
                  min={100}
                  step={1}
                  value={effectivePrice || ''}
                  onChange={(e) => { setDiscountPct(null); setPrice(Number(e.target.value)); }}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-bold bg-white"
                />
              </label>
              {savingsAmount > 0 && (
                <p className="text-[11px] text-emerald-700 font-semibold">
                  Хэрэглэгч {savingsAmount.toLocaleString()}₮ хэмнэнэ.
                </p>
              )}
            </div>
          </div>

          {/* 3. Name & image */}
          <div className="space-y-2">
            {stepTitle(3, 'Нэр ба зураг')}
            <input
              type="text"
              required
              placeholder="Жишээ: Рамен ба зууш багц"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
            />
            <div className="flex items-center gap-3">
              {effectiveImage ? (
                <img src={effectiveImage} alt="" className="w-16 h-16 rounded-xl object-cover border border-stone-200 shrink-0" onError={() => setImageError('Зургийн линк буруу эсвэл харагдахгүй байна')} />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-stone-100 border border-dashed border-stone-300 shrink-0" />
              )}
              <div className="flex-1 space-y-1.5 text-xs">
                <p className="text-stone-500">
                  {isProcessingImage ? 'Зургийг боловсруулж байна...' : image.trim() ? 'Таны оруулсан зураг' : 'Зураг оруулаагүй бол эхний барааны зураг харагдана.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold border border-stone-300 rounded-lg hover:border-indigo-400 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" /> Зураг оруулах
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseUrlMode(!useUrlMode)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-indigo-700 cursor-pointer"
                  >
                    <LinkIcon className="w-3 h-3" /> Линкээр
                  </button>
                  {image.trim() && (
                    <button type="button" onClick={() => setImage('')} className="px-2.5 py-1.5 font-semibold text-stone-500 cursor-pointer">
                      Арилгах
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value = ''; }}
              />
            </div>
            {useUrlMode && (
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={image.startsWith('data:') ? '' : image}
                onChange={(e) => { setImageError(null); setImage(e.target.value); }}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
              />
            )}
            {imageError && <p className="text-[11px] text-rose-600 font-medium">{imageError}</p>}
          </div>

          {/* Optional extras */}
          <details className="rounded-2xl border border-stone-200 p-3.5 text-xs">
            <summary className="font-bold text-stone-700 cursor-pointer">Нэмэлт (заавал биш): тэмдэглэгээ, тайлбар</summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Онцлох тэмдэглэгээ</span>
                <input
                  type="text"
                  placeholder="Жишээ: Хэмнэлттэй"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Тайлбар (хоосон бол бараануудын нэрээр бөглөнө)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </label>
            </div>
          </details>

          {/* Published toggle */}
          <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
            <div>
              <span className="text-xs font-bold text-stone-800 block">Хэрэглэгчдэд нийтлэх</span>
              <span className="text-[11px] text-stone-500">
                Унтраавал багц зөвхөн админд харагдах ноорог хэвээр үлдэнэ
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Delete confirmation inline */}
          {isEditing && onDelete && showDeleteConfirm && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-3 text-xs text-rose-900">
              <p className="font-bold">Энэ багцыг бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? 'Устгаж байна…' : 'Тийм, устга'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-1.5 bg-white border border-stone-300 text-stone-700 font-bold rounded-lg cursor-pointer"
                >
                  Болих
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-200">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Багц устгах</span>
              </button>
            ) : <span />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Хадгалж байна…' : isEditing ? 'Хадгалах' : 'Багц үүсгэх'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

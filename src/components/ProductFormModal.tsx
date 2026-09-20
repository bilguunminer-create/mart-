import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../data/storeData';
import { processImageFile } from '../utils/imageUtils';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  onSave: (product: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSave
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('food');
  const [origin, setOrigin] = useState<'KR' | 'US'>('KR');
  const [price, setPrice] = useState<number>(0);
  const [weight, setWeight] = useState('');
  const [badge, setBadge] = useState('');
  const [badgeColor, setBadgeColor] = useState('bg-rose-500');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [inStock, setInStock] = useState(true);
  const [stockQuantity, setStockQuantity] = useState<number>(18);
  const [dayDeal, setDayDeal] = useState<number>(1);
  const [rating, setRating] = useState<number>(4.8);

  const [useUrlMode, setUseUrlMode] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setOrigin(productToEdit.origin);
      setPrice(productToEdit.price);
      setWeight(productToEdit.weight);
      setBadge(productToEdit.badge || '');
      setBadgeColor(productToEdit.badge_color || 'bg-rose-500');
      setImage(productToEdit.image);
      setImageUrlInput(productToEdit.image);
      setDescription(productToEdit.description);
      const initialStock = productToEdit.stock_quantity !== undefined 
        ? productToEdit.stock_quantity 
        : (productToEdit.in_stock ? 18 : 0);
      setStockQuantity(initialStock);
      setInStock(productToEdit.in_stock && initialStock > 0);
      const initialDayDeal = (productToEdit.day_deal !== undefined && productToEdit.day_deal !== null)
        ? productToEdit.day_deal
        : -1;
      setDayDeal(initialDayDeal);
      setRating(productToEdit.rating || 4.8);
      setUseUrlMode(!productToEdit.image.startsWith('data:'));
    } else {
      // Defaults for new product
      setName('');
      setCategory('food');
      setOrigin('KR');
      setPrice(5000);
      setWeight('100г');
      setBadge('Шинэ');
      setBadgeColor('bg-rose-500');
      setImage('');
      setImageUrlInput('');
      setDescription('');
      setStockQuantity(20);
      setInStock(true);
      setDayDeal(-1); // Default to no day deal (none)
      setRating(4.9);
      setUseUrlMode(false);
    }
    setImageError(null);
    setFormError(null);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Зөвхөн зураг (JPG, PNG, WEBP) сонгоно уу.');
      return;
    }

    try {
      setIsProcessingImage(true);
      setImageError(null);
      const processed = await processImageFile(file);
      setImage(processed);
      setImageUrlInput(processed);
    } catch (err: any) {
      setImageError(err?.message || 'Зураг боловсруулахад алдаа гарлаа.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Барааны нэрийг оруулна уу.');
      return;
    }
    if (cleanName.length > 200) {
      setFormError('Барааны нэр хэт урт байна (дээд тал нь 200 тэмдэгт).');
      return;
    }

    const cleanPrice = Number(price);
    if (isNaN(cleanPrice) || cleanPrice <= 0 || cleanPrice > 100000000) {
      setFormError('Барааны үнийг зөв оруулна уу (1₮ - 100,000,000₮ хооронд).');
      return;
    }

    const cleanImage = image.trim();
    if (!cleanImage) {
      setFormError('Барааны зургийг оруулна уу (файлаар эсвэл линкээр).');
      return;
    }

    // Security check: block javascript: and dangerous schemas
    if (
      cleanImage.toLowerCase().startsWith('javascript:') ||
      cleanImage.toLowerCase().startsWith('vbscript:') ||
      cleanImage.toLowerCase().startsWith('data:text/html')
    ) {
      setFormError('Аюулгүй байдлын үүднээс буруу эсвэл сэжигтэй линк оруулахыг хориглоно.');
      return;
    }

    const selectedCategoryObj = CATEGORIES.find(c => c.id === category);
    const categoryName = selectedCategoryObj ? selectedCategoryObj.name : 'Өргөн хэрэглээ';

    const finalStock = Math.max(0, Math.floor(Number(stockQuantity) || 0));
    const finalInStock = inStock && finalStock > 0;
    const cleanDayDeal = dayDeal === -1 ? -1 : (Number(dayDeal) >= 0 && Number(dayDeal) <= 6 ? Number(dayDeal) : -1);

    const savedProduct: Product = {
      id: productToEdit ? productToEdit.id : `PROD-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      category,
      category_name: categoryName,
      origin,
      country: origin === 'KR' ? 'БНСУ' : 'АНУ',
      flag: origin === 'KR' ? '🇰🇷' : '🇺🇸',
      price: cleanPrice,
      weight: weight.trim().slice(0, 50) || '1ш',
      badge: badge.trim().slice(0, 30),
      badge_color: badgeColor,
      image: cleanImage,
      description: description.trim().slice(0, 2000) || `${cleanName} - Чанартай баталгаат импортын бүтээгдэхүүн.`,
      in_stock: finalInStock,
      stock_quantity: finalStock,
      rating: Math.min(5, Math.max(1, Number(rating) || 4.8)),
      day_deal: cleanDayDeal
    };

    onSave(savedProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {productToEdit ? 'Барааны мэдээлэл засах' : 'Шинэ бараа нэмэх'}
              </h3>
              <p className="text-xs text-stone-400">Барааны зураг, үнэ, ангилал болон дэлгэрэнгүйг удирдах</p>
            </div>
          </div>
          <button
            id="close-product-form-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Image Uploader Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
                <span>Барааны зураг *</span>
              </label>
              <button
                type="button"
                onClick={() => setUseUrlMode(!useUrlMode)}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {useUrlMode ? (
                  <>
                    <Upload className="w-3 h-3" />
                    <span>Файлаас хуулах руу шилжих</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3 h-3" />
                    <span>Зургийн URL линкээр оруулах</span>
                  </>
                )}
              </button>
            </div>

            {/* Upload Area */}
            {!useUrlMode ? (
              <div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-stone-300 hover:border-rose-400 hover:bg-stone-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  {isProcessingImage ? (
                    <div className="py-4 flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-stone-500 font-medium">Зургийг оновчтой болгон боловсруулж байна...</span>
                    </div>
                  ) : image ? (
                    <div className="relative group w-full flex flex-col items-center py-2">
                      <img
                        src={image}
                        alt="Preview"
                        className="h-32 w-32 object-cover rounded-xl shadow-md border border-stone-200"
                      />
                      <span className="mt-2 text-xs text-rose-600 font-bold hover:underline">
                        Өөр зураг сонгох бол энд дарна уу
                      </span>
                    </div>
                  ) : (
                    <div className="py-4 space-y-1">
                      <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-stone-800">
                        Зургаа чирч оруулна уу, эсвэл товшиж сонгоно уу
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Утас болон компьютер дээрх ямар ч зураг (PNG, JPG, WEBP) шууд орно
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* URL Input mode */
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrlInput}
                  onChange={(e) => {
                    setImageUrlInput(e.target.value);
                    setImage(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono"
                />
                {image && (
                  <div className="flex items-center gap-3 p-2 bg-stone-50 rounded-xl border border-stone-200">
                    <img
                      src={image}
                      alt="URL Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                      onError={() => setImageError('Зургийн линк буруу эсвэл харагдахгүй байна')}
                    />
                    <div className="text-xs text-stone-600 truncate flex-1">
                      <span className="font-semibold text-stone-900 block">Зураг харагдаж байна</span>
                      <span className="text-[10px] text-stone-400 truncate block">{image}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {imageError && (
              <p className="text-[11px] text-rose-600 font-medium">{imageError}</p>
            )}
          </div>

          {/* Name & Origin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Барааны нэр *
              </label>
              <input
                type="text"
                required
                placeholder="Жишээ: Buldak Carbonara Рамен"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Гарал үүсэл *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOrigin('KR')}
                  className={`py-2 px-2 text-xs rounded-xl border font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    origin === 'KR'
                      ? 'border-rose-600 bg-rose-50 text-rose-700'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>🇰🇷</span>
                  <span>Солонгос</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrigin('US')}
                  className={`py-2 px-2 text-xs rounded-xl border font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    origin === 'US'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>АНУ</span>
                </button>
              </div>
            </div>
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Ангилал *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Үнэ (Төгрөгөөр ₮) *
              </label>
              <input
                type="number"
                required
                min={100}
                step={100}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Жин / Савлагаа
              </label>
              <input
                type="text"
                placeholder="Жишээ: 130г, 500мл, 90ш"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Badge & Day deal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Онцлох тэмдэглэгээ (Badge)
              </label>
              <input
                type="text"
                placeholder="Жишээ: Шинэ, Хит, Хямдралтай"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Өдрийн хямдралын гараг
              </label>
              <select
                value={dayDeal}
                onChange={(e) => setDayDeal(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 bg-white font-medium"
              >
                <option value={-1}>🚫 Гараг сонгохгүй (Өдрийн тусгай хямдралд хамаарахгүй)</option>
                <option value={1}>Даваа гараг (Рамен & Бэлэн хоол -15%)</option>
                <option value={2}>Мягмар гараг (Кофе, Цай, Ундаа -15%)</option>
                <option value={3}>Лхагва гараг (Амттан & Чипс -10%)</option>
                <option value={4}>Пүрэв гараг (Витамин & Эрүүл мэнд -15%)</option>
                <option value={5}>Баасан гараг (Хүүхдийн живх & Хоол -10%)</option>
                <option value={6}>Бямба гараг (Ахуйн угаалга & Цэвэрлэгээ -20%)</option>
                <option value={0}>Ням гараг (Гоо сайхан & Арьс арчилгаа -15%)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Барааны тайлбар
            </label>
            <textarea
              rows={3}
              placeholder="Барааны орц, онцлог, хэрэглэх заавар зэргийг бичнэ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Inventory Stock Count & In Stock Status */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200">
              <div>
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span>📦</span> Агуулахын бодит үлдэгдэл (Тоо ширхэг)
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Захиалга хийгдэх бүрт энэ тоо автоматаар хасагдана
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {stockQuantity <= 0 ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                    Үлдэгдэл 0 (Дууссан)
                  </span>
                ) : stockQuantity <= 5 ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    ⚠️ Үлдэгдэл цөөн ({stockQuantity}ш)
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Бэлэн ({stockQuantity}ш)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[120px]">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={stockQuantity}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setStockQuantity(val);
                    if (val > 0) setInStock(true);
                    else setInStock(false);
                  }}
                  className="w-full px-3.5 py-2 text-sm font-black border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  placeholder="Үлдэгдлийн тоо"
                />
                <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold">
                  ширхэг
                </span>
              </div>

              {/* Quick stock adjustment chips */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const next = stockQuantity + 5;
                    setStockQuantity(next);
                    if (next > 0) setInStock(true);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 cursor-pointer transition-colors"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = stockQuantity + 10;
                    setStockQuantity(next);
                    if (next > 0) setInStock(true);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 cursor-pointer transition-colors"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = stockQuantity + 25;
                    setStockQuantity(next);
                    if (next > 0) setInStock(true);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 cursor-pointer transition-colors"
                >
                  +25
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockQuantity(0);
                    setInStock(false);
                  }}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 cursor-pointer transition-colors"
                >
                  Дууссан (0)
                </button>
              </div>
            </div>

            {/* In Stock toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200/60">
              <div>
                <span className="text-xs font-bold text-stone-800 block">Дэлгүүрт борлуулах эсэх</span>
                <span className="text-[11px] text-stone-500">
                  Хэрэв унтраавал үлдэгдэлтэй байсан ч "Түр дууссан" харагдана
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStock && stockQuantity > 0}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setInStock(checked);
                    if (checked && stockQuantity === 0) {
                      setStockQuantity(10);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Болих
            </button>
            <button
              id="save-product-btn"
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{productToEdit ? 'Өөрчлөлтийг хадгалах' : 'Барааг бүртгэх'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

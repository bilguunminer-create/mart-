import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, Check, AlertCircle, Sparkles, Trash2 } from 'lucide-react';
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
  const [origPrice, setOrigPrice] = useState<number>(0);
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  const [useUrlMode, setUseUrlMode] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(comboToEdit);

  useEffect(() => {
    if (!isOpen) return;
    if (comboToEdit) {
      setName(comboToEdit.name);
      setBadge(comboToEdit.badge || 'Багц');
      setPrice(comboToEdit.price);
      setOrigPrice(comboToEdit.orig_price);
      setImage(comboToEdit.image);
      setImageUrlInput(comboToEdit.image);
      setDescription(comboToEdit.description);
      setItemIds(comboToEdit.items || []);
      setPublished(comboToEdit.published !== false);
      setUseUrlMode(!comboToEdit.image.startsWith('data:'));
    } else {
      const selected = products.filter((p) => preselectedProductIds.includes(p.id));
      const total = selected.reduce((sum, p) => sum + p.price, 0);
      setName('');
      setBadge('Багц');
      setPrice(total);
      setOrigPrice(total);
      setImage(selected[0]?.image || '');
      setImageUrlInput(selected[0]?.image || '');
      setDescription('');
      setItemIds(preselectedProductIds);
      setPublished(false);
      setUseUrlMode(false);
    }
    setImageError(null);
    setFormError(null);
    setShowDeleteConfirm(false);
  }, [comboToEdit, isOpen]);

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

  const toggleItem = (productId: string) => {
    setItemIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Багцын нэрийг оруулна уу.');
      return;
    }
    if (itemIds.length < 2) {
      setFormError('Багцад дор хаяж 2 бараа сонгоно уу.');
      return;
    }
    const cleanPrice = Number(price);
    const cleanOrigPrice = Number(origPrice);
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
      setFormError('Багцын зарах үнийг зөв оруулна уу.');
      return;
    }
    if (!Number.isFinite(cleanOrigPrice) || cleanOrigPrice < cleanPrice) {
      setFormError('Тусдаа авах нийт үнэ нь зарах үнээс бага байж болохгүй.');
      return;
    }
    const cleanImage = image.trim();
    if (!cleanImage) {
      setFormError('Багцын зургийг оруулна уу (файлаар эсвэл линкээр).');
      return;
    }
    if (
      cleanImage.toLowerCase().startsWith('javascript:') ||
      cleanImage.toLowerCase().startsWith('vbscript:') ||
      cleanImage.toLowerCase().startsWith('data:text/html')
    ) {
      setFormError('Аюулгүй байдлын үүднээс буруу эсвэл сэжигтэй линк оруулахыг хориглоно.');
      return;
    }

    const savedCombo: ComboPack = {
      id: comboToEdit ? comboToEdit.id : `COMBO-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      badge: badge.trim().slice(0, 30) || 'Багц',
      price: Math.round(cleanPrice),
      orig_price: Math.round(cleanOrigPrice),
      image: cleanImage,
      description: description.trim().slice(0, 2000) || itemIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join(' + '),
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

  const savingsAmount = Math.max(0, Math.round(Number(origPrice) || 0) - Math.round(Number(price) || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {isEditing ? 'Багцын мэдээлэл засах' : 'Шинэ багц үүсгэх'}
              </h3>
              <p className="text-xs text-stone-400">Багцад орох бараа, зураг, үнэ болон нийтлэх төлвийг удирдах</p>
            </div>
          </div>
          <button
            type="button"
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

          {/* Image Uploader */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Багцын зураг *</span>
              </label>
              <button
                type="button"
                onClick={() => setUseUrlMode(!useUrlMode)}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
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

            {!useUrlMode ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-stone-300 hover:border-indigo-400 hover:bg-stone-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]); }}
                />
                {isProcessingImage ? (
                  <div className="py-4 flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-stone-500 font-medium">Зургийг оновчтой болгон боловсруулж байна...</span>
                  </div>
                ) : image ? (
                  <div className="relative group w-full flex flex-col items-center py-2">
                    <img src={image} alt="Preview" className="h-32 w-32 object-cover rounded-xl shadow-md border border-stone-200" />
                    <span className="mt-2 text-xs text-indigo-600 font-bold hover:underline">Өөр зураг сонгох бол энд дарна уу</span>
                  </div>
                ) : (
                  <div className="py-4 space-y-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-stone-800">Зургаа чирч оруулна уу, эсвэл товшиж сонгоно уу</p>
                    <p className="text-[11px] text-stone-400">Утас болон компьютер дээрх ямар ч зураг (PNG, JPG, WEBP) шууд орно</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrlInput}
                  onChange={(e) => { setImageUrlInput(e.target.value); setImage(e.target.value); }}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
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
            {imageError && <p className="text-[11px] text-rose-600 font-medium">{imageError}</p>}
          </div>

          {/* Name & Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1">Багцын нэр *</label>
              <input
                type="text"
                required
                placeholder="Жишээ: 🔥 K-Food Ramen & Snack Party Багц"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Онцлох тэмдэглэгээ</label>
              <input
                type="text"
                placeholder="Жишээ: Хэмнэлттэй 18%"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Багцын зарах үнэ (₮) *</label>
              <input
                type="number"
                required
                min={100}
                step={100}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Тусдаа авбал нийт үнэ (₮) *</label>
              <input
                type="number"
                required
                min={100}
                step={100}
                value={origPrice}
                onChange={(e) => setOrigPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
          </div>
          {savingsAmount > 0 && (
            <p className="text-[11px] text-emerald-700 font-semibold -mt-2">
              Хэрэглэгч энэ багцаар {savingsAmount.toLocaleString()}₮ хэмнэнэ.
            </p>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Багцын тайлбар</label>
            <textarea
              rows={2}
              placeholder="Багцад орсон барааны нэрсийг товч тайлбарлана уу..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Item selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
              <span>Багцад орох бараанууд * ({itemIds.length} сонгосон)</span>
              {itemIds.length < 2 && <span className="text-[10px] text-rose-600 font-semibold">Дор хаяж 2 бараа сонгоно уу</span>}
            </label>
            <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-2xl p-2 space-y-1">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-stone-50 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={itemIds.includes(product.id)}
                    onChange={() => toggleItem(product.id)}
                    className="shrink-0"
                  />
                  <img src={product.image} alt={product.name} className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0" />
                  <span className="flex-1 truncate font-medium text-stone-800">{product.name}</span>
                  <span className="text-stone-400 shrink-0">{product.price.toLocaleString()}₮</span>
                </label>
              ))}
              {products.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">Эхлээд бараа бүртгэнэ үү.</p>
              )}
            </div>
          </div>

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
                <span>{isSaving ? 'Хадгалж байна…' : isEditing ? 'Өөрчлөлтийг хадгалах' : 'Багц үүсгэх'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

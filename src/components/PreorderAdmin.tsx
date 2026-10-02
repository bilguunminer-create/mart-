import React, { useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { PreorderProduct } from '../types';
import { formatMNT } from '../data/storeData';
import { validatePreorderProduct } from '../utils/preorderProducts';
import { PreorderImage } from './PreorderSection';

export interface PreorderAdminProps {
  products: PreorderProduct[];
  onSave: (products: PreorderProduct[]) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}

function PreorderEditor({ initial, onSave, onCancel, onUploadImage }: {
  initial: PreorderProduct;
  onSave: (product: PreorderProduct) => Promise<void>;
  onCancel: () => void;
  onUploadImage: PreorderAdminProps['onUploadImage'];
}) {
  const [draft, setDraft] = useState(initial);
  const [price, setPrice] = useState(initial.price === null ? '' : String(initial.price));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const inputClass = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100';
  const upload = async (file: File) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        throw new Error('5MB хүртэлх JPG, PNG эсвэл WEBP зураг сонгоно уу.');
      }
      const image = await onUploadImage(file);
      setDraft((previous) => ({ ...previous, image }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Зураг оруулахад алдаа гарлаа.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await onSave(validatePreorderProduct({ ...draft, price: price.trim() === '' ? null : Number(price) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Барааг хадгалах боломжгүй байна.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border border-amber-300 bg-white p-4 sm:p-6" aria-label="Захиалгын барааны мэдээлэл">
      <h3 className="mb-4 text-lg font-bold text-stone-900">Барааны мэдээлэл оруулах</h3>
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-5 disabled:opacity-70 md:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <PreorderImage image={draft.image} name={draft.name || 'Барааны зураг'} className="aspect-square w-full rounded-xl border border-stone-200 object-contain" />
          <label className="block text-sm font-semibold text-stone-700"><span className="mb-2 flex items-center gap-2"><Upload className="h-4 w-4" />Зураг оруулах</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:font-semibold file:text-amber-900" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
          </label>
          <p className="text-xs text-stone-500">JPG, PNG, WEBP · 5MB хүртэл</p>
          <label className="block text-xs font-semibold text-stone-600">Эсвэл зургийн холбоос<input type="url" value={draft.image} maxLength={2048} placeholder="https://..." onChange={(event) => setDraft({ ...draft, image: event.target.value })} className={inputClass} /></label>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-stone-700">Барааны нэр *<input autoFocus required maxLength={200} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} /></label>
          <label className="block text-sm font-semibold text-stone-700">Тайлбар, хэмжээ, захиалгын нөхцөл *<textarea required maxLength={3000} rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={inputClass} /></label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-700">Үнэ (₮)<input type="number" min={1} max={100000000} step={1} value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Хоосон бол үнэ лавлах" className={inputClass} /></label>
            <label className="block text-sm font-semibold text-stone-700">Гарал үүсэл<input maxLength={100} value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} placeholder="Жишээ: БНСУ" className={inputClass} /></label>
          </div>
          <label className="block text-sm font-semibold text-stone-700">Ирэх хугацаа<input maxLength={120} value={draft.lead_time} onChange={(event) => setDraft({ ...draft, lead_time: event.target.value })} placeholder="Жишээ: Захиалснаас хойш 7–14 хоног" className={inputClass} /></label>
          <label className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-stone-800"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-4 w-4 accent-amber-700" />Сайтад нийтлэх</label>
          <p className="text-xs text-stone-500">Нийтлэхийг сонгоогүй бараа зочдод харагдахгүй.</p>
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {busy && <span role="status" className="text-sm text-stone-500">Хадгалж байна…</span>}
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Болих</button>
        <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Хадгалах</button>
      </div>
    </form>
  );
}

export function PreorderAdmin({ products, onSave, onUploadImage }: PreorderAdminProps) {
  const [editing, setEditing] = useState<PreorderProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const persist = async (next: PreorderProduct[]) => {
    if (pending.current) throw new Error('Өмнөх өөрчлөлтийг хадгалж байна.');
    pending.current = true;
    setBusy(true);
    setError('');
    try { await onSave(next); }
    finally { pending.current = false; setBusy(false); }
  };
  const action = async (next: PreorderProduct[]) => {
    try { await persist(next); setDeleting(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Өөрчлөлтийг хадгалах боломжгүй байна.'); }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold text-stone-900">Захиалгаар ирэх боломжтой бараа</h2><p className="mt-1 text-sm text-stone-600">Зураг, үнэ, ирэх хугацаа болон захиалгын нөхцөлийг оруулна уу.</p></div>
        <button type="button" disabled={busy || !!editing} onClick={() => { setError(''); setDeleting(null); setEditing({ id: crypto.randomUUID(), name: '', image: '', description: '', price: null, lead_time: '', origin: '', published: false }); }} className="flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Бараа нэмэх</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {editing && <PreorderEditor initial={editing} onUploadImage={onUploadImage} onCancel={() => setEditing(null)} onSave={async (product) => {
        const exists = products.some((item) => item.id === product.id);
        await persist(exists ? products.map((item) => item.id === product.id ? product : item) : [product, ...products]);
        setEditing(null);
      }} />}
      {products.length === 0 && !editing && <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">Одоогоор бараа нэмээгүй байна. “Бараа нэмэх” товчоор эхлээрэй.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
            <PreorderImage image={product.image} name={product.name} className="mb-3 aspect-[4/3] w-full rounded-xl object-contain" />
            <span className={'rounded-full px-2 py-1 text-xs font-semibold ' + (product.published ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500')}>{product.published ? 'Нийтэлсэн' : 'Ноорог'}</span>
            <h3 className="mt-3 break-words font-bold text-stone-900">{product.name}</h3>
            <p className="mt-1 text-sm font-bold text-rose-600">{product.price === null ? 'Үнэ лавлах' : formatMNT(product.price)}</p>
            <p className="mt-1 text-xs text-stone-500">{product.lead_time || 'Ирэх хугацаа оруулаагүй'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy || !!editing} onClick={() => { setDeleting(null); setEditing(product); }} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Засах</button>
              <button type="button" disabled={busy || !!editing} onClick={() => void action(products.map((item) => item.id === product.id ? { ...item, published: !item.published } : item))} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{product.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{product.published ? 'Нуух' : 'Нийтлэх'}</button>
              <button type="button" disabled={busy || !!editing} onClick={() => setDeleting(product.id)} aria-label={product.name + ' устгах'} className="rounded-lg border border-rose-100 px-3 py-2 text-rose-600 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {deleting === product.id && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>“{product.name}” барааг устгах уу?</p><div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={() => void action(products.filter((item) => item.id !== product.id))} className="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white disabled:opacity-50">Устгах</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Болих</button></div></div>}
          </article>
        ))}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Clock, Package, Phone, Truck } from 'lucide-react';
import type { PreorderProduct } from '../types';
import { formatMNT } from '../data/storeData';

export function PreorderImage({ image, name, className = '' }: { image: string; name: string; className?: string }) {
  const [failedImage, setFailedImage] = useState('');
  return image && failedImage !== image
    ? <img src={image} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(image)} className={className} />
    : <div className={className + ' flex items-center justify-center bg-stone-100 text-stone-400'} role="img" aria-label={name + ' — зураг хараахан алга'}><Package className="h-12 w-12" /></div>;
}

export function PreorderSection({ products, storePhone, loading = false, error = false }: { products: PreorderProduct[]; storePhone: string; loading?: boolean; error?: boolean }) {
  const published = products.filter((product) => product.published);
  const phone = storePhone.replace(/[^+\d]/g, '');
  // An empty "coming soon" box makes the storefront look unfinished; show the
  // section only once there is something to order.
  if (loading || (!error && published.length === 0)) return null;
  return (
    <section id="preorder-products" aria-labelledby="preorder-heading" className="my-8 scroll-mt-40 rounded-3xl border border-amber-200 bg-amber-50/60 p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-2xl bg-amber-100 p-3 text-amber-800"><Truck className="h-6 w-6" /></span>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-800">Таны хүссэн барааг захиалгаар</p>
          <h2 id="preorder-heading" className="font-serif text-xl font-semibold text-stone-900 sm:text-2xl">Захиалгаар ирэх боломжтой бараа</h2>
          <p className="mt-2 text-sm text-stone-600">Таалагдсан барааныхаа үнэ, ирэх хугацааг дэлгүүртэй холбогдон баталгаажуулж захиалаарай.</p>
        </div>
      </div>
      {error ? <p role="alert" className="py-6 text-center text-sm text-amber-900">Мэдээлэл ачаалах боломжгүй байна. Хуудсаа дахин ачаална уу.</p> : loading ? <p className="py-6 text-center text-sm text-stone-500" role="status">Барааны мэдээллийг ачаалж байна…</p> : published.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-white/70 p-6 text-center text-sm text-stone-600">Захиалгаар авах барааны мэдээлэл удахгүй нэмэгдэнэ.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((product) => (
            <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
              <div className="relative bg-white">
                <PreorderImage image={product.image} name={product.name} className="aspect-[4/3] w-full object-contain p-3" />
                <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Захиалгаар ирнэ</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                {product.origin && <p className="text-xs font-semibold text-stone-500">{product.origin}</p>}
                <h3 className="break-words text-lg font-bold text-stone-900">{product.name}</h3>
                <p className="text-xl font-black text-rose-600">{product.price === null ? 'Үнэ лавлах' : formatMNT(product.price)}</p>
                <div className="flex items-start gap-2 text-sm text-stone-600"><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span>{product.lead_time || 'Ирэх хугацааг лавлана уу'}</span></div>
                <details className="text-sm text-stone-600">
                  <summary className="cursor-pointer py-1 font-semibold text-stone-800">Барааны мэдээлэл</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{product.description}</p>
                </details>
                {phone && <a href={'tel:' + phone} aria-label={product.name + ' захиалах талаар ' + storePhone + ' дугаарт лавлах'} className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-800"><Phone className="h-4 w-4" />Захиалах: {storePhone}</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
import type { PreorderProduct } from '../types';

export function validatePreorderProduct(product: PreorderProduct): PreorderProduct {
  const name = product.name.trim();
  const image = product.image.trim();
  const description = product.description.trim();
  const lead_time = product.lead_time.trim();
  const origin = product.origin.trim();
  if (!product.id || product.id.length > 100) throw new Error('Барааны дугаар буруу байна.');
  if (!name || name.length > 200) throw new Error('Барааны нэрийг 1–200 тэмдэгтээр оруулна уу.');
  if (!description || description.length > 3000) throw new Error('Тайлбарыг 1–3000 тэмдэгтээр оруулна уу.');
  let url: URL;
  try { url = new URL(image); } catch { throw new Error('Зураг эсвэл зургийн HTTPS холбоос оруулна уу.'); }
  if (url.protocol !== 'https:' || url.username || url.password || image.length > 2048) throw new Error('Зургийн HTTPS холбоос оруулна уу.');
  if (product.price !== null && (!Number.isSafeInteger(product.price) || product.price < 1 || product.price > 100_000_000)) {
    throw new Error('Үнийг 1–100,000,000₮ хооронд бүхэл тоогоор оруулна уу, эсвэл хоосон үлдээнэ үү.');
  }
  if (lead_time.length > 120 || origin.length > 100) throw new Error('Ирэх хугацаа эсвэл гарал үүслийн мэдээлэл хэт урт байна.');
  if (typeof product.published !== 'boolean') throw new Error('Нийтлэх төлөвийг сонгоно уу.');
  return { id: product.id, name, image, description, price: product.price, lead_time, origin, published: product.published };
}

export function readPreorderProducts(value: unknown): PreorderProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    try { return [validatePreorderProduct(item)]; } catch { return []; }
  });
}
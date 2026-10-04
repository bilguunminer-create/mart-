import type { InventorySuggestion } from '../utils/inventorySuggestion';

export async function requestInventorySuggestion(token: string, file: File, barcode: string, signal: AbortSignal): Promise<InventorySuggestion> {
  // Bound the payload below the serverless request limit; keep the original for upload.
  const bitmap = await createImageBitmap(file);
  let image: string;
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Зургийг AI хайлтад бэлтгэж чадсангүй.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    image = canvas.toDataURL('image/jpeg', 0.85);
  } finally { bitmap.close(); }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const response = await fetch('/api/inventory-ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ barcode, image }), signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'AI хайлт амжилтгүй байна. Гараар бөглөж болно.');
  return result;
}

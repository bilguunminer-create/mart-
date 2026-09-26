import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  ListChecks,
  PackageSearch,
  Save,
  Truck,
} from 'lucide-react';
import { ChatbotSettings } from '../types';
import { formatMNT } from '../data/storeData';

type LinkedSettings = {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  loyaltyCashbackPct: number;
};

type Props = {
  settings: ChatbotSettings;
  linkedSettings: LinkedSettings;
  productCount: number;
  onSave: (settings: ChatbotSettings, linkedSettings: LinkedSettings) => Promise<void> | void;
};

const fieldClassName = 'mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-xs text-stone-900 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
const textareaClassName = `${fieldClassName} min-h-24 resize-y leading-relaxed`;

export const ChatbotSettingsPanel: React.FC<Props> = ({ settings, linkedSettings, productCount, onSave }) => {
  const [draft, setDraft] = useState(settings);
  const [linkedDraft, setLinkedDraft] = useState(linkedSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => setLinkedDraft(linkedSettings), [
    linkedSettings.deliveryFee,
    linkedSettings.freeDeliveryThreshold,
    linkedSettings.loyaltyCashbackPct,
  ]);

  const update = (key: keyof ChatbotSettings, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!draft.workHours.trim()) {
      setMessage({ type: 'error', text: 'Дэлгүүрийн ажиллах цагийг оруулна уу.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const cleaned = (Object.keys(draft) as Array<keyof ChatbotSettings>).reduce<ChatbotSettings>(
        (result, key) => ({ ...result, [key]: draft[key].trim() }),
        { ...draft },
      );
      await onSave(cleaned, linkedDraft);
      setDraft(cleaned);
      setMessage({ type: 'success', text: 'Chatbot-ын мэдээлэл төв санд хадгалагдлаа.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Тохиргоог хадгалж чадсангүй.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className="flex flex-col gap-4 border-b border-stone-200 bg-stone-950 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-stone-950">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Chatbot тохиргоо</h2>
            <p className="mt-0.5 text-xs text-stone-400">AI хариултад ашиглах баталгаатай дэлгүүрийн мэдээлэл</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-xs font-black text-stone-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Хадгалж байна...' : 'Бүх тохиргоог хадгалах'}
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 border-b px-5 py-3 text-xs font-bold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="divide-y divide-stone-200">
        <section className="grid gap-4 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h3 className="text-sm font-black text-stone-900">1. Ажиллах цаг</h3>
              <p className="mt-1 text-[11px] text-stone-500">Ердийн болон тусгай өдрийн хуваарь</p>
            </div>
          </div>
          <label className="text-xs font-bold text-stone-700">
            Дэлгүүрийн ажиллах цаг
            <textarea value={draft.workHours} onChange={(event) => update('workHours', event.target.value)} maxLength={600} className={textareaClassName} />
          </label>
        </section>

        <section className="grid gap-4 bg-stone-50/70 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-stone-900">2. Хүргэлт</h3>
              <p className="mt-1 text-[11px] text-stone-500">Бүс, үнэ, хугацаа болон нэмэлт нөхцөл</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-stone-700">
              Хүргэлтийн бүс
              <textarea value={draft.deliveryZones} onChange={(event) => update('deliveryZones', event.target.value)} maxLength={1000} className={textareaClassName} />
            </label>
            <label className="text-xs font-bold text-stone-700">
              Хүргэлтийн хугацаа
              <textarea value={draft.deliveryDuration} onChange={(event) => update('deliveryDuration', event.target.value)} maxLength={600} className={textareaClassName} />
            </label>
            <label className="text-xs font-bold text-stone-700">
              Хүргэлтийн үндсэн үнэ (₮)
              <input type="number" min="0" step="500" value={linkedDraft.deliveryFee} onChange={(event) => setLinkedDraft((current) => ({ ...current, deliveryFee: Math.max(0, Number(event.target.value) || 0) }))} className={fieldClassName} />
            </label>
            <label className="text-xs font-bold text-stone-700">
              Үнэгүй хүргэлтийн босго (₮)
              <input type="number" min="0" step="1000" value={linkedDraft.freeDeliveryThreshold} onChange={(event) => setLinkedDraft((current) => ({ ...current, freeDeliveryThreshold: Math.max(0, Number(event.target.value) || 0) }))} className={fieldClassName} />
            </label>
            <label className="text-xs font-bold text-stone-700 sm:col-span-2">
              Хүргэлтийн нэмэлт нөхцөл
              <textarea value={draft.deliveryNotes} onChange={(event) => update('deliveryNotes', event.target.value)} maxLength={1200} className={textareaClassName} placeholder="Жишээ: Цаг агаар, алслагдсан бүс, захиалгын доод дүн..." />
            </label>
          </div>
        </section>

        <section className="grid gap-4 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black text-stone-900">3. Төлбөрийн нөхцөл</h3>
              <p className="mt-1 text-[11px] text-stone-500">Төлөх арга, баталгаажуулалт, цуцлалт</p>
            </div>
          </div>
          <label className="text-xs font-bold text-stone-700">
            Chatbot-ын тайлбарлах төлбөрийн нөхцөл
            <textarea value={draft.paymentTerms} onChange={(event) => update('paymentTerms', event.target.value)} maxLength={1600} className={textareaClassName} />
          </label>
        </section>

        <section className="grid gap-4 bg-stone-50/70 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <PackageSearch className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div>
              <h3 className="text-sm font-black text-stone-900">4. Үнэ ба үлдэгдэл</h3>
              <p className="mt-1 text-[11px] text-stone-500">{productCount} барааны бодит мэдээлэл холбогдсон</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-md bg-violet-100 px-2.5 py-1 text-violet-800">Үнэ: барааны сангаас</span>
              <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-800">Үлдэгдэл: агуулахаас</span>
            </div>
            <label className="block text-xs font-bold text-stone-700">
              Үнэ, үлдэгдлийн нэмэлт тайлбар
              <textarea value={draft.productNotes} onChange={(event) => update('productNotes', event.target.value)} maxLength={1200} className={textareaClassName} />
            </label>
          </div>
        </section>

        <section className="grid gap-4 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-black text-stone-900">5. Урамшуулал & loyalty</h3>
              <p className="mt-1 text-[11px] text-stone-500">Одоогийн суурь cashback: {linkedDraft.loyaltyCashbackPct}%</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="text-xs font-bold text-stone-700">
              Суурь cashback (%)
              <input type="number" min="0" max="100" step="0.1" value={linkedDraft.loyaltyCashbackPct} onChange={(event) => setLinkedDraft((current) => ({ ...current, loyaltyCashbackPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))} className={fieldClassName} />
            </label>
            <label className="text-xs font-bold text-stone-700">
              Одоогийн урамшуулал
              <textarea value={draft.promotions} onChange={(event) => update('promotions', event.target.value)} maxLength={1600} className={textareaClassName} placeholder="Идэвхтэй урамшуулал байхгүй бол хоосон үлдээнэ." />
            </label>
            <label className="text-xs font-bold text-stone-700 sm:col-span-2">
              Loyalty онооны нэмэлт тайлбар
              <textarea value={draft.loyaltyNotes} onChange={(event) => update('loyaltyNotes', event.target.value)} maxLength={1200} className={textareaClassName} />
            </label>
          </div>
        </section>

        <section className="grid gap-4 bg-stone-50/70 p-5 lg:grid-cols-[220px_1fr]">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
            <div>
              <h3 className="text-sm font-black text-stone-900">6. Захиалгын заавар</h3>
              <p className="mt-1 text-[11px] text-stone-500">Захиалга хийх үндсэн дараалал</p>
            </div>
          </div>
          <label className="text-xs font-bold text-stone-700">
            Хэрэглэгчид өгөх заавар
            <textarea value={draft.orderInstructions} onChange={(event) => update('orderInstructions', event.target.value)} maxLength={2000} className={`${textareaClassName} min-h-32`} />
          </label>
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-stone-500">Хүргэлтийн үнэ: {formatMNT(linkedDraft.deliveryFee)} · Үнэгүй босго: {formatMNT(linkedDraft.freeDeliveryThreshold)}</p>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-xs font-black text-white hover:bg-stone-800 disabled:opacity-60">
          <Save className="h-4 w-4" />
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      </div>
    </div>
  );
};

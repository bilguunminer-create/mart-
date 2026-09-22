import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ArrowLeft, Phone } from 'lucide-react';
import { SupportMessage, SupportThreadSummary } from '../services/supabaseAuth';

type Props = {
  threads: SupportThreadSummary[];
  onRefreshThreads: () => void;
  onOpenThread: (customerId: string) => Promise<SupportMessage[]>;
  onSendReply: (customerId: string, message: string) => Promise<void>;
  heightClassName?: string;
};

export const AdminSupportChat: React.FC<Props> = ({ threads, onRefreshThreads, onOpenThread, onSendReply, heightClassName = 'h-[560px]' }) => {
  const [selected, setSelected] = useState<SupportThreadSummary | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const openThread = async (thread: SupportThreadSummary) => {
    setSelected(thread);
    setLoadingThread(true);
    try {
      setMessages(await onOpenThread(thread.customer_id));
      onRefreshThreads();
    } catch {
      // The thread view simply stays empty; the admin can retry by reselecting it.
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      onOpenThread(selected.customer_id).then(setMessages).catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selected, onOpenThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      await onSendReply(selected.customer_id, text);
      setDraft('');
      setMessages(await onOpenThread(selected.customer_id));
      onRefreshThreads();
    } catch {
      // Best-effort: the admin can retry the send.
    } finally {
      setSending(false);
    }
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 ${heightClassName}`}>
      {/* Thread list */}
      <div className={`bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-stone-100 flex items-center justify-between">
          <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-amber-500" />
            Харилцагчид
          </h4>
          {totalUnread > 0 && (
            <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full">{totalUnread}</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {threads.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-8 px-4">Одоогоор чат мессеж алга байна.</p>
          )}
          {threads.map((t) => (
            <button
              key={t.customer_id}
              type="button"
              onClick={() => void openThread(t)}
              className={`w-full text-left p-3 hover:bg-stone-50 cursor-pointer transition-colors ${selected?.customer_id === t.customer_id ? 'bg-amber-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900 truncate">{t.customer_name || t.customer_email || t.customer_phone || 'Харилцагч'}</span>
                {t.unread_count > 0 && (
                  <span className="shrink-0 text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full">{t.unread_count}</span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                {t.last_sender === 'admin' ? 'Та: ' : ''}{t.last_message}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread detail */}
      <div className={`bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-xs text-stone-400">
            Зүүн талаас харилцагч сонгоно уу
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-stone-100 flex items-center gap-2">
              <button type="button" onClick={() => setSelected(null)} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-stone-100 cursor-pointer">
                <ArrowLeft className="w-4 h-4 text-stone-500" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-900 truncate">{selected.customer_name || selected.customer_email || 'Харилцагч'}</p>
                {selected.customer_phone && (
                  <a href={`tel:${selected.customer_phone}`} className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 hover:underline">
                    <Phone className="w-3 h-3" /> {selected.customer_phone}
                  </a>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
              {loadingThread && <p className="text-center text-xs text-stone-400 py-8">Ачааллаж байна...</p>}
              {!loadingThread && messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      m.sender === 'admin'
                        ? 'bg-stone-900 text-white rounded-br-sm'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    <p className="text-[9px] mt-1 text-stone-400">{new Date(m.created_at).toLocaleString('mn-MN')}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-stone-200 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Хариу бичих..."
                rows={1}
                maxLength={2000}
                className="flex-1 resize-none px-3.5 py-2.5 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-stone-50/50 max-h-24"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!draft.trim() || sending}
                className="p-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-stone-200 disabled:text-stone-400 text-stone-950 rounded-xl cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

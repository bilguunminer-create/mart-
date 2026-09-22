import React, { useEffect, useRef, useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { getMySupportMessages, sendSupportMessage, SupportMessage } from '../services/supabaseAuth';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
};

export const SupportChatModal: React.FC<Props> = ({ isOpen, onClose, accessToken }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      setMessages(await getMySupportMessages(accessToken));
      setLoaded(true);
    } catch {
      setError('Мессеж татахад алдаа гарлаа.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(accessToken, text);
      setDraft('');
      await load();
    } catch {
      setError('Мессеж илгээхэд алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl border border-stone-200 flex flex-col h-[85vh] sm:h-[600px]">
        <header className="flex items-center justify-between p-4 bg-stone-900 text-white sm:rounded-t-3xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center">
              <MessageCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black">Дэлгүүртэй холбогдох</h3>
              <p className="text-[11px] text-stone-400">Асуулт, санал хүсэлтээ энд бичээрэй</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
          {!loaded && <p className="text-center text-xs text-stone-400 py-8">Ачааллаж байна...</p>}
          {loaded && messages.length === 0 && (
            <div className="text-center text-xs text-stone-400 py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              Мессеж алга байна. Доор бичиж эхлээрэй!
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  m.sender === 'customer'
                    ? 'bg-stone-900 text-white rounded-br-sm'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`text-[9px] mt-1 ${m.sender === 'customer' ? 'text-stone-400' : 'text-stone-400'}`}>
                  {new Date(m.created_at).toLocaleString('mn-MN')}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 py-1.5 text-[11px] text-rose-600 bg-rose-50 border-t border-rose-100">{error}</p>}

        <div className="p-3 border-t border-stone-200 flex items-end gap-2 shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Мессежээ бичнэ үү..."
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
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Headphones, MessageCircle, Send, X } from 'lucide-react';
import {
  getMySupportMessages,
  getMySupportStatus,
  requestSupportHuman,
  sendChatbotMessage,
  SupportMessage,
  SupportStatus,
} from '../services/supabaseAuth';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
};

const DEFAULT_STATUS: SupportStatus = { bot_enabled: true, needs_human: false };

const QUICK_QUESTIONS = [
  'Дэлгүүрийн ажиллах цаг',
  'Хүргэлтийн бүс, үнэ, хугацаа',
  'Төлбөрийн нөхцөл',
  'Барааны үнэ болон үлдэгдэл',
  'Урамшуулал, loyalty оноо',
  'Захиалга хийх заавар',
] as const;

export const SupportChatModal: React.FC<Props> = ({ isOpen, onClose, accessToken }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState<SupportStatus>(DEFAULT_STATUS);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [requestingHuman, setRequestingHuman] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const [nextMessages, nextStatus] = await Promise.all([
        getMySupportMessages(accessToken),
        getMySupportStatus(accessToken),
      ]);
      setMessages(nextMessages);
      setStatus(nextStatus);
      setLoaded(true);
      setError(null);
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
  }, [messages, sending]);

  if (!isOpen) return null;

  const handleSend = async (quickQuestion?: string) => {
    const text = (quickQuestion ?? draft).trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    try {
      await sendChatbotMessage(accessToken, text);
      await load();
    } catch (sendError) {
      setDraft(text);
      setError(sendError instanceof Error ? sendError.message : 'Мессеж илгээхэд алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSending(false);
    }
  };

  const handleRequestHuman = async () => {
    if (requestingHuman || status.needs_human) return;
    setRequestingHuman(true);
    setError(null);
    try {
      await requestSupportHuman(accessToken);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Админд шилжүүлэхэд алдаа гарлаа.');
    } finally {
      setRequestingHuman(false);
    }
  };

  const statusText = status.needs_human
    ? 'Админы хариуг хүлээж байна'
    : status.bot_enabled
      ? 'AI туслах онлайн'
      : 'Админ хариулж байна';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl border border-stone-200 flex flex-col h-[85vh] sm:h-[600px]">
        <header className="flex items-center justify-between p-4 bg-stone-900 text-white sm:rounded-t-3xl shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center shrink-0">
              {status.bot_enabled && !status.needs_human ? <Bot className="w-4.5 h-4.5" /> : <MessageCircle className="w-4.5 h-4.5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black truncate">US&K туслах</h3>
              <p className={`text-[11px] truncate ${status.needs_human ? 'text-amber-300' : 'text-stone-400'}`}>{statusText}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer" title="Чат хаах">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-stone-200 bg-white px-3 py-3">
          <p className="mb-2 text-[10px] font-black uppercase text-stone-500">Түгээмэл асуулт</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_QUESTIONS.map((question, index) => (
              <button
                key={question}
                type="button"
                onClick={() => void handleSend(question)}
                disabled={!loaded || sending || !status.bot_enabled || status.needs_human}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-left text-[10px] font-bold leading-tight text-stone-700 transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-100 text-[9px] font-black text-amber-800">{index + 1}</span>
                <span className="break-words">{question}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
          {!loaded && <p className="text-center text-xs text-stone-400 py-8">Ачааллаж байна...</p>}
          {loaded && messages.length === 0 && (
            <div className="text-center text-xs text-stone-500 py-8 px-6">
              <Bot className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              Бараа, хүргэлт, төлбөр болон дэлгүүрийн мэдээллээ асуугаарай.
            </div>
          )}
          {messages.map((message) => {
            const isCustomer = message.sender === 'customer';
            const isBot = message.sender === 'bot';
            return (
              <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    isCustomer
                      ? 'bg-stone-900 text-white rounded-br-sm'
                      : isBot
                        ? 'bg-amber-50 border border-amber-200 text-stone-800 rounded-bl-sm'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                  }`}
                >
                  {!isCustomer && (
                    <p className={`text-[9px] font-black mb-1 ${isBot ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isBot ? 'AI туслах' : 'Дэлгүүрийн админ'}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.message}</p>
                  <p className="text-[9px] mt-1 text-stone-400">{new Date(message.created_at).toLocaleString('mn-MN')}</p>
                </div>
              </div>
            );
          })}
          {sending && status.bot_enabled && !status.needs_human && (
            <div className="flex justify-start">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[11px] font-semibold">
                AI туслах хариулж байна...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 py-1.5 text-[11px] text-rose-600 bg-rose-50 border-t border-rose-100">{error}</p>}

        <div className="px-3 pt-2 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] text-stone-500 truncate">AI-ийн хариултыг чухал шийдвэртээ нягтална уу.</p>
          <button
            type="button"
            onClick={() => void handleRequestHuman()}
            disabled={requestingHuman || status.needs_human}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-stone-700 hover:bg-stone-100 disabled:text-stone-400 rounded-lg cursor-pointer disabled:cursor-default"
          >
            <Headphones className="w-3.5 h-3.5" />
            {status.needs_human ? 'Админд шилжсэн' : 'Админтай холбох'}
          </button>
        </div>

        <div className="p-3 pt-2 flex items-end gap-2 shrink-0">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={status.needs_human ? 'Админд нэмэлт мэдээлэл бичих...' : 'Асуултаа бичнэ үү...'}
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none px-3.5 py-2.5 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-500 bg-stone-50/50 max-h-24"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!draft.trim() || sending}
            className="p-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-stone-200 disabled:text-stone-400 text-stone-950 rounded-xl cursor-pointer transition-colors shrink-0"
            title="Мессеж илгээх"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

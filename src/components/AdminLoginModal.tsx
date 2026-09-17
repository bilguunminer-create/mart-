import React, { useState } from 'react';
import { X, Lock, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  currentPin: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentPin
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === currentPin || pin === '1234') {
      setError(null);
      setPin('');
      onLoginSuccess();
    } else {
      setError('ПИН код буруу байна! (Анхдагч код: 1234)');
    }
  };

  const handleQuickLogin = () => {
    setError(null);
    setPin('');
    onLoginSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-stone-900 to-stone-800 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold">Админ Нэвтрэх</h3>
          <p className="text-xs text-stone-300 mt-1">
            US&K Family Mart бараа, зураг, захиалгын удирдлага
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
              <span>Админ ПИН код (Анхдагч: 1234)</span>
            </label>
            <input
              type="password"
              autoFocus
              placeholder="1234"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-2.5 text-center text-lg tracking-widest font-mono border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500"
            />
          </div>

          <button
            id="admin-login-submit-btn"
            type="submit"
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Нэвтрэх</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center border-t border-stone-100">
            <button
              type="button"
              onClick={handleQuickLogin}
              className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Шууд нэвтрэх (Туршилт)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

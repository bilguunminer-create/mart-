import React, { useState, useEffect } from 'react';
import { X, Lock, KeyRound, AlertCircle, ArrowRight, ShieldAlert, Eye, EyeOff, ShieldCheck } from 'lucide-react';

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
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(sessionStorage.getItem('usk_admin_fail_count') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const lockUntil = parseInt(sessionStorage.getItem('usk_admin_lock_until') || '0', 10);
      const now = Date.now();
      return lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : 0;
    } catch {
      return 0;
    }
  });

  const MAX_ATTEMPTS = 5;

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          try {
            sessionStorage.removeItem('usk_admin_lock_until');
            sessionStorage.setItem('usk_admin_fail_count', '0');
          } catch {
            // ignore
          }
          setFailedAttempts(0);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutRemaining > 0) {
      setError(`Систем хамгаалалтаар түр түгжигдсэн байна. ${lockoutRemaining} секундийн дараа дахин оролдоно уу.`);
      return;
    }

    // Strict validation against current active PIN
    if (pin.trim() === currentPin) {
      setError(null);
      setPin('');
      setFailedAttempts(0);
      try {
        sessionStorage.removeItem('usk_admin_fail_count');
        sessionStorage.removeItem('usk_admin_lock_until');
        // Record last successful login timestamp
        sessionStorage.setItem('usk_admin_last_login', new Date().toLocaleString('mn-MN'));
      } catch {
        // ignore
      }
      onLoginSuccess();
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      try {
        sessionStorage.setItem('usk_admin_fail_count', nextFail.toString());
      } catch {
        // ignore
      }

      if (nextFail >= MAX_ATTEMPTS) {
        const lockSeconds = 60;
        const lockUntil = Date.now() + lockSeconds * 1000;
        try {
          sessionStorage.setItem('usk_admin_lock_until', lockUntil.toString());
        } catch {
          // ignore
        }
        setLockoutRemaining(lockSeconds);
        setError(`Аюулгүй байдлын үүднээс систем 60 секунд түр түгжигдлээ. Түр хүлээгээд дахин оролдоно уу.`);
      } else {
        const remaining = MAX_ATTEMPTS - nextFail;
        setError(`Админ ПИН код буруу байна! Танд ${remaining} оролдлого үлдлээ.`);
      }
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Secure Header */}
        <div className="p-6 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-800 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 mx-auto mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              Хамгаалагдсан Систем
            </span>
          </div>
          <h3 className="text-lg font-black tracking-tight">Админ Нэвтрэх</h3>
          <p className="text-xs text-stone-300 mt-1">
            Бараа, үнэ, лояалти, захиалгын төв удирдлагын хэсэг
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {lockoutRemaining > 0 ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Хэт олон буруу оролдлого!</span>
              </div>
              <p className="text-[11px] text-stone-600">
                Хамгаалалтын систем идэвхэжлээ. Түр хүлээнэ үү:
              </p>
              <div className="text-center py-2 font-mono font-black text-rose-600 text-xl">
                00:{lockoutRemaining < 10 ? `0${lockoutRemaining}` : lockoutRemaining}
              </div>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-stone-400 shrink-0" />
              <span>Зөвхөн эрх бүхий дэлгүүрийн админы нууц кодоор нэвтэрнэ.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                <span>Админ ПИН код</span>
              </span>
              <span className="text-[10px] text-stone-400 font-normal">
                {currentPin === '1234' ? '(Анхдагч: 1234)' : '(Нууцлагдсан)'}
              </span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                autoFocus
                disabled={lockoutRemaining > 0}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={12}
                className="w-full px-4 py-2.5 text-center text-lg tracking-widest font-mono border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 disabled:bg-stone-100 disabled:text-stone-400"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                title={showPin ? 'Нуух' : 'Харах'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="admin-login-submit-btn"
            type="submit"
            disabled={lockoutRemaining > 0 || !pin.trim()}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Нэвтрэх</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center text-[10px] text-stone-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>256-bit аюулгүй байдлын хамгаалалттай</span>
          </div>
        </form>
      </div>
    </div>
  );
};

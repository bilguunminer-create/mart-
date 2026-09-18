import React, { useEffect, useMemo, useState } from 'react';
import { X, User, Mail, MapPin, Phone, LogOut, KeyRound } from 'lucide-react';
import { UserProfile, OrderDetails, LoyaltyTier } from '../types';
import { formatMNT } from '../data/storeData';
import { AuthSession, signIn, requestSignupOtp, verifySignupOtp, sendPasswordReset, updatePassword, getProfile, saveProfile } from '../services/supabaseAuth';

interface Props {
  isOpen: boolean; onClose: () => void; user: UserProfile | null;
  onSaveUser: (user: UserProfile) => void; onLogoutUser: () => void;
  orders: OrderDetails[]; activeLoyalty: LoyaltyTier | null; totalSpent: number;
}
type Mode = 'login' | 'signup' | 'recover' | 'reset';
type SignupStep = 'details' | 'otp' | 'password';

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose, user, onSaveUser, onLogoutUser, orders, activeLoyalty, totalSpent }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('details');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [signupSession, setSignupSession] = useState<AuthSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    const type = hash.get('type');
    if (!token) return;

    if (type === 'recovery') {
      setRecoveryToken(token); setMode('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Supabase's default confirmation email returns a signed-in session in the URL hash.
    // Keep it in memory and let the new member choose their permanent password.
    if (type === 'signup' || type === 'email') {
      try {
        const encodedPayload = token.split('.')[1];
        const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.sub) {
          setSignupSession({ access_token: token, user: { id: payload.sub, email: payload.email } });
          setEmail(payload.email || '');
          setMode('signup'); setSignupStep('password');
          setMessage('И-мэйл баталгаажлаа. Одоо өөрийн нууц үгээ үүсгэнэ үү.');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        setMessage('Баталгаажуулах холбоосыг дахин илгээнэ үү.');
      }
    }
  }, []);

  const ownOrders = useMemo(() => orders.filter(o => o.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase()), [orders, user]);
  if (!isOpen) return null;

  const switchMode = (next: Mode) => {
    setMode(next); setPassword(''); setPasswordConfirm(''); setOtp(''); setMessage('');
    if (next === 'signup') setSignupStep('details');
  };

  const profileFromSession = async (session: AuthSession, fallback: { name: string; phone: string; address: string }) => {
    const existing = await getProfile(session.access_token, session.user.id);
    return {
      id: session.user.id, supabaseUserId: session.user.id, accessToken: session.access_token,
      name: existing?.name || fallback.name || email.split('@')[0], email: email.trim().toLowerCase(),
      phone: existing?.phone || fallback.phone, address: existing?.address || fallback.address,
      district: 'Өмнөговь, Даланзадгад', createdAt: new Date().toLocaleDateString('mn-MN'),
      isVerified: true, privacyMasking: true, loginMethod: 'email' as const,
    } satisfies UserProfile;
  };

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === 'recover') {
        await sendPasswordReset(cleanEmail);
        setMessage('Хэрэв энэ и-мэйл бүртгэлтэй бол нууц үг сэргээх холбоос илгээгдэнэ.');
        return;
      }
      if (mode === 'reset') {
        if (!recoveryToken) throw new Error('Сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.');
        if (password.length < 8) throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.');
        if (password !== passwordConfirm) throw new Error('Нууц үгүүд таарахгүй байна.');
        await updatePassword(recoveryToken, password);
        setMessage('Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.');
        setMode('login'); setPassword(''); setPasswordConfirm('');
        return;
      }
      if (mode === 'signup') {
        if (signupStep === 'details') {
          if (!name.trim()) throw new Error('Нэрээ оруулна уу.');
          await requestSignupOtp(cleanEmail, { name: name.trim(), phone, address });
          setSignupStep('otp');
          setMessage('И-мэйлээр баталгаажуулах код илгээгдлээ. Кодоо оруулна уу.');
          return;
        }
        if (signupStep === 'otp') {
          if (!/^\\d{6,8}$/.test(otp)) throw new Error('И-мэйлээр ирсэн 6–8 оронтой кодоо оруулна уу.');
          const session = await verifySignupOtp(cleanEmail, otp);
          setSignupSession(session); setSignupStep('password'); setOtp('');
          setMessage('Код баталгаажлаа. Одоо өөрийн нууц үгээ үүсгэнэ үү.');
          return;
        }
        if (!signupSession) throw new Error('Баталгаажуулалтын хугацаа дууссан байна. Кодыг дахин авна уу.');
        if (password.length < 8) throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.');
        if (password !== passwordConfirm) throw new Error('Нууц үгүүд таарахгүй байна.');
        await updatePassword(signupSession.access_token, password);
        const nextProfile = await profileFromSession(signupSession, { name: name.trim(), phone, address });
        await saveProfile(signupSession.access_token, signupSession.user.id, nextProfile);
        onSaveUser(nextProfile); onClose();
        return;
      }

      if (password.length < 8) throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.');
      const session = await signIn(cleanEmail, password);
      const nextProfile = await profileFromSession(session, { name: '', phone: '', address: '' });
      onSaveUser(nextProfile); onClose();
    } catch (error: any) {
      setMessage(error?.message || 'Нэвтрэх боломжгүй байна.');
    } finally { setBusy(false); }
  }

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault(); if (!user?.accessToken || !user.supabaseUserId) return;
    setBusy(true); setMessage('');
    try {
      const next = { ...user, name: name.trim(), phone, address };
      await saveProfile(user.accessToken, user.supabaseUserId, next);
      onSaveUser(next); setMessage('Мэдээлэл хадгалагдлаа.');
    } catch (error: any) { setMessage(error?.message || 'Хадгалах боломжгүй байна.'); }
    finally { setBusy(false); }
  }

  const unauthenticated = !user || mode === 'reset';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"><section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
    <header className="flex items-center justify-between bg-stone-900 px-6 py-5 text-white"><div className="flex items-center gap-3"><User className="text-amber-300"/><div><h2 className="font-black">Миний бүртгэл</h2><p className="text-xs text-stone-300">Захиалга, гишүүнчлэл нэг и-мэйлд хадгалагдана</p></div></div><button onClick={onClose} aria-label="Хаах"><X/></button></header>
    <div className="p-6">{message && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    {unauthenticated ? <form onSubmit={authenticate} className="space-y-4">
      {mode === 'signup' && signupStep === 'details' && <><label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></>}
      {mode !== 'reset' && !(mode === 'signup' && signupStep === 'password') && <label className="block text-sm font-bold">И-мэйл<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required readOnly={mode==='signup' && signupStep==='otp'} className="mt-1 w-full rounded-xl border p-3"/></label>}
      {mode === 'signup' && signupStep === 'otp' && <label className="block text-sm font-bold">И-мэйлээр ирсэн баталгаажуулах код<input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\\D/g,'').slice(0,8))} required className="mt-1 w-full rounded-xl border p-3 text-center text-xl tracking-[0.5em]"/></label>}
      {(mode === 'login' || mode === 'reset' || (mode === 'signup' && signupStep === 'password')) && <><label className="block text-sm font-bold">{mode==='signup'?'Шинэ нууц үг':'Нууц үг'}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border p-3"/></label>{(mode === 'reset' || (mode === 'signup' && signupStep === 'password')) && <label className="block text-sm font-bold">Нууц үг давтах<input type="password" value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border p-3"/></label>}</>}
      <button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">{busy?'Түр хүлээнэ үү…':mode==='login'?'Нэвтрэх':mode==='recover'?'Сэргээх холбоос илгээх':mode==='reset'?'Шинэ нууц үг хадгалах':signupStep==='details'?'Баталгаажуулах код илгээх':signupStep==='otp'?'Код баталгаажуулах':'Бүртгэл үүсгэж нэвтрэх'}</button>
      {mode !== 'reset' && <div className="flex justify-between text-xs font-bold text-amber-800"><button type="button" onClick={()=>switchMode('login')}>Нэвтрэх</button><button type="button" onClick={()=>switchMode('signup')}>Шинэ бүртгэл</button><button type="button" onClick={()=>switchMode('recover')}>Нууц үгээ мартсан</button></div>}
    </form> : <><section className="mb-5 rounded-2xl bg-amber-50 p-4"><p className="font-black">{activeLoyalty ? activeLoyalty.badge+' '+activeLoyalty.name : 'Энгийн гишүүн'}</p><p className="text-sm">Нийт худалдан авалт: <b>{formatMNT(totalSpent)}</b> · {ownOrders.length} захиалга</p></section>
      <form onSubmit={updateProfile} className="space-y-4"><p className="text-sm text-stone-600"><Mail className="mr-1 inline h-4 w-4"/>{user.email}</p><label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">Мэдээлэл хадгалах</button></form>
      <div className="mt-4 flex justify-end text-xs font-bold"><button onClick={()=>{onLogoutUser();onClose();}} className="text-rose-700"><LogOut className="mr-1 inline h-4 w-4"/>Гарах</button></div></>}
    </div></section></div>;
};

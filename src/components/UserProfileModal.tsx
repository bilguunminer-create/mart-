import React, { useEffect, useMemo, useState } from 'react';
import { X, User, Mail, Lock, MapPin, Phone, LogOut, Award, KeyRound } from 'lucide-react';
import { UserProfile, OrderDetails, LoyaltyTier } from '../types';
import { formatMNT } from '../data/storeData';
import { signIn, signUp, sendPasswordReset, updatePassword, getProfile, saveProfile } from '../services/supabaseAuth';

interface Props {
  isOpen: boolean; onClose: () => void; user: UserProfile | null;
  onSaveUser: (user: UserProfile) => void; onLogoutUser: () => void;
  orders: OrderDetails[]; activeLoyalty: LoyaltyTier | null; totalSpent: number;
}
type Mode = 'login' | 'signup' | 'recover' | 'reset';

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose, user, onSaveUser, onLogoutUser, orders, activeLoyalty, totalSpent }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access_token');
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type');
    if (token && recovery === 'recovery') {
      setRecoveryToken(token);
      setMode('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const ownOrders = useMemo(() => orders.filter(o => o.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase()), [orders, user]);
  if (!isOpen) return null;

  const switchMode = (next: Mode) => { setMode(next); setPassword(''); setMessage(''); };

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === 'reset') {
        if (!recoveryToken) throw new Error('Сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.');
        await updatePassword(recoveryToken, password);
        setMessage('Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.');
        setPassword('');
        setMode('login');
        return;
      }
      if (mode === 'recover') {
        await sendPasswordReset(cleanEmail);
        setMessage('Хэрэв энэ и-мэйл бүртгэлтэй бол нууц үг сэргээх холбоос илгээгдэнэ.');
        return;
      }
      if (password.length < 8) throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.');
      const result = mode === 'signup'
        ? await signUp(cleanEmail, password, { name: name.trim(), phone, address })
        : { session: await signIn(cleanEmail, password), user: undefined };
      const session = result.session;
      if (!session) {
        setMessage('Бүртгэл үүслээ. И-мэйлээр ирсэн баталгаажуулах холбоосыг нээгээд нэвтэрнэ үү.');
        return;
      }
      const existing = await getProfile(session.access_token, session.user.id);
      const nextProfile: UserProfile = {
        id: session.user.id, supabaseUserId: session.user.id, accessToken: session.access_token,
        name: existing?.name || name.trim() || cleanEmail.split('@')[0], email: cleanEmail,
        phone: existing?.phone || phone, address: existing?.address || address,
        district: 'Өмнөговь, Даланзадгад', createdAt: new Date().toLocaleDateString('mn-MN'),
        isVerified: true, privacyMasking: true, loginMethod: 'email',
      };
      await saveProfile(session.access_token, session.user.id, nextProfile);
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

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"><section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
    <header className="flex items-center justify-between bg-stone-900 px-6 py-5 text-white"><div className="flex items-center gap-3"><User className="text-amber-300"/><div><h2 className="font-black">Миний бүртгэл</h2><p className="text-xs text-stone-300">Захиалга, гишүүнчлэл нэг и-мэйлд хадгалагдана</p></div></div><button onClick={onClose} aria-label="Хаах"><X/></button></header>
    <div className="p-6">{message && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    {!user ? <form onSubmit={authenticate} className="space-y-4">
      {mode === 'signup' && <label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label>}
      <label className="block text-sm font-bold">И-мэйл<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label>
      {mode !== 'recover' && <label className="block text-sm font-bold">Нууц үг<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border p-3"/></label>}
      {mode === 'signup' && <><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></>}
      <button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">{busy?'Түр хүлээнэ үү…':mode==='login'?'Нэвтрэх':mode==='signup'?'Бүртгүүлэх':mode==='reset'?'Шинэ нууц үг хадгалах':'Сэргээх холбоос илгээх'}</button>
      <div className="flex justify-between text-xs font-bold text-amber-800"><button type="button" onClick={()=>switchMode('login')}>Нэвтрэх</button><button type="button" onClick={()=>switchMode('signup')}>Шинэ бүртгэл</button><button type="button" onClick={()=>switchMode('recover')}>Нууц үгээ мартсан</button></div>
    </form> : <><section className="mb-5 rounded-2xl bg-amber-50 p-4"><p className="font-black">{activeLoyalty ? activeLoyalty.badge+' '+activeLoyalty.name : 'Энгийн гишүүн'}</p><p className="text-sm">Нийт худалдан авалт: <b>{formatMNT(totalSpent)}</b> · {ownOrders.length} захиалга</p></section>
      <form onSubmit={updateProfile} className="space-y-4"><p className="text-sm text-stone-600"><Mail className="mr-1 inline h-4 w-4"/>{user.email}</p><label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">Мэдээлэл хадгалах</button></form>
      <div className="mt-4 flex justify-between text-xs font-bold"><button onClick={()=>switchMode('recover')} className="text-amber-800"><KeyRound className="mr-1 inline h-4 w-4"/>Нууц үг сэргээх</button><button onClick={()=>{onLogoutUser();onClose();}} className="text-rose-700"><LogOut className="mr-1 inline h-4 w-4"/>Гарах</button></div></>}
    </div></section></div>;
};

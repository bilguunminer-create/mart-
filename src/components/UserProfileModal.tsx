import React, { useEffect, useMemo, useState } from 'react';
import { X, User, Mail, MapPin, Phone, LogOut, KeyRound, ChevronDown, ReceiptText, XCircle, Camera } from 'lucide-react';
import { UserProfile, OrderDetails, LoyaltyTier } from '../types';
import { formatMNT, formatOrderNumber } from '../data/storeData';
import { AuthSession, signIn, requestSignupOtp, resendSignupOtp, verifySignupOtp, resolveAuthCallback, getAuthUser, getAuthErrorMessage, normalizeSignupProfile, signOutSession, sendPasswordReset, updatePassword, getProfile, saveProfile, getStoreOrders, getLoyaltyWallet, cancelMyStoreOrder, expireMyUnpaidOrders, uploadProfileImage, saveProfileAvatar } from '../services/supabaseAuth';
import { printOrderReceipt } from '../utils/printReceipt';
import { belongsToUser } from '../utils/orderOwnership';

interface Props {
  isOpen: boolean; onClose: () => void; user: UserProfile | null;
  onSaveUser: (user: UserProfile) => void; onLogoutUser: () => void;
  orders: OrderDetails[]; activeLoyalty: LoyaltyTier | null; totalSpent: number;
}
type Mode = 'login' | 'signup' | 'recover' | 'reset';
type SignupStep = 'details' | 'otp' | 'password';

// Kept per tab so a reload during the password step can resume the signup.
const SIGNUP_TOKEN_KEY = 'usk_signup_token';
function forgetSignupToken() {
  try { sessionStorage.removeItem(SIGNUP_TOKEN_KEY); } catch { /* storage may be disabled */ }
}

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
  const [remoteOrders, setRemoteOrders] = useState<OrderDetails[]>([]);
  const [walletPoints, setWalletPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [orderRefresh, setOrderRefresh] = useState(0);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  // Show the password step for a verified signup and remember it for this tab.
  function resumeSignup(session: AuthSession, notice: string) {
    try { sessionStorage.setItem(SIGNUP_TOKEN_KEY, session.access_token); } catch { /* keep the in-memory session */ }
    setSignupSession(session);
    setEmail(session.user.email || '');
    setName(session.user.user_metadata?.name || '');
    setPhone(session.user.user_metadata?.phone || '');
    setAddress(session.user.user_metadata?.address || '');
    setMode('signup'); setSignupStep('password');
    setMessage(notice);
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.accessToken) return;
    setAvatarBusy(true); setMessage('');
    try {
      const url = await uploadProfileImage(user.accessToken, file);
      await saveProfileAvatar(user.accessToken, url);
      onSaveUser({ ...user, avatarUrl: url });
      setMessage('Профайлын зураг шинэчлэгдлээ.');
    } catch (error: any) {
      setMessage(error?.message || 'Профайлын зургийг хадгалах боломжгүй байна.');
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setAddress(user.address || '');
  }, [user?.id, user?.name, user?.email, user?.phone, user?.address]);

  useEffect(() => {
    let active = true;
    const callbackHash = window.location.hash;
    const callbackSearch = window.location.search;
    const completeCallback = async () => {
      try {
        const callback = await resolveAuthCallback(callbackHash, callbackSearch);
        if (!active) return;
        if (!callback) {
          let savedRecovery: string | null = null;
          try { savedRecovery = sessionStorage.getItem('usk_recovery_token'); } catch { /* storage may be disabled */ }
          if (savedRecovery) {
            await getAuthUser(savedRecovery);
            if (active) { setRecoveryToken(savedRecovery); setMode('reset'); }
            return;
          }
          // A verified signup that was interrupted (reload/closed tab) before the
          // password step would otherwise leave the account with an unknown password.
          let savedSignup: string | null = null;
          try { savedSignup = sessionStorage.getItem(SIGNUP_TOKEN_KEY); } catch { /* storage may be disabled */ }
          if (savedSignup) {
            try {
              const signupUser = await getAuthUser(savedSignup);
              if (!signupUser.email_confirmed_at || signupUser.is_anonymous) throw new Error('unverified');
              if (active) resumeSignup({ access_token: savedSignup, user: signupUser }, 'Бүртгэлээ дуусгахын тулд нууц үгээ үүсгэнэ үү.');
            } catch {
              forgetSignupToken();
              if (active) setMessage('Бүртгэлийн баталгаажуулалтын хугацаа дууссан. «Нууц үг сэргээх» хэсгээр нууц үгээ тохируулна уу.');
            }
          }
          return;
        }
        const { session } = callback;
        if (callback.type === 'recovery') {
          try { sessionStorage.setItem('usk_recovery_token', session.access_token); } catch { /* keep the in-memory token */ }
          setRecoveryToken(session.access_token); setMode('reset');
        } else {
          resumeSignup(session, 'И-мэйл баталгаажлаа. Одоо өөрийн нууц үгээ үүсгэнэ үү.');
        }
      } catch (error) {
        if (active) {
          try { sessionStorage.removeItem('usk_recovery_token'); } catch { /* storage may be disabled */ }
          setMessage(getAuthErrorMessage(error));
        }
      } finally {
        if (active) {
          const url = new URL(window.location.href);
          const keys = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'type', 'error', 'error_code', 'error_description'];
          const hash = new URLSearchParams(url.hash.slice(1));
          const hasCallback = keys.some(key => url.searchParams.has(key) || hash.has(key));
          if (hasCallback) {
            for (const key of keys) { url.searchParams.delete(key); hash.delete(key); }
            url.hash = hash.toString();
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
          }
        }
      }
    };
    void completeCallback();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isOpen || !user?.accessToken) return;
    let active = true;
    const loadOrders = async () => {
      try {
      await expireMyUnpaidOrders(user.accessToken).catch(() => undefined);
      // Read the wallet after expiry has committed any point refunds.
      const wallet = await getLoyaltyWallet(user.accessToken).catch(() => null);
      if (!active) return;
      if (wallet) {
        setWalletPoints(wallet.available_points || 0);
        setLifetimePoints(wallet.lifetime_earned || 0);
      }
      const rows = await getStoreOrders(user.accessToken);
      if (!active) return;
      setRemoteOrders(rows.map((order) => ({
        orderId: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        customerName: order.customer_name,
        phone: order.phone,
        address: order.address,
        district: 'Өмнөговь, Даланзадгад',
        notes: order.note || '',
        paymentMethod: 'cod',
        items: (order.items || []).map((item) => ({ type: 'product', id: item.productId, name: item.title, price: item.price, originalPrice: item.price, image: '', quantity: item.quantity })),
        subtotal: order.subtotal,
        dailyDiscount: order.daily_discount,
        loyaltyDiscount: order.vip_discount,
        paymentStatus: order.payment_status,
        paymentReportedAt: order.payment_reported_at || undefined,
        deliveryFee: order.delivery_fee,
        total: order.total,
        date: new Date(order.created_at).toLocaleString('mn-MN'),
        status: order.status === 'Дууссан' ? 'delivered' : order.status === 'Цуцалсан' ? 'cancelled' : order.status === 'Хүргэлтэд' ? 'shipping' : order.status === 'Баталгаажсан' ? 'confirmed' : 'new',
      })));
      } catch { if (active) setMessage('Захиалгын түүхийг шинэчилж чадсангүй. Дахин оролдоно уу.'); }
    };
    void loadOrders();
    const poll = window.setInterval(() => void loadOrders(), 15000);
    return () => { active = false; window.clearInterval(poll); };
  }, [isOpen, user?.accessToken, orderRefresh]);

  const ownOrders = useMemo(() => {
    const mergedOrders = [...remoteOrders, ...orders.filter(order => !remoteOrders.some(remote => remote.orderId === order.orderId))];
    return mergedOrders.filter(order => belongsToUser(order, user));
  }, [orders, remoteOrders, user]);
  if (!isOpen) return null;

  const switchMode = (next: Mode) => {
    setMode(next); setPassword(''); setPasswordConfirm(''); setOtp(''); setMessage('');
    setSignupSession(null);
    if (next === 'signup') setSignupStep('details');
  };

  const profileFromSession = async (session: AuthSession, fallback: { name: string; phone: string; address: string }) => {
    const existing = await getProfile(session.access_token, session.user.id);
    const metadata = session.user.user_metadata;
    return {
      id: session.user.id, supabaseUserId: session.user.id, accessToken: session.access_token, refreshToken: session.refresh_token,
      name: existing?.name || fallback.name || metadata?.name || session.user.email?.split('@')[0] || 'Гишүүн', email: session.user.email || email.trim().toLowerCase(),
      phone: existing?.phone || fallback.phone || metadata?.phone || '', address: existing?.address || fallback.address || metadata?.address || '',
      avatarUrl: existing?.avatar_url,
      district: 'Өмнөговь, Даланзадгад', createdAt: new Date().toLocaleDateString('mn-MN'),
      isVerified: true, privacyMasking: true, loginMethod: 'email' as const,
    } satisfies UserProfile;
  };

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
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
        try { sessionStorage.removeItem('usk_recovery_token'); } catch { /* storage may be disabled */ }
        void signOutSession(recoveryToken).catch(() => undefined);
        setRecoveryToken('');
        setMessage('Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.');
        setMode('login'); setPassword(''); setPasswordConfirm('');
        return;
      }
      if (mode === 'signup') {
        if (signupStep === 'details') {
          const details = normalizeSignupProfile({ name, phone, address });
          const signup = await requestSignupOtp(cleanEmail, details);
          if (signup.user?.identities && signup.user.identities.length === 0) {
            setMode('recover');
            setMessage('Энэ и-мэйл хаяг бүртгэлтэй байна. Нууц үгээ сэргээнэ үү.');
            return;
          }
          if (signup.session) {
            resumeSignup(signup.session, 'Одоо өөрийн нууц үгээ үүсгэнэ үү.');
          } else {
            setSignupStep('otp'); setResendSeconds(60);
            setMessage('И-мэйлээ шалгаж баталгаажуулах холбоосыг нээнэ үү. Код ирсэн бол доор оруулна уу. Spam хавтсаа мөн шалгаарай.');
          }
          return;
        }
        if (signupStep === 'otp') {
          if (!otp.trim()) throw new Error('И-мэйлээр ирсэн баталгаажуулах кодоо оруулна уу.');
          const session = await verifySignupOtp(cleanEmail, otp);
          setOtp('');
          resumeSignup(session, 'Код баталгаажлаа. Одоо өөрийн нууц үгээ үүсгэнэ үү.');
          return;
        }
        if (!signupSession) throw new Error('Баталгаажуулалтын хугацаа дууссан байна. Кодыг дахин авна уу.');
        if (password.length < 8) throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.');
        if (password !== passwordConfirm) throw new Error('Нууц үгүүд таарахгүй байна.');
        const nextProfile = await profileFromSession(signupSession, { name: name.trim(), phone, address });
        await saveProfile(signupSession.access_token, signupSession.user.id, nextProfile);
        // Save the profile first so a retry after a profile error does not attempt
        // to set an already changed password and fail with same_password.
        await updatePassword(signupSession.access_token, password);
        forgetSignupToken();
        setSignupSession(null); setPassword(''); setPasswordConfirm('');
        setMode('login'); setSignupStep('details');
        onSaveUser(nextProfile); onClose();
        return;
      }

      if (!password) throw new Error('Нууц үгээ оруулна уу.');
      const session = await signIn(cleanEmail, password);
      forgetSignupToken();
      const nextProfile = await profileFromSession(session, { name: '', phone: '', address: '' });
      setPassword('');
      onSaveUser(nextProfile); onClose();
    } catch (error: any) {
      setMessage(getAuthErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (busy || resendSeconds > 0) return;
    setBusy(true); setMessage('');
    try {
      await resendSignupOtp(email);
      setResendSeconds(60);
      setMessage('Баталгаажуулах и-мэйл дахин илгээгдлээ. Ирсэн холбоосыг нээх эсвэл кодоо оруулна уу.');
    } catch (error) { setMessage(getAuthErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault(); if (!user?.accessToken || !user.supabaseUserId) return;
    setBusy(true); setMessage('');
    try {
      const next = { ...user, ...normalizeSignupProfile({ name, phone, address }) };
      await saveProfile(user.accessToken, user.supabaseUserId, next);
      onSaveUser(next); setMessage('Мэдээлэл хадгалагдлаа.');
    } catch (error: any) { setMessage(error?.message || 'Хадгалах боломжгүй байна.'); }
    finally { setBusy(false); }
  }

  async function cancelOrder(order: OrderDetails) {
    if (!user?.accessToken || !window.confirm('Сонголтоо зөв хийж бараагаа сонгоно уу. Энэ захиалгыг цуцлах уу?')) return;
    setBusy(true);
    try {
      await cancelMyStoreOrder(user.accessToken, order.orderId);
      setRemoteOrders(current => current.map(item => item.orderId === order.orderId ? { ...item, status: 'cancelled' } : item));
      setOrderRefresh(current => current + 1);
      setMessage('Захиалга цуцлагдлаа.');
    } catch (error: any) { setMessage(error?.message || 'Захиалгыг цуцлах боломжгүй байна.'); }
    finally { setBusy(false); }
  }

  const unauthenticated = !user || mode === 'reset' || Boolean(signupSession);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"><section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
    <header className="flex items-center justify-between bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 px-6 py-5 text-white"><div className="flex items-center gap-3"><User className="text-amber-300"/><div><h2 className="font-black">Миний бүртгэл</h2><p className="text-xs text-stone-300">Захиалга, гишүүнчлэл нэг и-мэйлд хадгалагдана</p></div></div><button onClick={onClose} aria-label="Хаах"><X/></button></header>
    <div className="p-6">{message && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    {unauthenticated ? <form onSubmit={authenticate} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
      {mode === 'signup' && signupStep === 'details' && <><label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></>}
      {mode !== 'reset' && !(mode === 'signup' && signupStep === 'password') && <label className="block text-sm font-bold">И-мэйл<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required readOnly={mode==='signup' && signupStep==='otp'} className="mt-1 w-full rounded-xl border p-3"/></label>}
      {mode === 'signup' && signupStep === 'otp' && <><label className="block text-sm font-bold">И-мэйлээр ирсэн баталгаажуулах код<input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,12))} minLength={6} maxLength={12} pattern="[0-9]{6,12}" required className="mt-1 w-full rounded-xl border p-3 text-center text-xl tracking-[0.5em]"/></label><p className="text-xs text-stone-600">И-мэйлд кодын оронд холбоос ирсэн бол холбоосыг нээж үргэлжлүүлнэ үү.</p><button type="button" disabled={busy || resendSeconds > 0} onClick={() => void resendConfirmation()} className="text-sm font-bold text-amber-800 disabled:opacity-50">{resendSeconds > 0 ? `Дахин илгээх (${resendSeconds} сек)` : 'Баталгаажуулах и-мэйл дахин илгээх'}</button></>}
      {(mode === 'login' || mode === 'reset' || (mode === 'signup' && signupStep === 'password')) && <><label className="block text-sm font-bold">{mode==='signup'?'Шинэ нууц үг':'Нууц үг'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode === 'login' ? 1 : 8} required className="mt-1 w-full rounded-xl border p-3"/></label>{(mode === 'reset' || (mode === 'signup' && signupStep === 'password')) && <label className="block text-sm font-bold">Нууц үг давтах<input type="password" autoComplete="new-password" value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border p-3"/></label>}</>}
      <button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">{busy?'Түр хүлээнэ үү…':mode==='login'?'Нэвтрэх':mode==='recover'?'Сэргээх холбоос илгээх':mode==='reset'?'Шинэ нууц үг хадгалах':signupStep==='details'?'Баталгаажуулах и-мэйл илгээх':signupStep==='otp'?'Код баталгаажуулах':'Бүртгэл үүсгэж нэвтрэх'}</button>
      {mode !== 'reset' && <div className="flex justify-between text-xs font-bold text-amber-800"><button type="button" onClick={()=>switchMode('login')}>Нэвтрэх</button><button type="button" onClick={()=>switchMode('signup')}>Шинэ бүртгэл</button><button type="button" onClick={()=>switchMode('recover')}>Нууц үгээ мартсан</button></div>}
      </fieldset>
    </form> : <><section className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 to-stone-800 p-5 text-white shadow-lg"><div className="mb-4 flex items-center gap-3"><div className="relative shrink-0">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-2xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">{user.name.slice(0, 1).toUpperCase()}</div>}<label className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-stone-900 ring-2 ring-stone-900 ${avatarBusy ? 'opacity-50' : 'cursor-pointer'}`} title="Профайл зураг солих"><Camera className="h-3 w-3" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={avatarBusy} onChange={handleAvatarChange} /></label></div><div><p className="font-black">{user.name}</p><p className="text-xs text-stone-300">{user.email}</p></div></div><div className="rounded-2xl bg-white/10 p-3"><p className="font-black text-amber-300">{activeLoyalty ? activeLoyalty.badge+' '+activeLoyalty.name : 'Энгийн гишүүн'}</p><p className="mt-1 text-sm text-stone-200">Хүргэгдсэн захиалга: <b>{ownOrders.filter(o => o.status === 'delivered').length}</b></p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-emerald-400/15 p-2"><p className="text-[10px] text-emerald-200">Боломжит урамшуулал</p><p className="font-black text-emerald-300">{formatMNT(walletPoints)}</p></div><div className="rounded-xl bg-amber-400/15 p-2"><p className="text-[10px] text-amber-100">Нийт цуглуулсан</p><p className="font-black text-amber-300">{formatMNT(lifetimePoints)}</p></div></div><p className="mt-2 text-[11px] text-stone-300">Боломжит оноогоо дараагийн захиалгад сонгож ашиглаж болно.</p></div></section>
      <form onSubmit={updateProfile} className="space-y-4"><p className="text-sm text-stone-600"><Mail className="mr-1 inline h-4 w-4"/>{user.email}</p><label className="block text-sm font-bold">Нэр<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Утас<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">Хаяг<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-stone-900 p-3 font-bold text-white">Мэдээлэл хадгалах</button></form>
      <section className="mt-5 border-t border-stone-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-stone-900">Миний захиалгууд</h3><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{ownOrders.length} захиалга</span></div>{ownOrders.length ? <div className="space-y-2">{ownOrders.map((order) => {
  const expanded=expandedOrderId===order.orderId; const paid=order.paymentStatus==='Төлбөр баталгаажсан';
  const label=order.status==='delivered'?'Хүргэгдсэн':order.status==='cancelled'?'Цуцлагдсан':order.status==='shipping'?'Хүргэлтэд гарсан':order.status==='confirmed'?'Захиалга баталгаажсан':'Төлбөр хүлээж байна';
  const steps=[['Төлбөр баталгаажсан',paid],['Захиалга баталгаажсан',['confirmed','shipping','delivered'].includes(order.status||'')],['Хүргэлтэд гарсан',['shipping','delivered'].includes(order.status||'')],['Хүргэгдсэн',order.status==='delivered']] as const;
  return <article key={order.orderId} className="rounded-2xl border border-stone-200 bg-stone-50 p-3"><button type="button" onClick={()=>setExpandedOrderId(expanded?null:order.orderId)} className="flex w-full items-start justify-between gap-3 text-left"><div><p className="font-bold text-stone-900">{formatOrderNumber(order)}</p><p className="text-[11px] text-stone-500">{order.date} · {order.items.reduce((sum,item)=>sum+item.quantity,0)} бараа</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">{label}</span><ChevronDown className={expanded?'h-4 w-4 rotate-180':'h-4 w-4'}/></div></button><div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-xs"><span className="text-stone-600">{order.items.slice(0,2).map(item=>item.name).join(', ')}{order.items.length>2?' …':''}</span><b className="text-stone-900">{formatMNT(order.total)}</b></div>{expanded&&<div className="mt-3 space-y-3 border-t border-stone-200 pt-3">{order.status==='cancelled'?<p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">Энэ захиалга цуцлагдсан.</p>:<div className="grid grid-cols-2 gap-2">{steps.map(([step,done])=><div key={step} className={`rounded-xl p-2 text-[11px] font-bold ${done?'bg-emerald-50 text-emerald-700':'bg-stone-100 text-stone-400'}`}>{done?'✓ ':'○ '}{step}</div>)}</div>}<div className="rounded-xl bg-white p-3 text-xs">{order.items.map(item=><p key={item.id} className="flex justify-between py-0.5"><span>{item.name} × {item.quantity}</span><b>{formatMNT(item.price*item.quantity)}</b></p>)}</div>{order.status==='new'&&!paid&&<button type="button" disabled={busy} onClick={()=>void cancelOrder(order)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><XCircle className="h-4 w-4"/>Захиалга цуцлах</button>}{paid&&<button type="button" onClick={()=>printOrderReceipt(order)} className="ml-2 inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white"><ReceiptText className="h-4 w-4"/>Захиалгын баримт хэвлэх</button>}</div>}</article>;} )}</div>:<p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">Таны төв санд хадгалагдсан захиалга одоогоор алга.</p>}</section>
      <div className="mt-4 flex justify-end text-xs font-bold"><button onClick={()=>{onLogoutUser();onClose();}} className="text-rose-700"><LogOut className="mr-1 inline h-4 w-4"/>Гарах</button></div></>}
    </div></section></div>;
};

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const base = import.meta.env.VITE_WAREHOUSE_API_URL || '';

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('warehouse_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('deduct');
  const [barcode, setBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ barcode:'', name:'', stock:1, price:0, category:'', origin:'', description:'', unit:'ш', weight:'', publish_to_shop:true });

  const request = async (path, body) => {
    const r = await fetch(base + path, { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer ' + token }, body:JSON.stringify(body) });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Серверийн алдаа');
    return data;
  };
  const deduct = async () => {
    try { const data=await request('/api/deduct',{barcode,quantity:1,note:'Камераар борлуулалтын хасалт'}); setMessage(data.result.name + ' — үлдэгдэл: ' + data.result.stock); setBarcode(''); }
    catch(e) { setMessage(e.message); }
  };
  const register = async () => {
    try { const data=await request('/api/register',form); setMessage(data.result.name + ' бараа бүртгэгдлээ'); setForm({ barcode:'', name:'', stock:1, price:0, category:'', origin:'', description:'', unit:'ш', weight:'', publish_to_shop:true }); }
    catch(e) { setMessage(e.message); }
  };
  const signIn = async () => {
    try {
      const response = await fetch(import.meta.env.VITE_WAREHOUSE_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_WAREHOUSE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Нэвтрэх мэдээлэл буруу байна.');
      sessionStorage.setItem('warehouse_token', data.access_token);
      setToken(data.access_token);
    } catch (error) { setMessage(error.message); }
  };
  if (!token) return <main className="auth"><h1>US&K Агуулах</h1><p>Зөвхөн агуулахын бүртгэлтэй ажилтан нэвтэрнэ.</p><input type="email" placeholder="И-мэйл" value={email} onChange={e=>setEmail(e.target.value)} /><input type="password" placeholder="Нууц үг" value={password} onChange={e=>setPassword(e.target.value)} /><button onClick={signIn}>Нэвтрэх</button><p className="message">{message}</p></main>;
  return <main><header><div><b>US&K Агуулах</b><small>Тусдаа сервер · Barcode · Үлдэгдэл</small></div><button onClick={()=>{sessionStorage.removeItem('warehouse_token');setToken('')}}>Гарах</button></header><nav><button onClick={()=>setTab('deduct')} className={tab==='deduct'?'on':''}>Борлуулалт хасах</button><button onClick={()=>setTab('register')} className={tab==='register'?'on':''}>Бараа бүртгэх</button></nav>{tab==='deduct'?<section><h2>Barcode уншуулж хасах</h2><input autoFocus value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="Barcode / QR код" /><button onClick={deduct}>1 ширхэг хасах</button></section>:<section><h2>Шинэ бараа</h2>{Object.entries(form).filter(([k])=>!['publish_to_shop'].includes(k)).map(([key,value])=><label key={key}>{key}<input value={value} type={['stock','price'].includes(key)?'number':'text'} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label><input type="checkbox" checked={form.publish_to_shop} onChange={e=>setForm({...form,publish_to_shop:e.target.checked})}/> Дэлгүүрт нийтлэх</label><button onClick={register}>Бүртгэж нийтлэх</button></section>}<p className="message">{message}</p></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
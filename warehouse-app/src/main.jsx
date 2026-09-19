import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const base = import.meta.env.VITE_WAREHOUSE_API_URL || '';

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('warehouse_token') || '');
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
  if (!token) return <main className="auth"><h1>US&K Агуулах</h1><p>Supabase-аас авсан ажилтны access token-оо оруулна уу. Production хувилбарт энд и-мэйл, нууц үгийн нэвтрэх дэлгэц ашиглана.</p><textarea placeholder="Access token" onChange={e=>setToken(e.target.value)} /><button onClick={()=>{sessionStorage.setItem('warehouse_token',token); setToken(token)}}>Нэвтрэх</button></main>;
  return <main><header><div><b>US&K Агуулах</b><small>Тусдаа сервер · Barcode · Үлдэгдэл</small></div><button onClick={()=>{sessionStorage.removeItem('warehouse_token');setToken('')}}>Гарах</button></header><nav><button onClick={()=>setTab('deduct')} className={tab==='deduct'?'on':''}>Борлуулалт хасах</button><button onClick={()=>setTab('register')} className={tab==='register'?'on':''}>Бараа бүртгэх</button></nav>{tab==='deduct'?<section><h2>Barcode уншуулж хасах</h2><input autoFocus value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="Barcode / QR код" /><button onClick={deduct}>1 ширхэг хасах</button></section>:<section><h2>Шинэ бараа</h2>{Object.entries(form).filter(([k])=>!['publish_to_shop'].includes(k)).map(([key,value])=><label key={key}>{key}<input value={value} type={['stock','price'].includes(key)?'number':'text'} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label><input type="checkbox" checked={form.publish_to_shop} onChange={e=>setForm({...form,publish_to_shop:e.target.checked})}/> Дэлгүүрт нийтлэх</label><button onClick={register}>Бүртгэж нийтлэх</button></section>}<p className="message">{message}</p></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
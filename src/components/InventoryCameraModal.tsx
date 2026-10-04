import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Barcode, PackagePlus, MinusCircle, History, ImagePlus, CheckCircle2, RefreshCw } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addInventoryStock, deductInventoryByBarcode, getInventoryMovements, lookupInventoryBarcode, registerInventoryProduct, uploadProductImage, InventoryMovement } from '../services/supabaseAuth';
import { requestInventorySuggestion } from '../services/inventoryAi';
import { mergeInventorySuggestion, clearInventorySuggestion, type InventorySuggestion } from '../utils/inventorySuggestion';
import { CATEGORIES } from '../data/storeData';

type Props = { isOpen: boolean; onClose: () => void; accessToken: string; onChanged: () => void };
type Tab = 'register' | 'deduct' | 'history';
type LookedUpProduct = { id?: string; name?: string; price?: number; weight?: string; origin?: string; category?: string; category_name?: string; badge?: string; description?: string; stock?: number };
const ORIGINS = ['АНУ', 'БНСУ'] as const;
const REGISTER_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'all');
const blank = { name:'', stock:'', origin:'АНУ', category:REGISTER_CATEGORIES[0].id, category_name:REGISTER_CATEGORIES[0].name, price:'', weight:'', badge:'', day_deal:'-1', description:'', barcode:'' };

export const InventoryCameraModal: React.FC<Props> = ({ isOpen, onClose, accessToken, onChanged }) => {
  const [tab,setTab]=useState<Tab>('register');
  const [step,setStep]=useState<1|2|3>(1);
  const [form,setForm]=useState(blank);
  const [image,setImage]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [imageOk,setImageOk]=useState(false);
  const [scan,setScan]=useState('');
  const [deductQty,setDeductQty]=useState('1');
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [history,setHistory]=useState<InventoryMovement[]>([]);
  const [restockOf,setRestockOf]=useState<LookedUpProduct|null>(null);
  const [lookingUp,setLookingUp]=useState(false);
  const [restockQty,setRestockQty]=useState('1');
  const [aiLoading,setAiLoading]=useState(false);
  const [aiResult,setAiResult]=useState<InventorySuggestion|null>(null);
  const [aiMessage,setAiMessage]=useState('');
  const aiController=useRef<AbortController|null>(null);
  const imageGeneration=useRef(0);
  const cancelAi=()=>{ aiController.current?.abort(); aiController.current=null; setAiLoading(false); };
  useEffect(()=>()=>{aiController.current?.abort();imageGeneration.current++;},[]);
  useEffect(()=>{ if(!isOpen) { cancelAi(); imageGeneration.current++; } },[isOpen]);
  useEffect(()=>()=>{ if(preview) URL.revokeObjectURL(preview); },[preview]);
  const [takingPhoto,setTakingPhoto]=useState(false);
  const photoInputRef=useRef<HTMLInputElement|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const timerRef=useRef<number|undefined>();
  const zxingControlsRef=useRef<IScannerControls|null>(null);

  const stopCamera=()=>{
    if(timerRef.current) window.clearInterval(timerRef.current);
    zxingControlsRef.current?.stop();
    zxingControlsRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
  };
  useEffect(()=>()=>stopCamera(),[]);
  useEffect(()=>{ if(tab==='history'&&isOpen) void loadHistory(); },[tab,isOpen]);

  const setField=(key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  const loadHistory=async()=>{ try { setHistory(await getInventoryMovements(accessToken)); } catch { setMessage('Хөдөлгөөний түүх татагдсангүй.'); } };

  // If this barcode was already registered before, pull its known details in so the
  // admin does not have to retype a product's name/price/etc. every time it is restocked.
  // Barcodes map to products through a separate inventory_barcodes table server-side
  // (not a field on the product itself), so this has to be a real lookup call, not a
  // search through the locally-known product list.
  const applyBarcode=async(value:string):Promise<LookedUpProduct|null>=>{
    setField('barcode',value);
    setLookingUp(true);
    let existing:LookedUpProduct|null=null;
    try { existing=(await lookupInventoryBarcode(accessToken,value)) as LookedUpProduct|null; } catch { existing=null; }
    setLookingUp(false);
    setRestockOf(existing);
    setRestockQty('1');
    if(existing){
      setForm(current=>({
        ...current,
        barcode:value,
        name:existing!.name||'',
        price:existing!.price!=null?String(existing!.price):'',
        weight:existing!.weight||'',
        origin:existing!.origin==='KR'?'БНСУ':'АНУ',
        category:existing!.category||current.category,
        category_name:existing!.category_name||current.category_name,
        badge:existing!.badge||'',
        description:existing!.description||'',
      }));
      setMessage(`"${existing.name}" энэ barcode-оор өмнө бүртгэгдсэн байна. Доор зөвхөн нэмж ирсэн тоо ширхэгээ оруулаад үлдэгдэлд нэмээрэй.`);
    } else {
      setMessage('Код амжилттай уншигдлаа: '+value);
    }
    return existing;
  };

  const addStock=async()=>{
    if(!restockOf||Number(restockQty)<1){ setMessage('Нэмэх тоог зөв оруулна уу.'); return; }
    setBusy(true); setMessage('');
    try {
      const result=await addInventoryStock(accessToken,form.barcode,Number(restockQty),note);
      setMessage(`${String(result.name)}: ${String(result.stock_before)}ш → ${String(result.stock_after)}ш. Үлдэгдэл серверт шинэчлэгдлээ.`);
      setForm(blank); setImage(null); setPreview(''); setImageOk(false); setRestockOf(null); setRestockQty('1'); setNote(''); setStep(1); onChanged();
    } catch(e){
      const raw=e instanceof Error?e.message:'';
      setMessage(raw.includes('BARCODE_NOT_FOUND')?'Энэ barcode-той бараа олдсонгүй.':raw||'Үлдэгдэл нэмэх боломжгүй байна.');
    } finally { setBusy(false); }
  };

  const findProductInfo=async(file:File, snapshot=form)=>{
    cancelAi();
    const controller=new AbortController();
    aiController.current=controller;
    const before={...snapshot};
    setAiLoading(true); setAiResult(null); setAiMessage('Зургийг таньж, интернэтээс мэдээлэл хайж байна...');
    const timeout=window.setTimeout(()=>controller.abort(),100_000);
    try {
      const result=await requestInventorySuggestion(accessToken,file,snapshot.barcode,controller.signal);
      if(aiController.current!==controller||controller.signal.aborted) return;
      setAiResult(result); setAiMessage(result.message);
      setForm(current=>{
        const next=mergeInventorySuggestion(current,before,result);
        const category=REGISTER_CATEGORIES.find(c=>c.id===next.category);
        return {...next,category_name:category?.name||current.category_name};
      });
    } catch(error){
      if(aiController.current!==controller) return;
      setAiMessage(controller.signal.aborted?'Хайлт удаж байна. Дахин оролдох эсвэл гараар бөглөнө үү.':error instanceof Error?error.message:'AI хайлт амжилтгүй байна.');
    } finally {
      window.clearTimeout(timeout);
      if(aiController.current===controller){aiController.current=null;setAiLoading(false);}
    }
  };

  const chooseImage=async(file?:File)=>{
    if(!file) return;
    const snapshot={...clearInventorySuggestion(form,aiResult)};
    snapshot.category_name=REGISTER_CATEGORIES.find(c=>c.id===snapshot.category)?.name||snapshot.category_name;
    setForm(snapshot);
    cancelAi(); setAiResult(null); setAiMessage('');
    const generation=++imageGeneration.current;
    setImageOk(false); setImage(file);
    const url=URL.createObjectURL(file);
    setPreview(url);
    const img=new Image();
    img.onload=()=>{
      if(generation!==imageGeneration.current) return;
      const ok=img.naturalWidth>=900&&img.naturalHeight>=900&&file.size>=40*1024&&file.size<=5*1024*1024;
      setImageOk(ok);
      setMessage(ok?'✓ Зургийн чанар хангалттай байна.':'900×900-аас дээш, 40 КБ–5 МБ хэмжээтэй тод зураг оруулна уу.');
      if(ok){setStep(3);void findProductInfo(file,snapshot);}
    };
    img.onerror=()=>{if(generation===imageGeneration.current)setMessage('Зураг уншигдсангүй. Өөр зураг сонгоно уу.');};
    img.src=url;
  };

  const takePhoto=async()=>{
    stopCamera();
    if(!Capacitor.isNativePlatform()){
      photoInputRef.current?.click();
      return;
    }
    setTakingPhoto(true);
    setMessage('');
    try {
      const photo=await CapacitorCamera.getPhoto({
        source:CameraSource.Camera,
        resultType:CameraResultType.Uri,
        quality:90,
        width:2000,
        height:2000,
        correctOrientation:true,
        saveToGallery:false,
      });
      if(!photo.webPath) throw new Error('Missing photo');
      const response=await fetch(photo.webPath);
      if(!response.ok) throw new Error('Photo could not be loaded');
      const blob=await response.blob();
      await chooseImage(new File([blob], 'inventory-'+Date.now()+'.'+photo.format, {type:blob.type||'image/jpeg'}));
    } catch(error){
      const reason=error instanceof Error?error.message:String(error);
      if(!/cancel/i.test(reason)) setMessage('Камерын зураг авах боломжгүй байна. Утасны тохиргооноос аппын камерын зөвшөөрлийг шалгаад дахин оролдоно уу.');
    } finally { setTakingPhoto(false); }
  };

  const startScanner=async(target:'register'|'deduct')=>{
    try {
      stopCamera();
      // Inside the native Android app, navigator.mediaDevices.getUserMedia alone does
      // not reliably trigger the OS camera permission dialog across WebView versions --
      // it silently fails on some devices even though the app declares the permission.
      // Requesting it through the Capacitor Camera plugin goes through Android's native
      // permission API directly, which is the reliable path.
      if (Capacitor.isNativePlatform()) {
        const status = await CapacitorCamera.checkPermissions();
        if (status.camera !== 'granted') {
          const requested = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
          if (requested.camera !== 'granted') {
            setMessage('Камерын зөвшөөрөл өгөгдөөгүй байна. Утасныхаа Тохиргоо → Апп → US&K Агуулах → Зөвшөөрөл хэсгээс Камерыг зөвшөөрнө үү.');
            return;
          }
        }
      }
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream;
      if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play(); }

      const handleDetected=(value:string)=>{
        stopCamera();
        if(target==='register'){
          void applyBarcode(value).then((existing)=>window.setTimeout(()=>setStep(existing?3:2),600));
        } else { setScan(value); setMessage('Код амжилттай уншигдлаа: '+value); }
      };

      // The native BarcodeDetector API is fast when available, but many WebViews
      // (including the installed Android app's) do not implement it at all, even on
      // devices where Chrome itself supports it. ZXing decodes from raw video frames
      // in pure JS, so it works everywhere the camera itself works.
      const Detector=(window as any).BarcodeDetector;
      if(Detector){
        const detector=new Detector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code']});
        timerRef.current=window.setInterval(async()=>{ try { if(!videoRef.current) return; const found=await detector.detect(videoRef.current); const value=found?.[0]?.rawValue; if(value) handleDetected(value); } catch {} },500);
        return;
      }

      const reader=new BrowserMultiFormatReader();
      zxingControlsRef.current=await reader.decodeFromStream(stream, videoRef.current ?? undefined, (result)=>{ if(result) handleDetected(result.getText()); });
    } catch {
      setMessage(Capacitor.isNativePlatform()
        ? 'Камер нээгдсэнгүй. Утасныхаа Тохиргоо → Апп → US&K Агуулах → Зөвшөөрөл хэсгээс камерыг гараар зөвшөөрөөд дахин оролдоно уу.'
        : 'Камер нээх зөвшөөрөл өгнө үү.');
    }
  };

  const register=async()=>{
    if(!image||!imageOk){ setMessage('Шаардлага хангасан барааны зураг авна уу.'); return; }
    if(!form.barcode||!form.name||!form.stock||!form.price){ setMessage('Зураг, barcode, нэр, тоо, үнийг заавал бөглөнө.'); return; }
    cancelAi(); setAiResult(null); setAiMessage('');
    setBusy(true); setMessage('');
    try {
      const imageUrl=await uploadProductImage(accessToken,image);
      await registerInventoryProduct(accessToken,{...form,id:crypto.randomUUID(),stock:Number(form.stock),price:Number(form.price),day_deal:Number(form.day_deal),image:imageUrl,country:form.origin,origin:form.origin==='БНСУ'?'KR':'US',flag:form.origin==='БНСУ'?'🇰🇷':'🇺🇸',rating:5,published:false,note:'Камерын апп-аар шинээр бүртгэв'});
      setMessage('Бараа админд илгээгдлээ. Дараагийн барааны barcode-ыг уншуулаад үргэлжлүүлээрэй.'); setForm(blank); setImage(null); setPreview(''); setImageOk(false); setStep(1); onChanged();
    } catch(e){
      const raw=e instanceof Error?e.message:'';
      setMessage(/duplicate|already|exists|unique/i.test(raw)
        ? 'Энэ barcode код өмнө нь өөр бараанд бүртгэгдсэн байна. Кодоо шалгаад дахин оролдоно уу.'
        : raw||'Бүртгэх боломжгүй байна.');
    } finally { setBusy(false); }
  };

  const deduct=async()=>{
    if(!scan||Number(deductQty)<1){ setMessage('Barcode болон хасах тоог оруулна уу.'); return; }
    setBusy(true); setMessage('');
    try { const result=await deductInventoryByBarcode(accessToken,scan,Number(deductQty),note); setMessage(`${String(result.name)}: ${String(result.stock_before)}ш → ${String(result.stock_after)}ш. Хасалт серверт хадгалагдлаа.`); setScan(''); setDeductQty('1'); setNote(''); onChanged(); }
    catch(e){ const raw=e instanceof Error?e.message:''; setMessage(raw.includes('OUT_OF_STOCK')?'Үлдэгдэл хүрэлцэхгүй байна. Хасалт хийгдсэнгүй.':raw.includes('BARCODE_NOT_FOUND')?'Энэ barcode/QR кодтой бараа олдсонгүй.':raw||'Хасалт хийх боломжгүй байна.'); }
    finally { setBusy(false); }
  };

  if(!isOpen) return null;
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/75 p-3 sm:p-6">
    <div className="mx-auto min-h-full w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-stone-950 p-4 text-white">
        <div><h2 className="font-black">Агуулах · Камер ба Barcode</h2><p className="text-xs text-stone-300">Бараа бүртгэл, борлуулалтын хасалт, хөдөлгөөний түүх</p></div>
        <button onClick={()=>{stopCamera();cancelAi();imageGeneration.current++;onClose();}} className="rounded-xl p-2 hover:bg-white/10"><X /></button>
      </header>
      <div className="flex border-b border-stone-200">
        {[['register','Бараа бүртгэх',PackagePlus],['deduct','Борлуулалт хасах',MinusCircle],['history','Түүх',History]].map(([id,label,Icon])=><button key={String(id)} onClick={()=>{stopCamera();cancelAi();imageGeneration.current++;setTab(id as Tab);}} className={`flex-1 p-3 text-xs font-bold ${tab===id?'border-b-2 border-rose-600 text-rose-700':'text-stone-500'}`}><Icon className="mr-1 inline h-4 w-4"/>{String(label)}</button>)}
      </div>
      <main className="space-y-4 p-4 sm:p-6">
        {message&&<div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
        {((tab==='register'&&step===1)||tab==='deduct')&&<><video ref={videoRef} playsInline muted className={streamRef.current?'block w-full rounded-2xl bg-black':'hidden'} /></>}
        {tab==='register'&&<div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {([[1,'Barcode/QR'],[2,'Зураг'],[3,'Мэдээлэл']] as const).map(([n,label],idx)=><React.Fragment key={n}>
              {idx>0&&<div className={`h-0.5 flex-1 rounded ${step>=n?'bg-rose-500':'bg-stone-200'}`}/>}
              <div className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${step===n?'bg-rose-600 text-white':step>n?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-400'}`}>
                {step>n?<CheckCircle2 className="h-3 w-3"/>:<span>{n}</span>}
                <span>{label}</span>
              </div>
            </React.Fragment>)}
          </div>

          {step===1&&<section className="rounded-2xl border p-4">
            <h3 className="font-black">1. QR / Barcode</h3>
            <div className="mt-3 flex gap-2"><input value={form.barcode} onChange={e=>setField('barcode',e.target.value)} placeholder="Barcode эсвэл QR код" className="min-w-0 flex-1 rounded-xl border p-3"/><button onClick={()=>void startScanner('register')} className="rounded-xl bg-amber-400 px-3 font-bold"><Barcode/></button></div>
            <button type="button" disabled={!form.barcode.trim()||lookingUp} onClick={()=>{stopCamera();void applyBarcode(form.barcode.trim()).then((existing)=>setStep(existing?3:2));}} className="mt-3 w-full rounded-xl bg-stone-900 p-3 text-sm font-bold text-white disabled:bg-stone-300 cursor-pointer">{lookingUp?'Шалгаж байна...':'Үргэлжлүүлэх →'}</button>
          </section>}

          {step===2&&<section className="rounded-2xl border p-4"><h3 className="font-black">2. Барааны зураг</h3>{preview&&<img src={preview} className="mt-3 h-48 w-full rounded-xl object-cover" />}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={takingPhoto} onClick={()=>void takePhoto()} className="flex items-center justify-center gap-2 rounded-xl bg-stone-900 p-3 text-sm font-bold text-white disabled:opacity-50"><Camera className="h-4 w-4"/>{takingPhoto?'Камер нээж байна...':'Камераар зураг авах'}</button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-300 p-3 text-sm font-bold text-stone-900"><ImagePlus className="h-4 w-4"/>Галерейгаас сонгох<input type="file" accept="image/jpeg,image/png,image/webp" disabled={takingPhoto} className="sr-only" onChange={e=>{void chooseImage(e.target.files?.[0]);e.target.value='';}}/></label>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{void chooseImage(e.target.files?.[0]);e.target.value='';}}/>
          <p className="mt-2 text-xs text-stone-500">900×900-аас дээш нягтралтай, 40 КБ–5 МБ хэмжээтэй тод зураг оруулна уу.</p>
          {image&&<p className={`mt-2 text-xs font-bold ${imageOk?'text-emerald-700':'text-rose-700'}`}>{imageOk?'✓ Зураг шаардлага хангалаа':'! Зургийг дахин авах шаардлагатай'}</p>}
          <button type="button" onClick={()=>setStep(1)} className="mt-3 text-xs font-bold text-stone-500 cursor-pointer">← Буцах</button>
          </section>}

          {step===3&&restockOf&&<>
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="mb-1 flex items-center justify-between"><h3 className="font-black">Үлдэгдэлд нэмэх</h3><button type="button" onClick={()=>{setRestockOf(null);setStep(1);}} className="text-xs font-bold text-stone-500 cursor-pointer">← Буцах</button></div>
              <p className="mt-1 text-sm font-bold text-stone-900">{restockOf.name||form.barcode}</p>
              <p className="text-xs text-stone-600">Энэ barcode аль хэдийн бүртгэлтэй тул шинэ бараа биш, зөвхөн ирсэн тоог одоо байгаа үлдэгдэлд нэмнэ.</p>
              <label className="mt-3 block text-xs font-bold">Нэмэгдэж ирсэн тоо ширхэг<input type="number" min="1" value={restockQty} onChange={e=>setRestockQty(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
              <label className="mt-3 block text-xs font-bold">Тайлбар (заавал биш)<textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
            </section>
            <button disabled={busy} onClick={()=>void addStock()} className="w-full rounded-xl bg-amber-500 p-3 font-black text-stone-950 disabled:bg-stone-300">{busy?'Шинэчилж байна...':'Үлдэгдэл нэмэх'}</button>
          </>}

          {step===3&&!restockOf&&<>
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-live="polite">
              <h3 className="font-bold">AI · Барааны мэдээлэл</h3>
              <p className="mt-1 text-sm">{aiMessage||'Зураг болон barcode-оор мэдээлэл хайж, монголоор бөглөнө.'}</p>
              <p className="mt-1 text-xs text-stone-600">AI-ийн саналыг шалгаж засаарай. Үнэ, үлдэгдэл, гарал үүслийг та оруулна.</p>
              {aiResult?.sources.length ? <ul className="mt-2 space-y-1 text-xs">{aiResult.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">{source.title}</a></li>)}</ul> : null}
              {aiResult?.searchHtml&&<iframe title="Google хайлтын санал" srcDoc={aiResult.searchHtml} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="mt-2 h-32 w-full border-0"/>}
              {aiLoading ? <button type="button" onClick={()=>{cancelAi();setAiMessage('AI хайлтыг зогсоолоо. Гараар бөглөж болно.');}} className="mt-2 text-xs font-bold underline">Хүлээлгүй гараар бөглөх</button> : <button type="button" disabled={!image||!imageOk||busy} onClick={()=>{ if(!image) return; const snapshot={...clearInventorySuggestion(form,aiResult)}; snapshot.category_name=REGISTER_CATEGORIES.find(c=>c.id===snapshot.category)?.name||snapshot.category_name; setForm(snapshot); void findProductInfo(image,snapshot); }} className="mt-2 text-xs font-bold underline disabled:opacity-50">AI-аар дахин хайх</button>}
            </section>
            <section className="rounded-2xl border p-4">
              <div className="mb-1 flex items-center justify-between"><h3 className="font-black">3. Барааны мэдээлэл</h3><button type="button" onClick={()=>{cancelAi();setStep(2);}} className="text-xs font-bold text-stone-500 cursor-pointer">← Буцах</button></div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[['name','Барааны нэр'],['stock','Тоо ширхэг'],['price','Зарах үнэ (₮)'],['weight','Жин / савалгаа']].map(([key,label])=><label key={key} className="text-xs font-bold">{label}<input value={(form as any)[key]} type={key==='stock'||key==='price'?'number':'text'} onChange={e=>setField(key,e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>)}
                <label className="text-xs font-bold">Гарал үүсэл<select value={form.origin} onChange={e=>setField('origin',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal">{ORIGINS.map(o=><option key={o} value={o}>{o}</option>)}</select></label>
                <label className="text-xs font-bold">Ангилал<select value={form.category} onChange={e=>{const cat=REGISTER_CATEGORIES.find(c=>c.id===e.target.value); setForm(current=>({...current,category:e.target.value,category_name:cat?.name||current.category_name}));}} className="mt-1 w-full rounded-xl border p-3 font-normal">{REGISTER_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="text-xs font-bold">Онцлох тэмдэглэгээ<input value={form.badge} onChange={e=>setField('badge',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
                <label className="text-xs font-bold">Өдрийн хямдрал<select value={form.day_deal} onChange={e=>setField('day_deal',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="-1">Хямдралгүй</option><option value="0">Ням</option><option value="1">Даваа</option><option value="2">Мягмар</option><option value="3">Лхагва</option><option value="4">Пүрэв</option><option value="5">Баасан</option><option value="6">Бямба</option></select></label>
              </div>
              <label className="mt-3 block text-xs font-bold">Тайлбар<textarea value={form.description} onChange={e=>setField('description',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
            </section>
            <button disabled={busy} onClick={()=>void register()} className="w-full rounded-xl bg-rose-600 p-3 font-black text-white disabled:bg-stone-300">{busy?'Хадгалж байна...':'Админд шалгуулахаар бүртгэх'}</button>
          </>}
        </div>}
        {tab==='deduct'&&<div className="space-y-4"><section className="rounded-2xl border p-4"><h3 className="font-black">Barcode / QR уншуулаад зарлага хасах</h3><div className="mt-3 flex gap-2"><input value={scan} onChange={e=>setScan(e.target.value)} placeholder="Код уншуулна уу" className="min-w-0 flex-1 rounded-xl border p-3"/><button onClick={()=>void startScanner('deduct')} className="rounded-xl bg-amber-400 px-3 font-bold"><Barcode/></button></div><label className="mt-3 block text-xs font-bold">Хасах тоо<input type="number" min="1" value={deductQty} onChange={e=>setDeductQty(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="mt-3 block text-xs font-bold">Тайлбар<textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><button disabled={busy} onClick={()=>void deduct()} className="mt-4 w-full rounded-xl bg-rose-600 p-3 font-black text-white disabled:bg-stone-300">{busy?'Шалгаж байна...':'Үлдэгдлээс хасах'}</button><p className="mt-2 text-xs text-stone-500">Сервер үлдэгдлийг дахин шалгана. Үлдэгдэл хүрэхгүй бол хасалт хийгдэхгүй.</p></section></div>}
        {tab==='history'&&<div><button onClick={()=>void loadHistory()} className="mb-3 flex items-center gap-1 text-sm font-bold"><RefreshCw className="h-4 w-4"/> Шинэчлэх</button><div className="space-y-2">{history.map(m=><article key={m.id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between gap-2"><b>{m.product_name}</b><span className={m.quantity<0?'text-rose-600':'text-emerald-700'}>{m.quantity>0?'+':''}{m.quantity}ш</span></div><p className="text-xs text-stone-500">{m.stock_before}ш → {m.stock_after}ш · {new Date(m.created_at).toLocaleString('mn-MN')}</p>{m.note&&<p className="mt-1 text-xs">{m.note}</p>}</article>)}{!history.length&&<p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Хөдөлгөөний түүх одоогоор байхгүй.</p>}</div></div>}
      </main>
    </div>
  </div>;
};
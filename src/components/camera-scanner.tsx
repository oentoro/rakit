'use client';
import React,{useEffect,useRef,useState} from 'react';
import { Camera,CameraOff,ScanLine,ArrowRight,Keyboard,LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ApiError } from '@/lib/client';
type Pending={code:string;requestId:string;locationId?:string};
type Props={kind:'sku'|'airwayBill';storageKey?:string;locationBySku?:Record<string,string>;onScan:(code:string,requestId:string,locationId?:string)=>Promise<{message:string}>};
export function CameraScanner({kind,onScan,storageKey='scanner',locationBySku={}}:Props) {
  const [ready,setReady]=useState(false);
  const [open,setOpen]=useState(false);const [phase,setPhase]=useState<'idle'|'starting'|'ready'|'sending'|'paused'|'uncertain'>('idle');
  const [message,setMessage]=useState('');const [error,setError]=useState('');const [manual,setManual]=useState('');
  const feed=useRef<HTMLDivElement>(null);const stream=useRef<MediaStream|null>(null);const controls=useRef<{stop:()=>void}|null>(null);const mounted=useRef(true);const armed=useRef(true);const inflight=useRef(false);const pending=useRef<Pending|null>(null);const generation=useRef(0);
  const selectedLocations=useRef(locationBySku);selectedLocations.current=locationBySku;
  const callback=useRef(onScan);callback.current=onScan;const key=`rakit-scan:${storageKey}:${kind}`;
  function stopCamera() {generation.current++;controls.current?.stop();controls.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;feed.current?.replaceChildren();}
  useEffect(()=>{
    mounted.current=true;setReady(true);try {const raw=sessionStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(typeof value.code==='string'&&typeof value.requestId==='string'){pending.current=value;armed.current=false;setPhase('uncertain');setError('Hasil scan sebelumnya belum terkonfirmasi. Coba ulang untuk memeriksa hasilnya.');}}}catch{}
    return ()=>{mounted.current=false;stopCamera();};
  },[key]);
  async function send(scan:Pending) {
    if(inflight.current)return;inflight.current=true;armed.current=false;pending.current=scan;setPhase('sending');setMessage('');setError('');
    try {sessionStorage.setItem(key,JSON.stringify(scan));}catch{}
    try {
      const result=await callback.current(scan.code,scan.requestId,scan.locationId);pending.current=null;try{sessionStorage.removeItem(key);}catch{}
      if(mounted.current){setMessage(result.message);setPhase('paused');setManual('');}
    } catch(cause) {
      const known=cause instanceof ApiError&&cause.status<500;
      if(known){pending.current=null;try{sessionStorage.removeItem(key);}catch{}}
      if(mounted.current){setError(known?cause.message:'Koneksi terputus atau hasil belum diketahui. Coba ulang scan yang sama sebelum mengambil unit berikutnya.');setPhase(known?'paused':'uncertain');}
    } finally {inflight.current=false;}
  }
  async function startCamera() {
    if(inflight.current||pending.current)return;
    if(window.isSecureContext===false){setError('Kamera membutuhkan HTTPS. Gunakan input manual sementara.');return;}
    setOpen(true);setPhase('starting');setError('');armed.current=true;const current=++generation.current;let acquired:MediaStream|null=null;
    try {
      const {BrowserMultiFormatReader}=await import('@zxing/browser');if(!mounted.current||current!==generation.current)return;
      acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(!mounted.current||current!==generation.current){acquired.getTracks().forEach(t=>t.stop());return;}
      stream.current=acquired;const target=document.createElement('video');target.muted=true;target.playsInline=true;target.setAttribute('aria-label','Pratinjau kamera');feed.current?.replaceChildren(target);
      const reader=new BrowserMultiFormatReader();const active=await reader.decodeFromStream(acquired,target,(result)=>{
        if(result&&mounted.current&&current===generation.current&&armed.current&&!inflight.current&&!pending.current){armed.current=false;void send({code:result.getText().trim(),requestId:crypto.randomUUID(),locationId:selectedLocations.current[result.getText().trim()]||undefined});}
      });
      if(!mounted.current||current!==generation.current){active.stop();acquired.getTracks().forEach(t=>t.stop());return;}controls.current=active;if(armed.current)setPhase('ready');
    } catch(cause) {
      if(!mounted.current||current!==generation.current){acquired?.getTracks().forEach(t=>t.stop());return;}
      stopCamera();setOpen(false);setPhase('idle');setError(cause instanceof DOMException&&cause.name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera di pengaturan browser atau gunakan kode manual.':'Kamera tidak dapat dibuka. Periksa kamera atau gunakan kode manual.');
    }
  }
  function rearm(){if(inflight.current||pending.current)return;setMessage('');setError('');if(controls.current){armed.current=true;setPhase('ready');}else void startCamera();}
  const blocked=!ready||phase==='sending'||phase==='starting'||phase==='uncertain';
  return <section className="scanner-panel">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><ScanLine className="size-5 text-emerald-700"/>{kind==='sku'?'Scan QR barang':'Scan barcode resi'}</div><span className="text-xs text-muted-foreground">{kind==='sku'?'1 scan = 1 unit':'Airway bill'}</span></div>
    <div className={open?'camera-preview mt-4':'hidden'}><div ref={feed} className="camera-feed"/><div className="scan-target"/><span className="camera-hint">{phase==='ready'?'Arahkan kode ke dalam bingkai':phase==='starting'?'Menyiapkan kamera…':'Scanner dijeda'}</span></div>
    <div className="mt-4 flex flex-wrap gap-2">
      {phase==='paused'?<Button type="button" onClick={rearm} className="h-11"><ScanLine/>Scan unit berikutnya</Button>:!open&&phase!=='uncertain'?<Button type="button" onClick={startCamera} disabled={blocked} className="h-11"><Camera/>Aktifkan kamera</Button>:null}
      {open&&<Button type="button" variant="outline" className="h-11" disabled={phase==='sending'} onClick={()=>{stopCamera();setOpen(false);if(phase==='ready'||phase==='starting')setPhase('idle');}}><CameraOff/>Tutup kamera</Button>}
      {phase==='uncertain'&&<Button type="button" className="h-11" onClick={()=>pending.current&&void send(pending.current)}>Coba ulang scan</Button>}
      {phase==='sending'&&<span className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin"/>Menyimpan scan…</span>}
    </div>
    {message&&<p role="status" className="notice success mt-3">{message}</p>}{error&&<p role="alert" className="notice error mt-3">{error}</p>}
    <form className="mt-5 border-t pt-4" onSubmit={e=>{e.preventDefault();if(!blocked&&manual.trim())void send({code:manual.trim(),requestId:crypto.randomUUID(),locationId:selectedLocations.current[manual.trim()]||undefined});}}><Label htmlFor={`manual-${kind}`} className="mb-2"><Keyboard className="size-4"/>Kode manual</Label><div className="flex gap-2"><Input id={`manual-${kind}`} value={manual} onChange={e=>setManual(e.target.value)} placeholder={kind==='sku'?'Masukkan SKU jika kamera gagal':'Masukkan nomor airway bill'} disabled={blocked} autoComplete="off" className="h-11"/><Button type="submit" variant="outline" disabled={blocked||!manual.trim()} className="h-11">Kirim kode<ArrowRight/></Button></div></form>
  </section>;
}

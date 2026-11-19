"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '@/lib/client';
import type { ChannelStatus } from '@/lib/channels';
type Field={name:string;label:string;secret?:boolean;numeric?:boolean};
/** Marketplace stock-sync settings: credentials, shop authorization, manual sync. One instance per channel. */
export function ChannelSettings({title,endpoint,fields,status,pull=false}:{title:string;endpoint:string;fields:Field[];status:ChannelStatus;pull?:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const run=async(action:()=>Promise<unknown>,message:string)=>{setBusy(true);setError('');setSuccess('');try{await action();setSuccess(message);router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const connect=()=>run(async()=>{const {url}=await api<{url:string}>(`${endpoint}/connect`,{method:'POST'});window.location.assign(url);},`Membuka halaman otorisasi ${title}…`);
 return <section className="surface form-surface mt-6"><h2 className="mb-1 font-semibold">{title}</h2>
  <p className="mb-5 text-sm text-muted-foreground">Stok Rakit (dikurangi order yang belum selesai) dikirim ke {title} tiap 5 menit, hanya untuk SKU yang berubah. Produk dicocokkan lewat SKU penjual di {title} = SKU di Rakit.</p>
  <form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void run(()=>api(endpoint,{method:'PATCH',body:JSON.stringify(Object.fromEntries(fields.map(f=>[f.name,d.get(f.name)])))}),`Konfigurasi ${title} disimpan.`);}} className="grid max-w-xl gap-4">
   {fields.map(f=><div key={f.name}><Label htmlFor={`${endpoint}-${f.name}`}>{f.label}</Label>{f.secret
    ?<Input id={`${endpoint}-${f.name}`} name={f.name} type="password" autoComplete="off" maxLength={200} placeholder={status.hasSecret?'Tersimpan — kosongkan untuk tidak mengubah':''} className="mt-2"/>
    :<Input id={`${endpoint}-${f.name}`} name={f.name} required maxLength={100} inputMode={f.numeric?'numeric':undefined} defaultValue={status.values[f.name]} className="mt-2"/>}</div>)}
   <p className="text-xs text-muted-foreground">Redirect URL untuk app: <code>{status.redirectUrl}</code></p>
   <div className="flex flex-wrap gap-3"><Button disabled={busy} type="submit">Simpan</Button>
    <Button type="button" variant="outline" disabled={busy||!status.hasSecret} onClick={()=>void connect()}>{status.connected?'Hubungkan ulang toko':'Hubungkan toko'}</Button>
    <Button type="button" variant="outline" disabled={busy||!status.connected} onClick={()=>void run(()=>api(`${endpoint}/sync`,{method:'POST'}),'Stok dikirim ke '+title+'.')}>Rakit → {title}</Button>
    {pull&&<Button type="button" variant="outline" disabled={busy||!status.connected} onClick={()=>{if(confirm(`Stok Rakit akan ditimpa dengan stok ${title} (dicatat sebagai stok opname). SKU dengan lebih dari satu lokasi rak dilewati. Lanjutkan?`))void run(()=>api(`${endpoint}/pull`,{method:'POST'}),'Stok ditarik dari '+title+'.');}}>{title} → Rakit</Button>}</div>
  </form>
  <p className="mt-4 text-sm">{status.connected?<>Terhubung ke toko <strong>{status.shopName}</strong>.</>:`Belum terhubung ke toko ${title}.`}</p>
  {status.last&&<p className={`notice ${status.last.ok?'success':'error'} mt-2`}>{new Date(status.last.at).toLocaleString('id-ID')}: {status.last.message}</p>}
  {error&&<p className="notice error mt-4" role="alert">{error}</p>}{success&&<p className="notice success mt-4" role="status">{success}</p>}</section>;
}

"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '@/lib/client';
export function NotifySettings({target}:{target:string}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const run=async(action:()=>Promise<unknown>,message:string)=>{setBusy(true);setError('');setSuccess('');try{await action();setSuccess(message);router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="surface form-surface mt-6"><h2 className="mb-1 font-semibold">Notifikasi order baru</h2><p className="mb-5 text-sm text-muted-foreground">Setiap order baru dikirim ke grup WhatsApp lewat Hermes. Kosongkan untuk mematikan notifikasi.</p><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void run(()=>api('/api/settings/notify',{method:'PATCH',body:JSON.stringify({target:data.get('target')})}),'Target notifikasi disimpan.');}} className="grid max-w-xl gap-4"><div><Label htmlFor="notify-target">ID grup WhatsApp</Label><Input id="notify-target" name="target" maxLength={200} defaultValue={target} placeholder="120363012345678901@g.us" className="mt-2"/><p className="mt-1 text-xs text-muted-foreground">ID grup tercatat di <code>~/.hermes/whatsapp/bridge.log</code> saat anggota grup mengirim pesan.</p></div><div className="flex flex-wrap gap-3"><Button disabled={busy} type="submit">Simpan target</Button><Button type="button" variant="outline" disabled={busy||!target} onClick={()=>void run(()=>api('/api/settings/notify/test',{method:'POST'}),'Pesan uji terkirim.')}>Kirim pesan uji</Button></div></form>{error&&<p className="notice error mt-4" role="alert">{error}</p>}{success&&<p className="notice success mt-4" role="status">{success}</p>}</section>;
}

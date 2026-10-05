"use client";
import { useEffect,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ProductPagination } from './product-pagination';
import { api,ApiError } from '@/lib/client';
import type { Product,ProductLocation,ProductPage,Rack } from '@/lib/types';

export function StocktakeWorkspace({result,racks,search,rack}:{result:ProductPage;racks:Rack[];search:string;rack:number|null}){
 const [success,setSuccess]=useState('');
 return <><p className="notice warning mb-5">Hitung seluruh unit di lokasi, termasuk unit yang sudah dipicking dan belum selesai packing. Jika stok berubah selama penghitungan, muat ulang lalu hitung kembali.</p>
 {success&&<p className="notice success mb-4" role="status">{success}</p>}
 <section className="surface"><div className="section-heading"><div><h2>Hitung stok fisik</h2><p>Isi dan simpan hasil penghitungan untuk setiap lokasi.</p></div></div>
 <form action="/admin/stocktakes" className="flex flex-wrap gap-3 p-4"><div className="min-w-0 flex-1 basis-48"><Label htmlFor="stock-search">Cari SKU atau nama barang</Label><Input id="stock-search" key={search} name="search" defaultValue={search} placeholder="SKU atau nama barang…" className="mt-2"/></div><div><Label htmlFor="stock-rack">Filter rak</Label><select id="stock-rack" key={rack??'all'} name="rack" defaultValue={rack??''} className="native-select mt-2"><option value="">Semua rak</option>{racks.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div><Button type="submit" className="self-end">Cari</Button></form>
 <div className="divide-y">{result.products.map(product=>product.locations.filter(location=>rack===null||location.rack===rack).map(location=><CountForm key={`${location.id}:${location.rack}:${location.shelf}:${location.quantity}`} product={product} location={location} onSaved={()=>setSuccess(`Stok opname ${product.sku} · ${location.rackName} ${location.shelf} berhasil disimpan.`)}/>))}</div>
 {!result.products.length&&<p className="p-5 text-sm text-muted-foreground">Barang tidak ditemukan. Coba pencarian atau rak lainnya.</p>}
 <ProductPagination result={result} basePath="/admin/stocktakes" search={search} rack={rack}/></section></>;
}

function CountForm({product,location,onSaved}:{product:Product;location:ProductLocation;onSaved:()=>void}){
 const router=useRouter(),[quantity,setQuantity]=useState(''),[note,setNote]=useState(''),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[busy,setBusy]=useState(false),[pending,startTransition]=useTransition(),[ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 const value=quantity.trim()===''?null:Number(quantity),valid=value!==null&&Number.isSafeInteger(value)&&value>=0,difference=valid&&location.quantity!==null?value-location.quantity:null;
 return <form aria-label={`Opname ${product.sku} ${location.rackName} ${location.shelf}`} className="space-y-4 p-4" onSubmit={async event=>{
  event.preventDefault();if(busy||pending||conflict||!valid)return;setBusy(true);setError('');
  try{await api('/api/stocktakes',{method:'POST',body:JSON.stringify({locationId:location.id,expectedQuantity:location.quantity,expectedRack:location.rack,expectedShelf:location.shelf,quantity:value,note})});setQuantity('');setNote('');onSaved();startTransition(()=>router.refresh());}
  catch(cause){setError((cause as Error).message);setConflict(cause instanceof ApiError&&(cause.status===409||cause.status===404));}finally{setBusy(false);}
 }}>
 <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 break-words"><h3 className="font-semibold">{product.name}</h3><p className="font-mono text-xs text-muted-foreground">{product.sku}{!product.active&&' · Nonaktif'}</p></div><span className="location-tag">{location.rackName} · {location.shelf}</span></div>
 <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm"><p>Stok sistem: <strong>{location.quantity??'Belum diisi'}</strong></p><p>Dicadangkan: {location.reservedQuantity} unit</p><p aria-live="polite">Selisih: <strong>{difference===null?'—':`${difference>0?'+':''}${difference} unit`}</strong></p></div>
 <div className="flex flex-wrap items-end gap-3"><div className="w-36"><Label htmlFor={`physical-${location.id}`}>Jumlah fisik</Label><Input id={`physical-${location.id}`} type="number" required min={location.reservedQuantity} max={Number.MAX_SAFE_INTEGER} step={1} value={quantity} disabled={!ready||busy||pending||conflict} onChange={e=>setQuantity(e.target.value)} className="mt-2"/></div><div className="min-w-0 flex-1 basis-48"><Label htmlFor={`note-${location.id}`}>Catatan</Label><Textarea id={`note-${location.id}`} maxLength={500} value={note} disabled={!ready||busy||pending||conflict} onChange={e=>setNote(e.target.value)} placeholder="Catatan penghitungan (opsional)" className="mt-2" rows={2}/></div><Button type="submit" disabled={!ready||busy||pending||conflict||!valid}>{busy||pending?'Menyimpan…':'Simpan opname'}</Button></div>
 {error&&<p role="alert" className="notice error">{error}</p>}{conflict&&<Button type="button" variant="outline" onClick={()=>window.location.reload()}>Muat ulang stok</Button>}
 </form>;
}

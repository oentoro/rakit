"use client";
import { useEffect,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ProductPagination } from './product-pagination';
import { CameraScanner } from './camera-scanner';
import { api,ApiError } from '@/lib/client';
import type { Product,ProductLocation,ProductPage,Rack } from '@/lib/types';

export function StocktakeWorkspace({result,racks,search,rack}:{result:ProductPage;racks:Rack[];search:string;rack:number|null}){
 const [success,setSuccess]=useState(''),[scanned,setScanned]=useState<{product:Product;scanId:string;counts:Record<string,string>;notes:Record<string,string>;firstUnitPending:boolean}|null>(null),[locationId,setLocationId]=useState(''),[scanBusy,setScanBusy]=useState(false);
 const selectedLocation=scanned?.product.locations.find(location=>location.id===locationId);
 return <><p className="notice warning mb-5">Hitung seluruh unit di lokasi, termasuk unit yang sudah dipicking dan belum selesai packing. Jika stok berubah selama penghitungan, muat ulang lalu hitung kembali.</p>
 {success&&<p className="notice success mb-4" role="status">{success}</p>}
 <section className="surface form-surface mb-5"><h2 className="mb-2">Hitung barang dengan QR</h2><p className="mb-5 text-sm text-muted-foreground">Setiap scan menambah Jumlah fisik sebanyak 1 unit. Pilih rak/ambalan yang dihitung, lalu tekan Scan unit berikutnya untuk menghitung unit selanjutnya. Simpan hasil setelah seluruh unit dihitung. Kamera memerlukan HTTPS.</p>
 <CameraScanner kind="sku" storageKey="stocktake-count" onScan={async(code,requestId)=>{
  if(scanBusy)throw new ApiError(409,'Tunggu penyimpanan opname selesai sebelum scan unit berikutnya.');
  if(scanned?.product.sku===code){
   if(!selectedLocation)throw new ApiError(409,'Pilih rak / ambalan sebelum scan unit berikutnya.');
   const quantity=Number(scanned.counts[locationId]||0);
   if(!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(quantity+1))throw new ApiError(422,'Jumlah fisik harus berupa bilangan bulat yang valid sebelum melanjutkan scan.');
   setScanned({...scanned,counts:{...scanned.counts,[locationId]:String(quantity+1)}});setSuccess('');
   return {message:`${code} · ${selectedLocation.rackName} / ${selectedLocation.shelf}: ${quantity+1} unit dihitung.`};
  }
  if(scanned&&(scanned.firstUnitPending||Object.values(scanned.counts).some(quantity=>quantity!=='')||Object.values(scanned.notes).some(note=>note.trim()!=='')))throw new ApiError(409,'Simpan hasil penghitungan setiap lokasi sebelum scan SKU lain.');
  setScanned(null);setLocationId('');
  const product=await api<Product>(`/api/stocktakes/product?sku=${encodeURIComponent(code)}`);
  const firstLocation=product.locations.length===1?product.locations[0].id:'';
  setScanned({product,scanId:requestId,counts:firstLocation?{[firstLocation]:'1'}:{},notes:{},firstUnitPending:!firstLocation});setLocationId(firstLocation);setSuccess('');
  return {message:firstLocation?`${product.sku}: 1 unit dihitung.`:`${product.sku}: 1 unit dipindai. Pilih rak / ambalan untuk mencatat unit pertama.`};
 }}/></section>
 {scanned&&<section className="surface mb-5" aria-label="Barang hasil scan"><div className="section-heading"><div className="min-w-0 break-words"><h2>{scanned.product.name}</h2><p className="font-mono">{scanned.product.sku}</p></div></div>
 <div className="p-4"><Label htmlFor="scanned-location">Lokasi opname {scanned.product.sku}</Label><select id="scanned-location" className="native-select mt-2" value={locationId} disabled={scanBusy} onChange={event=>{
  const id=event.target.value;setLocationId(id);
  if(id&&scanned.firstUnitPending)setScanned({...scanned,firstUnitPending:false,counts:{...scanned.counts,[id]:'1'}});
 }}><option value="">Pilih rak / ambalan yang dihitung</option>{scanned.product.locations.map(location=><option key={location.id} value={location.id}>{location.rackName} / {location.shelf}{scanned.counts[location.id]!==undefined&&scanned.counts[location.id]!==''?` · dihitung ${scanned.counts[location.id]} unit`:''}</option>)}</select></div>
 {selectedLocation&&<CountForm key={`${scanned.scanId}:${selectedLocation.id}:${selectedLocation.quantity}`} product={scanned.product} location={selectedLocation} scanned draftQuantity={scanned.counts[locationId]??''} draftNote={scanned.notes[locationId]??''} onQuantityChange={quantity=>setScanned(current=>current?{...current,counts:{...current.counts,[selectedLocation.id]:quantity}}:current)} onNoteChange={note=>setScanned(current=>current?{...current,notes:{...current.notes,[selectedLocation.id]:note}}:current)} onBusyChange={setScanBusy} onSaved={quantity=>{
  setSuccess(`Stok opname ${scanned.product.sku} · ${selectedLocation.rackName} ${selectedLocation.shelf} berhasil disimpan.`);
  setScanned(current=>current?.product.id===scanned.product.id?{...current,product:{...current.product,locations:current.product.locations.map(location=>location.id===selectedLocation.id?{...location,quantity}:location)}}:current);
 }}/>}</section>}
 <section className="surface"><div className="section-heading"><div><h2>Hitung stok fisik</h2><p>Isi dan simpan hasil penghitungan untuk setiap lokasi.</p></div></div>
 <form action="/admin/stocktakes" className="flex flex-wrap gap-3 p-4"><div className="min-w-0 flex-1 basis-48"><Label htmlFor="stock-search">Cari SKU atau nama barang</Label><Input id="stock-search" key={search} name="search" defaultValue={search} placeholder="SKU atau nama barang…" className="mt-2"/></div><div><Label htmlFor="stock-rack">Filter rak</Label><select id="stock-rack" key={rack??'all'} name="rack" defaultValue={rack??''} className="native-select mt-2"><option value="">Semua rak</option>{racks.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div><Button type="submit" className="self-end">Cari</Button></form>
 <div className="divide-y">{result.products.map(product=>product.locations.filter(location=>rack===null||location.rack===rack).map(location=><CountForm key={`${location.id}:${location.rack}:${location.shelf}:${location.quantity}`} product={product} location={location} onSaved={()=>setSuccess(`Stok opname ${product.sku} · ${location.rackName} ${location.shelf} berhasil disimpan.`)}/>))}</div>
 {!result.products.length&&<p className="p-5 text-sm text-muted-foreground">Barang tidak ditemukan. Coba pencarian atau rak lainnya.</p>}
 <ProductPagination result={result} basePath="/admin/stocktakes" search={search} rack={rack}/></section></>;
}

function CountForm({product,location,onSaved,scanned=false,draftQuantity,draftNote,onQuantityChange,onNoteChange,onBusyChange}:{product:Product;location:ProductLocation;onSaved:(quantity:number)=>void;scanned?:boolean;draftQuantity?:string;draftNote?:string;onQuantityChange?:(quantity:string)=>void;onNoteChange?:(note:string)=>void;onBusyChange?:(busy:boolean)=>void}){
 const router=useRouter(),[localQuantity,setLocalQuantity]=useState(''),[localNote,setLocalNote]=useState(''),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[busy,setBusy]=useState(false),[pending,startTransition]=useTransition(),[ready,setReady]=useState(false);
 const quantity=draftQuantity??localQuantity,setQuantity=onQuantityChange??setLocalQuantity,note=draftNote??localNote,setNote=onNoteChange??setLocalNote;
 useEffect(()=>setReady(true),[]);
 const value=quantity.trim()===''?null:Number(quantity),valid=value!==null&&Number.isSafeInteger(value)&&value>=0,difference=valid&&location.quantity!==null?value-location.quantity:null;
 const inputId=`${scanned?'scan-':''}${location.id}`;
 return <form aria-label={`Opname ${scanned?'hasil scan ':''}${product.sku} ${location.rackName} ${location.shelf}`} className="space-y-4 p-4" onSubmit={async event=>{
  event.preventDefault();if(busy||pending||conflict||!valid)return;setBusy(true);onBusyChange?.(true);setError('');
  try{await api('/api/stocktakes',{method:'POST',body:JSON.stringify({locationId:location.id,expectedQuantity:location.quantity,expectedRack:location.rack,expectedShelf:location.shelf,quantity:value,note})});setQuantity('');setNote('');onSaved(value);startTransition(()=>router.refresh());}
  catch(cause){setError((cause as Error).message);setConflict(cause instanceof ApiError&&(cause.status===409||cause.status===404));}finally{setBusy(false);onBusyChange?.(false);}
 }}>
 <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 break-words"><h3 className="font-semibold">{product.name}</h3><p className="font-mono text-xs text-muted-foreground">{product.sku}{!product.active&&' · Nonaktif'}</p></div><span className="location-tag">{location.rackName} · {location.shelf}</span></div>
 <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm"><p>Stok sistem: <strong>{location.quantity??'Belum diisi'}</strong></p><p>Dicadangkan: {location.reservedQuantity} unit</p><p aria-live="polite">Selisih: <strong>{difference===null?'—':`${difference>0?'+':''}${difference} unit`}</strong></p></div>
 <div className="flex flex-wrap items-end gap-3"><div className="w-36"><Label htmlFor={`physical-${inputId}`}>Jumlah fisik</Label><Input id={`physical-${inputId}`} type="number" required min={location.reservedQuantity} max={Number.MAX_SAFE_INTEGER} step={1} value={quantity} disabled={!ready||busy||pending||conflict} onChange={e=>setQuantity(e.target.value)} className="mt-2"/></div><div className="min-w-0 flex-1 basis-48"><Label htmlFor={`note-${inputId}`}>Catatan</Label><Textarea id={`note-${inputId}`} maxLength={500} value={note} disabled={!ready||busy||pending||conflict} onChange={e=>setNote(e.target.value)} placeholder="Catatan penghitungan (opsional)" className="mt-2" rows={2}/></div><Button type="submit" disabled={!ready||busy||pending||conflict||!valid}>{busy||pending?'Menyimpan…':'Simpan opname'}</Button></div>
 {error&&<p role="alert" className="notice error">{error}</p>}{conflict&&<Button type="button" variant="outline" onClick={()=>window.location.reload()}>Muat ulang stok</Button>}
 </form>;
}

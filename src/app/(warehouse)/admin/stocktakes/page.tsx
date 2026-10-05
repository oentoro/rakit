import { pageActor } from '@/lib/server-actor';
import { listRackOverview } from '@/lib/racks';
import { paginateProducts } from '@/lib/catalog';
import { listStocktakes } from '@/lib/stocktake';
import { StocktakeWorkspace } from '@/components/stocktake-workspace';

export default async function Stocktakes({searchParams}:{searchParams:Promise<{search?:string|string[];rack?:string|string[];page?:string|string[]}>}){
 const actor=await pageActor(['admin']),params=await searchParams;
 const search=(typeof params.search==='string'?params.search:'').trim(),requestedRack=typeof params.rack==='string'?Number(params.rack):0;
 const rack=Number.isSafeInteger(requestedRack)&&requestedRack>0?requestedRack:null;
 const result=paginateProducts(actor,{search,rack,page:typeof params.page==='string'?Number(params.page):1}),history=listStocktakes(actor);
 return <><div className="page-heading"><div><span className="eyebrow">PEMERIKSAAN STOK GUDANG</span><h1>Stok opname</h1><p>Cocokkan stok sistem dengan jumlah fisik per rak dan ambalan.</p></div></div>
 <StocktakeWorkspace result={result} racks={listRackOverview(actor)} search={search} rack={rack}/>
 <section className="surface mt-6" aria-label="Riwayat opname"><div className="section-heading"><div><h2>Riwayat opname</h2><p>50 penghitungan terakhir dari seluruh rak.</p></div></div>
 <div className="divide-y">{history.map(item=>{
  const difference=item.beforeQuantity===null?null:item.quantity-item.beforeQuantity;
  return <article key={item.id} className="space-y-2 p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 break-words"><strong>{item.name}</strong><p className="font-mono text-xs text-muted-foreground">{item.sku}</p></div><span className="location-tag">{item.rackName} · {item.shelf}</span></div>
  <p>Stok sistem: {item.beforeQuantity??'Belum diisi'} → Fisik: {item.quantity} unit · Selisih: {difference===null?'—':`${difference>0?'+':''}${difference} unit`}</p>
  {item.note&&<p className="whitespace-pre-wrap break-words text-muted-foreground">{item.note}</p>}
  <p className="text-xs text-muted-foreground">{item.actorName} · {new Date(item.createdAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p></article>;
 })}</div>{!history.length&&<p className="p-5 text-sm text-muted-foreground">Belum ada penghitungan stok.</p>}</section></>;
}

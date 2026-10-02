import { pageActor } from '@/lib/server-actor';
import { listRackOverview } from '@/lib/racks';
import { paginateProducts } from '@/lib/catalog';
import { CatalogWorkspace } from '@/components/catalog-workspace';
export default async function Products({searchParams}:{searchParams:Promise<{search?:string|string[];rack?:string|string[];page?:string|string[]}>}){
 const actor=await pageActor(['admin']),params=await searchParams,racks=listRackOverview(actor);
 const search=(typeof params.search==='string'?params.search:'').trim(),requestedRack=typeof params.rack==='string'?Number(params.rack):0;
 const rack=Number.isSafeInteger(requestedRack)&&requestedRack>0?requestedRack:null;
 const result=paginateProducts(actor,{search,rack,page:typeof params.page==='string'?Number(params.page):1});
 return <><div className="page-heading"><div><span className="eyebrow">{racks.length} RAK · {racks.reduce((sum,r)=>sum+r.shelfCount,0)} AMBALAN</span><h1>Barang & lokasi</h1><p>Satu SKU, satu foto, stok di beberapa lokasi.</p></div></div><CatalogWorkspace result={result} racks={racks} search={search} rack={rack}/></>;
}

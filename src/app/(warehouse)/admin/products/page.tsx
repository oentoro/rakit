import { pageActor } from '@/lib/server-actor';
import { listRacks } from '@/lib/racks';
import { listProducts } from '@/lib/catalog';
import { CatalogWorkspace } from '@/components/catalog-workspace';
export default async function Products(){const actor=await pageActor(['admin']);const racks=listRacks(actor);return <><div className="page-heading"><div><span className="eyebrow">{racks.length} RAK · {racks.reduce((sum,r)=>sum+r.shelfCount,0)} AMBALAN</span><h1>Barang & lokasi</h1><p>Satu SKU, satu foto, satu lokasi yang mudah ditemukan.</p></div></div><CatalogWorkspace products={listProducts(actor)} racks={racks}/></>;}

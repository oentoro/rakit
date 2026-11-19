import { getDatabase } from './db';
import { allProducts } from './catalog';
// Shared plumbing for marketplace stock sync (TikTok Shop, Shopee): per-channel settings, last result, and pushed stock.
export type Channel='tiktok'|'shopee';
export type ChannelStatus={values:Record<string,string>;hasSecret:boolean;connected:boolean;shopName:string;redirectUrl:string;last:{at:number;ok:boolean;message:string}|null};
export type SyncResult={updated:number;unchanged:number;unmatched:number};
export function channelSettings(channel:Channel){
  const db=getDatabase(),upsert=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const get=(key:string)=>String(db.prepare('SELECT value FROM settings WHERE key=?').get(`${channel}_${key}`)?.value??'');
  const set=(values:Record<string,string>)=>{for(const [k,v] of Object.entries(values))upsert.run(`${channel}_${k}`,v);};
  return {get,set,
    record:(ok:boolean,message:string)=>set({last:JSON.stringify({at:Date.now(),ok,message})}),
    last:()=>{const last=get('last');return last?JSON.parse(last) as ChannelStatus['last']:null;}};
}
/** Stock a marketplace may sell: counted stock minus units still held by unfinished orders (stock is deducted only when packing completes). */
export function heldByProduct():Map<string,number>{
  return new Map((getDatabase().prepare("SELECT oi.product_id id,SUM(oi.qty) n FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'completed' GROUP BY oi.product_id").all() as {id:string;n:number}[]).map(r=>[r.id,Number(r.n)]));
}
export function availableBySku():Map<string,number>{
  const held=heldByProduct();
  return new Map(allProducts().filter(p=>p.active&&p.totalQuantity!==null).map(p=>[p.sku,Math.max(0,p.totalQuantity!-(held.get(p.id)??0))]));
}
/** Last quantity pushed per SKU: only changed SKUs are pushed, so a marketplace's own order deductions are not overwritten every cycle. */
export function pushedStock(channel:Channel){
  const db=getDatabase();
  const pushed=new Map((db.prepare('SELECT sku,pushed_qty FROM channel_stock WHERE channel=?').all(channel) as {sku:string;pushed_qty:number}[]).map(r=>[r.sku,r.pushed_qty]));
  const save=db.prepare('INSERT INTO channel_stock(channel,sku,pushed_qty,pushed_at) VALUES(?,?,?,?) ON CONFLICT(channel,sku) DO UPDATE SET pushed_qty=excluded.pushed_qty,pushed_at=excluded.pushed_at');
  return {pushed,save:(sku:string,qty:number)=>save.run(channel,sku,qty,Date.now())};
}
export type PullResult={updated:number;unchanged:number;skipped:number};
export const syncMessage=(r:SyncResult)=>`Sinkron stok: ${r.updated} SKU diperbarui, ${r.unchanged} tetap, ${r.unmatched} SKU Rakit tidak ditemukan di toko.`;

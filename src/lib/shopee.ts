import { createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { assertActiveActor } from './auth';
import { fail } from './errors';
import { availableBySku,channelSettings,heldByProduct,pushedStock,syncMessage,type ChannelStatus,type PullResult,type SyncResult } from './channels';
import { allProducts } from './catalog';
import { getDatabase } from './db';
import { notifyNewOrder,notifyText } from './notify';
import { cancelOrder,createOrder,getOrder,orderIdByNumber,updateOrder } from './orders';
import { saveStocktake } from './stocktake';
import type { Actor } from './types';
// Shopee Open Platform v2 (live host). Only stock push Rakit -> Shopee, matched by item/model SKU = Rakit SKU.
// SHOPEE_HOST=https://openplatform.sandbox.test-stable.shopee.sg uses the sandbox with the console's test Partner ID/Key.
const HOST=process.env.SHOPEE_HOST||'https://partner.shopeemobile.com';
type Fetch=typeof fetch;
const settings=()=>channelSettings('shopee'),get=(key:string)=>settings().get(key),set=(v:Record<string,string>)=>settings().set(v);
const redirectUrl=()=>`${process.env.APP_ORIGIN||''}/api/shopee/callback`;
export function shopeeStatus(actor:Actor):ChannelStatus{
  assertActiveActor(actor,['admin']);
  return {values:{partnerId:get('partner_id')},hasSecret:!!get('partner_key'),shopName:get('shop_name'),connected:!!get('shop_id'),redirectUrl:redirectUrl(),last:settings().last()};
}
const configSchema=z.object({partnerId:z.string().trim().regex(/^\d{1,20}$/,'Partner ID berupa angka.'),partnerKey:z.string().trim().max(200).optional(),pushKey:z.string().trim().max(200).optional()});
export function saveShopeeConfig(actor:Actor,input:unknown):ChannelStatus{
  assertActiveActor(actor,['admin']);const d=configSchema.parse(input);
  set({partner_id:d.partnerId,...(d.partnerKey?{partner_key:d.partnerKey}:{}),...(d.pushKey?{push_key:d.pushKey}:{})}); // blank key keeps the stored one
  return shopeeStatus(actor);
}
/** Shopee v2 signature: HMAC-SHA256(partner_key, partner_id + path + timestamp [+ access_token + shop_id for shop APIs]). */
export function shopeeSign(key:string,base:string):string{return createHmac('sha256',key).update(base).digest('hex');}
function publicQuery(path:string){const timestamp=String(Math.floor(Date.now()/1000)),partner_id=get('partner_id');return new URLSearchParams({partner_id,timestamp,sign:shopeeSign(get('partner_key'),partner_id+path+timestamp)});}
async function json(response:Response){const body=await response.json().catch(()=>null);if(!response.ok||!body||body.error)throw new Error(`Shopee ${body?.error||response.status}: ${String(body?.message??'').slice(0,200)}`);return body;}
/** The redirect carries our one-time state; Shopee appends code and shop_id to it. */
export function shopeeAuthorizeUrl(actor:Actor):string{
  assertActiveActor(actor,['admin']);if(!get('partner_id')||!get('partner_key')) fail(400,'Simpan Partner ID dan Partner Key terlebih dahulu.');
  if(!process.env.APP_ORIGIN) fail(400,'APP_ORIGIN belum diatur di server; Shopee butuh alamat callback lengkap.');
  const state=randomBytes(16).toString('hex');set({oauth_state:state});const path='/api/v2/shop/auth_partner';
  return `${HOST}${path}?${publicQuery(path)}&${new URLSearchParams({redirect:`${redirectUrl()}?state=${state}`})}`;
}
// expire_in is seconds from now (about 4 hours); the refresh token rotates on every refresh.
function saveToken(data:{access_token:string;refresh_token:string;expire_in:number}){set({access_token:data.access_token,refresh_token:data.refresh_token,access_expires:String(Math.floor(Date.now()/1000)+data.expire_in)});}
async function token(f:Fetch,path:string,body:Record<string,unknown>){
  saveToken(await f(`${HOST}${path}?${publicQuery(path)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,partner_id:Number(get('partner_id'))}),signal:AbortSignal.timeout(30000)}).then(json));
}
function call(f:Fetch,method:'GET'|'POST',path:string,query:Record<string,string>={},payload?:unknown){
  const timestamp=String(Math.floor(Date.now()/1000)),partner_id=get('partner_id'),access_token=get('access_token'),shop_id=get('shop_id');
  const params=new URLSearchParams({partner_id,timestamp,access_token,shop_id,sign:shopeeSign(get('partner_key'),partner_id+path+timestamp+access_token+shop_id),...query});
  return f(`${HOST}${path}?${params}`,{method,headers:{'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(30000)}).then(json);
}
export async function connectShopee(actor:Actor,code:string,shopId:string,state:string,f:Fetch=fetch):Promise<void>{
  assertActiveActor(actor,['admin']);const expected=get('oauth_state');set({oauth_state:''});
  if(!expected||state!==expected) fail(400,'Sesi otorisasi Shopee tidak valid. Ulangi dari Pengaturan.');
  try{
    if(!/^\d+$/.test(shopId)) throw new Error('shop_id tidak ada.');
    await token(f,'/api/v2/auth/token/get',{code,shop_id:Number(shopId)});set({shop_id:shopId});
    const name=(await call(f,'GET','/api/v2/shop/get_shop_info')).shop_name||shopId;
    set({shop_name:name});settings().record(true,`Terhubung ke toko ${name}.`);
  }catch(error){set({shop_id:''});settings().record(false,`Gagal menghubungkan Shopee: ${(error as Error).message}`);}
}
let refreshing:Promise<void>|null=null;
// Single flight: the refresh token rotates, so two parallel refreshes (stock sync + order push) would invalidate each other.
function ensureToken(f:Fetch):Promise<void>{
  if(Number(get('access_expires'))-600>Date.now()/1000)return Promise.resolve();
  return refreshing??=token(f,'/api/v2/auth/access_token/get',{refresh_token:get('refresh_token'),shop_id:Number(get('shop_id'))}).finally(()=>{refreshing=null;});
}
type Target={itemId:number;modelId:number;sku:string;stock:number|null};
// Sum over Shopee locations; null when Shopee did not report stock, so a missing field is never read as 0.
const stockOf=(info?:{seller_stock?:{stock:number}[]})=>info?.seller_stock?info.seller_stock.reduce((n,s)=>n+Number(s.stock||0),0):null;
/** Every Shopee SKU of NORMAL items: item_sku for items without variations, model_sku for each variation. */
async function shopeeSkus(f:Fetch):Promise<Target[]>{
  const ids:number[]=[];let offset=0,more=true;
  while(more){const r=(await call(f,'GET','/api/v2/product/get_item_list',{offset:String(offset),page_size:'100',item_status:'NORMAL'})).response??{};ids.push(...(r.item??[]).map((i:{item_id:number})=>i.item_id));more=!!r.has_next_page;offset=r.next_offset??0;}
  const targets:Target[]=[];
  for(let i=0;i<ids.length;i+=50){
    const items=(await call(f,'GET','/api/v2/product/get_item_base_info',{item_id_list:ids.slice(i,i+50).join(',')})).response?.item_list??[];
    for(const item of items){
      if(!item.has_model){targets.push({itemId:item.item_id,modelId:0,sku:item.item_sku,stock:stockOf(item.stock_info_v2)});continue;}
      // shortcut: one get_model_list call per variation item each cycle; cache the SKU map if the catalog grows into thousands of items.
      for(const m of (await call(f,'GET','/api/v2/product/get_model_list',{item_id:String(item.item_id)})).response?.model??[])targets.push({itemId:item.item_id,modelId:m.model_id,sku:m.model_sku,stock:stockOf(m.stock_info_v2)});
    }
  }
  return targets;
}
let running:Promise<SyncResult|null>|null=null;
/** force pushes every matched SKU (manual button); the schedule pushes only SKUs changed since the last push. */
export function syncShopeeStock(f:Fetch=fetch,force=false):Promise<SyncResult|null>{
  if(!get('shop_id'))return Promise.resolve(null);
  return running??=(async()=>{
    try{
      await ensureToken(f);const available=availableBySku(),{pushed,save}=pushedStock('shopee'),seen=new Set<string>(),byItem=new Map<number,Target[]>();let unchanged=0,updated=0;
      for(const t of await shopeeSkus(f)){
        const qty=available.get(t.sku);if(qty===undefined)continue;seen.add(t.sku);
        if(!force&&pushed.get(t.sku)===qty){unchanged++;continue;}
        byItem.set(t.itemId,[...(byItem.get(t.itemId)??[]),t]);
      }
      for(const [itemId,targets] of byItem){
        // shortcut: no location_id, so the stock goes to the shop's default location; add location_id for multi-warehouse shops.
        const r=(await call(f,'POST','/api/v2/product/update_stock',{},{item_id:itemId,stock_list:targets.map(t=>({model_id:t.modelId,seller_stock:[{stock:available.get(t.sku)}]}))})).response??{};
        const failed=new Set((r.failure_list??[]).map((x:{model_id:number})=>x.model_id));
        for(const t of targets)if(!failed.has(t.modelId)){save(t.sku,available.get(t.sku)!);updated++;}
        if(failed.size)throw new Error(`${failed.size} SKU ditolak: ${String(r.failure_list[0]?.failed_reason??'').slice(0,200)}`);
      }
      const result={updated,unchanged,unmatched:[...available.keys()].filter(k=>!seen.has(k)).length};
      settings().record(true,syncMessage(result));return result;
    }catch(error){settings().record(false,`Sinkron stok gagal: ${(error as Error).message}`);throw error;}
    finally{running=null;}
  })();
}
export async function syncShopeeNow(actor:Actor,f:Fetch=fetch):Promise<SyncResult>{
  assertActiveActor(actor,['admin']);if(!get('shop_id')) fail(400,'Hubungkan toko Shopee terlebih dahulu.');
  if(running) fail(409,'Sinkron Shopee sedang berjalan. Coba lagi sebentar.');
  try{return (await syncShopeeStock(f,true))!;}catch(error){fail(424,`Sinkron stok gagal: ${(error as Error).message}`);}
}
/** Shopee -> Rakit: writes Shopee stock (plus units held by unfinished Rakit orders) as a stocktake, one per single-location SKU. */
export async function pullShopeeStock(actor:Actor,f:Fetch=fetch):Promise<PullResult>{
  const admin=assertActiveActor(actor,['admin']);if(!get('shop_id')) fail(400,'Hubungkan toko Shopee terlebih dahulu.');
  if(running) fail(409,'Sinkron Shopee sedang berjalan. Coba lagi sebentar.');
  let done!:()=>void;running=new Promise(resolve=>{done=()=>resolve(null);});
  try{
    await ensureToken(f);const targets=await shopeeSkus(f);
    const products=new Map(allProducts().map(p=>[p.sku,p])),held=heldByProduct(),{save}=pushedStock('shopee');let updated=0,unchanged=0,skipped=0;
    for(const t of targets){
      const p=products.get(t.sku);if(!p)continue;
      // One Shopee number cannot be split across several rack locations; those SKUs need a manual stocktake.
      if(t.stock===null||p.locations.length!==1){skipped++;continue;}
      const loc=p.locations[0],qty=t.stock+(held.get(p.id)??0);
      if(loc.quantity===qty)unchanged++;
      else try{saveStocktake(admin,{locationId:loc.id,expectedQuantity:loc.quantity,expectedRack:loc.rack,expectedShelf:loc.shelf,quantity:qty,note:'Sinkron dari Shopee'});updated++;}catch{skipped++;continue;}
      save(t.sku,t.stock); // Rakit now offers exactly Shopee's number, so the schedule has nothing to push back
    }
    const result={updated,unchanged,skipped};
    settings().record(true,`Tarik stok dari Shopee: ${updated} SKU diperbarui, ${unchanged} tetap, ${skipped} dilewati (lebih dari satu lokasi rak, stok tidak dilaporkan, atau ditolak).`);return result;
  }catch(error){settings().record(false,`Tarik stok gagal: ${(error as Error).message}`);fail(424,`Tarik stok gagal: ${(error as Error).message}`);}
  finally{running=null;done();}
}

// ---- Orders: order_status_push (code 3) imports Shopee orders; pollShopeeOrders catches pushes missed while the Pi or tunnel was down.
export const shopeePushUrl=()=>`${process.env.APP_ORIGIN||''}/api/shopee/push`;
/** Push signature: HMAC-SHA256(push partner key from "Set Push", callback_url + "|" + raw body) in the Authorization header. Returns the order to import, if any. */
export function readShopeePush(body:string,authorization:string):string|null{
  const key=get('push_key');if(!key||!process.env.APP_ORIGIN) fail(401,'Push tidak dikenali.');
  const expected=Buffer.from(shopeeSign(key,`${shopeePushUrl()}|${body}`)),given=Buffer.from(authorization.trim().toLowerCase());
  if(expected.length!==given.length||!timingSafeEqual(expected,given)) fail(401,'Push tidak dikenali.');
  const msg=JSON.parse(body) as {code?:number;shop_id?:number;data?:{ordersn?:string}};
  return msg.code===3&&String(msg.shop_id)===get('shop_id')&&msg.data?.ordersn?String(msg.data.ordersn):null;
}
// shortcut: orders are attributed to the first active admin; store the connecting admin if several admins need separate audit trails.
const systemAdmin=()=>getDatabase().prepare("SELECT id,name,role FROM users WHERE role='admin' AND active=1 ORDER BY name LIMIT 1").get() as Actor|undefined;
const OPEN=new Set(['READY_TO_SHIP','PROCESSED','RETRY_SHIP']);
type ShopeeOrder={order_sn:string;order_status:string;item_list?:{item_sku?:string;model_sku?:string;item_name?:string;model_quantity_purchased:number}[]};
async function applyOrder(actor:Actor,o:ShopeeOrder,f:Fetch){
  let id=orderIdByNumber(o.order_sn),created=false;
  if(o.order_status==='CANCELLED'){
    const r=id&&cancelOrder(actor,id,'Dibatalkan di Shopee');
    if(r) void notifyText(r==='deleted'?`❌ Order Shopee ${o.order_sn} dibatalkan pembeli dan dihapus dari Rakit (belum diambil).`:`❌ Order Shopee ${o.order_sn} DIBATALKAN, tetapi sudah mulai diproses. Kembalikan barangnya ke rak.`);
    return;
  }
  if(!OPEN.has(o.order_status))return;
  if(!id){
    const products=new Map(allProducts().map(p=>[p.sku,p])),items:{productId:string;qty:number}[]=[],missing:string[]=[];
    for(const it of o.item_list??[]){const sku=(it.model_sku||it.item_sku||'').trim(),p=products.get(sku);if(p?.active)items.push({productId:p.id,qty:it.model_quantity_purchased});else missing.push(sku||it.item_name||'?');}
    if(missing.length||!items.length){
      if(!get(`failed_${o.order_sn}`)){set({[`failed_${o.order_sn}`]:'1'});void notifyText(`⚠️ Order Shopee ${o.order_sn} belum masuk Rakit: SKU tidak dikenal atau nonaktif (${missing.join(', ')}). Buat order manual.`);}
      return;
    }
    id=createOrder(actor,{orderNumber:o.order_sn,receiptPages:[],items});created=true;
  }
  const order=getOrder(actor,id);
  // The tracking number exists only after the seller arranges shipment (PROCESSED).
  if(!order.airwayBill&&order.status!=='completed'&&o.order_status!=='READY_TO_SHIP'){
    const tn=String((await call(f,'GET','/api/v2/logistics/get_tracking_number',{order_sn:o.order_sn})).response?.tracking_number??'').trim();
    if(tn) updateOrder(actor,id,{orderNumber:order.orderNumber,airwayBill:tn,pdfFileId:order.pdfFileId??undefined,receiptPages:order.receiptPages,items:order.items.map(i=>({productId:i.productId,qty:i.qty}))});
  }
  if(created) void notifyNewOrder(getOrder(actor,id));
}
let orderQueue:Promise<unknown>=Promise.resolve();
/** Serialized so a push and the poll never import the same order twice. */
export function importShopeeOrders(sns:string[],f:Fetch=fetch):Promise<void>{
  const run=orderQueue.then(async()=>{
    const actor=systemAdmin();if(!get('shop_id')||!actor||!sns.length)return;
    await ensureToken(f);
    for(let i=0;i<sns.length;i+=50){
      const list=(await call(f,'GET','/api/v2/order/get_order_detail',{order_sn_list:sns.slice(i,i+50).join(','),response_optional_fields:'item_list'})).response?.order_list??[];
      if(!list.length)console.log(`Shopee: order ${sns.slice(i,i+50).join(',')} tidak ditemukan di toko.`);
      for(const o of list as ShopeeOrder[]){try{await applyOrder(actor,o,f);}catch(error){console.error(`Shopee order ${o.order_sn} failed:`,(error as Error).message);}}
    }
  });
  orderQueue=run.catch(()=>{});return run;
}
export async function pollShopeeOrders(f:Fetch=fetch):Promise<void>{
  if(!get('shop_id'))return;
  await ensureToken(f);const now=Math.floor(Date.now()/1000);
  const from=Math.max((Number(get('orders_since'))||now-3300)-300,now-15*86400+60); // 5-minute overlap; Shopee allows at most 15 days
  const sns:string[]=[];let cursor='';
  do{const r=(await call(f,'GET','/api/v2/order/get_order_list',{time_range_field:'update_time',time_from:String(from),time_to:String(now),page_size:'100',...(cursor?{cursor}:{})})).response??{};sns.push(...(r.order_list??[]).map((o:{order_sn:string})=>o.order_sn));cursor=r.more?r.next_cursor:'';}while(cursor);
  await importShopeeOrders(sns,f);set({orders_since:String(now)});
}

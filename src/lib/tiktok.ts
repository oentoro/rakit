import { createHmac,randomBytes } from 'node:crypto';
import { z } from 'zod';
import { assertActiveActor } from './auth';
import { fail } from './errors';
import { availableBySku,channelSettings,pushedStock,syncMessage,type ChannelStatus,type SyncResult } from './channels';
import type { Actor } from './types';
// TikTok Shop Open API (version 202309). Only stock push Rakit -> TikTok, matched by Seller SKU = Rakit SKU.
const API='https://open-api.tiktokglobalshop.com',AUTH='https://auth.tiktok-shops.com/api/v2/token';
type Fetch=typeof fetch;
const settings=()=>channelSettings('tiktok'),get=(key:string)=>settings().get(key),set=(v:Record<string,string>)=>settings().set(v);
export function tiktokStatus(actor:Actor):ChannelStatus{
  assertActiveActor(actor,['admin']);
  return {values:{appKey:get('app_key'),serviceId:get('service_id')},hasSecret:!!get('app_secret'),shopName:get('shop_name'),connected:!!get('shop_cipher'),redirectUrl:`${process.env.APP_ORIGIN||''}/api/tiktok/callback`,last:settings().last()};
}
const configSchema=z.object({appKey:z.string().trim().min(1).max(100).regex(/^\w+$/),appSecret:z.string().trim().max(200).optional(),serviceId:z.string().trim().min(1).max(100).regex(/^\w+$/)});
export function saveTiktokConfig(actor:Actor,input:unknown):ChannelStatus{
  assertActiveActor(actor,['admin']);const d=configSchema.parse(input);
  set({app_key:d.appKey,service_id:d.serviceId,...(d.appSecret?{app_secret:d.appSecret}:{})}); // blank secret keeps the stored one
  return tiktokStatus(actor);
}
/** Seller opens this TikTok page to authorize the shop; TikTok redirects back to /api/tiktok/callback. */
export function tiktokAuthorizeUrl(actor:Actor):string{
  assertActiveActor(actor,['admin']);if(!get('app_key')||!get('app_secret')||!get('service_id')) fail(400,'Simpan App Key, App Secret, dan Service ID terlebih dahulu.');
  const state=randomBytes(16).toString('hex');set({oauth_state:state});
  return `https://services.tiktokshop.com/open/authorize?${new URLSearchParams({service_id:get('service_id'),state})}`;
}
/** TikTok request signature: HMAC-SHA256(secret, secret + path + sorted key/value pairs + body + secret). */
export function sign(secret:string,path:string,params:Record<string,string>,body=''):string{
  const pairs=Object.keys(params).filter(k=>k!=='sign'&&k!=='access_token').sort().map(k=>k+params[k]).join('');
  return createHmac('sha256',secret).update(secret+path+pairs+body+secret).digest('hex');
}
async function json(response:Response){const body=await response.json().catch(()=>null);if(!response.ok||body?.code!==0)throw new Error(`TikTok ${body?.code??response.status}: ${String(body?.message??'').slice(0,200)}`);return body.data;}
// TikTok returns expiry as a unix timestamp in seconds.
function saveToken(data:{access_token:string;access_token_expire_in:number;refresh_token:string}){set({access_token:data.access_token,access_expires:String(data.access_token_expire_in),refresh_token:data.refresh_token});}
function call(f:Fetch,token:string,method:'GET'|'POST',path:string,query:Record<string,string>={},payload?:unknown){
  const body=payload===undefined?'':JSON.stringify(payload),params={app_key:get('app_key'),timestamp:String(Math.floor(Date.now()/1000)),...query};
  return f(`${API}${path}?${new URLSearchParams({...params,sign:sign(get('app_secret'),path,params,body)})}`,{method,headers:{'Content-Type':'application/json','x-tts-access-token':token},...(body?{body}:{}),signal:AbortSignal.timeout(30000)}).then(json);
}
export async function connectTiktok(actor:Actor,code:string,state:string,f:Fetch=fetch):Promise<void>{
  assertActiveActor(actor,['admin']);const expected=get('oauth_state');set({oauth_state:''});
  if(!expected||state!==expected) fail(400,'Sesi otorisasi TikTok tidak valid. Ulangi dari Pengaturan.');
  try{
    saveToken(await f(`${AUTH}/get?${new URLSearchParams({app_key:get('app_key'),app_secret:get('app_secret'),auth_code:code,grant_type:'authorized_code'})}`,{signal:AbortSignal.timeout(30000)}).then(json));
    // shortcut: uses the first authorized shop; add a picker if one app ever serves several shops.
    const shop=(await call(f,get('access_token'),'GET','/authorization/202309/shops')).shops?.[0];
    if(!shop) throw new Error('Tidak ada toko yang diotorisasi.');
    set({shop_cipher:shop.cipher,shop_name:shop.name||shop.id});settings().record(true,`Terhubung ke toko ${shop.name||shop.id}.`);
  }catch(error){settings().record(false,`Gagal menghubungkan TikTok: ${(error as Error).message}`);}
}
async function accessToken(f:Fetch):Promise<string>{
  if(Number(get('access_expires'))-3600>Date.now()/1000)return get('access_token');
  saveToken(await f(`${AUTH}/refresh?${new URLSearchParams({app_key:get('app_key'),app_secret:get('app_secret'),refresh_token:get('refresh_token'),grant_type:'refresh_token'})}`,{signal:AbortSignal.timeout(30000)}).then(json));
  return get('access_token');
}
let running:Promise<SyncResult|null>|null=null;
/** force pushes every matched SKU (manual button); the schedule pushes only SKUs changed since the last push. */
export function syncTiktokStock(f:Fetch=fetch,force=false):Promise<SyncResult|null>{
  if(!get('shop_cipher'))return Promise.resolve(null);
  return running??=(async()=>{
    try{
      const token=await accessToken(f),shop_cipher=get('shop_cipher'),available=availableBySku(),{pushed,save}=pushedStock('tiktok');
      const seen=new Set<string>();let updated=0,unchanged=0,page_token='';
      do{
        const data=await call(f,token,'POST','/product/202309/products/search',{shop_cipher,page_size:'100',...(page_token?{page_token}:{})},{});
        for(const product of data.products??[]){
          const skus=[];
          for(const sku of product.skus??[]){
            const qty=available.get(sku.seller_sku);if(qty===undefined)continue;seen.add(sku.seller_sku);
            if(!force&&pushed.get(sku.seller_sku)===qty){unchanged++;continue;}
            // shortcut: writes the whole quantity to the SKU's first TikTok warehouse; split per warehouse if the shop uses several.
            skus.push({id:sku.id,seller_sku:sku.seller_sku,inventory:[{quantity:qty,...(sku.inventory?.[0]?.warehouse_id?{warehouse_id:sku.inventory[0].warehouse_id}:{})}]});
          }
          if(!skus.length)continue;
          await call(f,token,'POST',`/product/202309/products/${product.id}/inventory/update`,{shop_cipher},{skus:skus.map(({seller_sku:_,...s})=>s)});
          for(const s of skus)save(s.seller_sku,s.inventory[0].quantity);updated+=skus.length;
        }
        page_token=data.next_page_token||'';
      }while(page_token);
      const result={updated,unchanged,unmatched:[...available.keys()].filter(k=>!seen.has(k)).length};
      settings().record(true,syncMessage(result));return result;
    }catch(error){settings().record(false,`Sinkron stok gagal: ${(error as Error).message}`);throw error;}
    finally{running=null;}
  })();
}
export async function syncTiktokNow(actor:Actor,f:Fetch=fetch):Promise<SyncResult>{
  assertActiveActor(actor,['admin']);if(!get('shop_cipher')) fail(400,'Hubungkan toko TikTok terlebih dahulu.');
  if(running) fail(409,'Sinkron TikTok sedang berjalan. Coba lagi sebentar.');
  try{return (await syncTiktokStock(f,true))!;}catch(error){fail(424,`Sinkron stok gagal: ${(error as Error).message}`);}
}

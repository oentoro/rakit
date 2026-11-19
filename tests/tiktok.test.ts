import { createHmac } from 'node:crypto';
import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder } from '../src/lib/orders';
import { connectTiktok,saveTiktokConfig,sign,syncTiktokNow,syncTiktokStock,tiktokAuthorizeUrl,tiktokStatus } from '../src/lib/tiktok';
test('signature = HMAC(secret, secret+path+sorted pairs without access_token/sign+body+secret)',()=>{
 const expected=createHmac('sha256','s').update('s/p/xa1b2{"x":1}s').digest('hex');
 expect(sign('s','/p/x',{b:'2',a:'1',access_token:'t',sign:'old'},'{"x":1}')).toBe(expected);
});
test('connect checks state, then sync pushes counted stock minus open orders only when it changed',async()=>{
 const {admin,staff}=fixture();
 const a=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'A',quantity:10,active:true});
 saveProduct(admin,null,{sku:'U',name:'Belum dihitung',rack:1,shelf:'A',quantity:null,active:true});
 saveProduct(admin,null,{sku:'R',name:'Hanya di Rakit',rack:1,shelf:'A',quantity:3,active:true});
 createOrder(admin,{orderNumber:'O1',airwayBill:'JX1',receiptPages:[],items:[{productId:a,qty:2}]});
 expect(()=>saveTiktokConfig(staff,{appKey:'k',serviceId:'1'})).toThrow();
 saveTiktokConfig(admin,{appKey:'key',appSecret:'secret',serviceId:'7'});
 expect(tiktokStatus(admin)).toMatchObject({hasSecret:true,connected:false});
 expect(JSON.stringify(tiktokStatus(admin))).not.toContain('secret"'); // secret never sent to the browser
 const calls:{url:URL;body:string}[]=[];
 const f=(async(input:string,init?:RequestInit)=>{const url=new URL(input);calls.push({url,body:String(init?.body??'')});
  const data=url.pathname.endsWith('/token/get')?{access_token:'tok',access_token_expire_in:Date.now()/1000+86400,refresh_token:'ref'}
   :url.pathname.endsWith('/shops')?{shops:[{cipher:'CIPH',name:'Toko'}]}
   :url.pathname.endsWith('/search')?{products:[{id:'P1',skus:[{id:'S1',seller_sku:'A',inventory:[{warehouse_id:'W',quantity:99}]},{id:'S2',seller_sku:'TT-ONLY'}]}]}:{};
  return new Response(JSON.stringify({code:0,message:'ok',data}));}) as typeof fetch;
 await connectTiktok(admin,'code','forged',f).catch(()=>{});expect(tiktokStatus(admin).connected).toBe(false);
 const state=new URL(tiktokAuthorizeUrl(admin)).searchParams.get('state')!;
 await connectTiktok(admin,'code',state,f);expect(tiktokStatus(admin)).toMatchObject({connected:true,shopName:'Toko'});
 calls.length=0;
 expect(await syncTiktokNow(admin,f)).toEqual({updated:1,unchanged:0,unmatched:1}); // R missing on TikTok, U uncounted
 const update=calls.find(c=>c.url.pathname==='/product/202309/products/P1/inventory/update')!;
 expect(JSON.parse(update.body)).toEqual({skus:[{id:'S1',inventory:[{quantity:8,warehouse_id:'W'}]}]}); // 10 - 2 held by open order
 expect(update.url.searchParams.get('shop_cipher')).toBe('CIPH');expect(update.url.searchParams.get('sign')).toMatch(/^[0-9a-f]{64}$/);
 calls.length=0;
 expect(await syncTiktokStock(f)).toEqual({updated:0,unchanged:1,unmatched:1}); // schedule: nothing changed
 expect(calls.some(c=>c.url.pathname.endsWith('/inventory/update'))).toBe(false);
 await expect(syncTiktokNow(admin,(async()=>new Response(JSON.stringify({code:105002,message:'bad sign'}))) as typeof fetch)).rejects.toThrow(/105002/);
 expect(tiktokStatus(admin).last).toMatchObject({ok:false});
});

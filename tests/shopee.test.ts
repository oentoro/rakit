import { createHmac } from 'node:crypto';
import { afterEach,expect,test,vi } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder } from '../src/lib/orders';
import { connectShopee,pullShopeeStock,saveShopeeConfig,shopeeAuthorizeUrl,shopeeStatus,syncShopeeNow,syncShopeeStock } from '../src/lib/shopee';
import { findProductBySku } from '../src/lib/catalog';
import { listStocktakes } from '../src/lib/stocktake';
afterEach(()=>vi.unstubAllEnvs());
test('connect checks state; sync signs shop calls and pushes changed stock per item/model',async()=>{
 const {admin,staff}=fixture();
 const a=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'A',quantity:10,active:true});
 saveProduct(admin,null,{sku:'B',name:'B',rack:1,shelf:'A',quantity:4,active:true});
 saveProduct(admin,null,{sku:'R',name:'Hanya di Rakit',rack:1,shelf:'A',quantity:3,active:true});
 createOrder(admin,{orderNumber:'O1',airwayBill:'JX1',receiptPages:[],items:[{productId:a,qty:2}]});
 expect(()=>saveShopeeConfig(staff,{partnerId:'1'})).toThrow();expect(()=>saveShopeeConfig(admin,{partnerId:'abc'})).toThrow();
 saveShopeeConfig(admin,{partnerId:'1001',partnerKey:'pkey'});
 vi.stubEnv('APP_ORIGIN','');expect(()=>shopeeAuthorizeUrl(admin)).toThrow(/APP_ORIGIN/);vi.stubEnv('APP_ORIGIN','https://rakit.test');
 expect(JSON.stringify(shopeeStatus(admin))).not.toContain('pkey');
 const auth=new URL(shopeeAuthorizeUrl(admin));const state=new URL(auth.searchParams.get('redirect')!).searchParams.get('state')!;
 expect(auth.searchParams.get('sign')).toBe(createHmac('sha256','pkey').update(`1001/api/v2/shop/auth_partner${auth.searchParams.get('timestamp')}`).digest('hex'));
 const calls:{url:URL;body:string}[]=[];
 const f=(async(input:string,init?:RequestInit)=>{const url=new URL(input),p=url.pathname;calls.push({url,body:String(init?.body??'')});
  const body=p.endsWith('/token/get')?{access_token:'tok',refresh_token:'ref',expire_in:14400}
   :p.endsWith('/get_shop_info')?{shop_name:'Toko'}
   :p.endsWith('/get_item_list')?{response:{item:[{item_id:1},{item_id:2}],has_next_page:false}}
   :p.endsWith('/get_item_base_info')?{response:{item_list:[{item_id:1,item_sku:'B',has_model:false,stock_info_v2:{seller_stock:[{stock:6}]}},{item_id:2,has_model:true}]}}
   :p.endsWith('/get_model_list')?{response:{model:[{model_id:21,model_sku:'A',stock_info_v2:{seller_stock:[{location_id:'IDZ',stock:5}]}},{model_id:22,model_sku:'SHOPEE-ONLY'}]}}
   :{response:{failure_list:[]}};
  return new Response(JSON.stringify({error:'',message:'',...body}));}) as typeof fetch;
 await connectShopee(admin,'code','1234','forged',f).catch(()=>{});expect(shopeeStatus(admin).connected).toBe(false);
 shopeeAuthorizeUrl(admin);const state2=new URL(new URL(shopeeAuthorizeUrl(admin)).searchParams.get('redirect')!).searchParams.get('state')!;
 expect(state2).not.toBe(state);
 await connectShopee(admin,'code','1234',state2,f);expect(shopeeStatus(admin)).toMatchObject({connected:true,shopName:'Toko'});
 const shopInfo=calls.find(c=>c.url.pathname.endsWith('/get_shop_info'))!.url.searchParams;
 expect(shopInfo.get('sign')).toBe(createHmac('sha256','pkey').update(`1001/api/v2/shop/get_shop_info${shopInfo.get('timestamp')}tok1234`).digest('hex'));
 calls.length=0;
 expect(await syncShopeeNow(admin,f)).toEqual({updated:2,unchanged:0,unmatched:1});
 const updates=calls.filter(c=>c.url.pathname==='/api/v2/product/update_stock').map(c=>JSON.parse(c.body));
 expect(updates).toEqual([{item_id:1,stock_list:[{model_id:0,seller_stock:[{stock:4}]}]},{item_id:2,stock_list:[{model_id:21,seller_stock:[{stock:8}]}]}]); // A: 10 - 2 held
 calls.length=0;expect(await syncShopeeStock(f)).toEqual({updated:0,unchanged:2,unmatched:1}); // schedule: nothing changed
 expect(calls.some(c=>c.url.pathname.endsWith('/update_stock'))).toBe(false);
 expect(await syncShopeeNow(admin,f)).toEqual({updated:2,unchanged:0,unmatched:1}); // manual button: push everything
 // Shopee -> Rakit: A gets Shopee 5 + 2 held by O1 = 7, B gets 6; both recorded as stocktakes.
 expect(await pullShopeeStock(admin,f)).toEqual({updated:2,unchanged:0,skipped:0});
 expect(findProductBySku(admin,'A')!.totalQuantity).toBe(7);expect(findProductBySku(admin,'B')!.totalQuantity).toBe(6);
 expect(listStocktakes(admin).filter(t=>t.note==='Sinkron dari Shopee').map(t=>t.sku).sort()).toEqual(['A','B']);
 calls.length=0;expect(await syncShopeeStock(f)).toMatchObject({updated:0}); // no ping-pong back to Shopee
 await expect(pullShopeeStock(staff,f)).rejects.toThrow();
 await expect(syncShopeeNow(admin,(async()=>new Response(JSON.stringify({error:'error_auth',message:'Invalid access_token'}))) as typeof fetch)).rejects.toThrow(/error_auth/);
 expect(shopeeStatus(admin).last).toMatchObject({ok:false});
});

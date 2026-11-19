import { createHmac } from 'node:crypto';
import { afterEach,expect,test,vi } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { getOrder,listOrders,orderIdByNumber } from '../src/lib/orders';
import { connectShopee,importShopeeOrders,pollShopeeOrders,readShopeePush,saveShopeeConfig,shopeeAuthorizeUrl } from '../src/lib/shopee';
afterEach(()=>vi.unstubAllEnvs());
test('push is signed; orders import with tracking number, unknown SKUs are skipped, cancellations remove waiting orders',async()=>{
 const {admin}=fixture();vi.stubEnv('APP_ORIGIN','https://rakit.test');
 saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'A',quantity:10,active:true});
 saveShopeeConfig(admin,{partnerId:'1001',partnerKey:'pkey',pushKey:'push'});
 const orders:Record<string,object>={
  S1:{order_sn:'S1',order_status:'PROCESSED',item_list:[{model_sku:'A',model_quantity_purchased:2}]},
  S2:{order_sn:'S2',order_status:'READY_TO_SHIP',item_list:[{item_sku:'NOPE',model_quantity_purchased:1}]}};
 const f=(async(input:string)=>{const url=new URL(input),p=url.pathname;
  const body=p.endsWith('/token/get')?{access_token:'tok',refresh_token:'ref',expire_in:14400}
   :p.endsWith('/get_shop_info')?{shop_name:'Toko'}
   :p.endsWith('/get_order_list')?{response:{order_list:Object.keys(orders).map(order_sn=>({order_sn})),more:false}}
   :p.endsWith('/get_order_detail')?{response:{order_list:url.searchParams.get('order_sn_list')!.split(',').map(sn=>orders[sn]).filter(Boolean)}}
   :p.endsWith('/get_tracking_number')?{response:{tracking_number:'SPX123'}}:{};
  return new Response(JSON.stringify({error:'',message:'',...body}));}) as typeof fetch;
 const state=new URL(new URL(shopeeAuthorizeUrl(admin)).searchParams.get('redirect')!).searchParams.get('state')!;
 await connectShopee(admin,'code','1234',state,f);
 const body=JSON.stringify({code:3,shop_id:1234,data:{ordersn:'S1',status:'PROCESSED'}});
 expect(()=>readShopeePush(body,'bad')).toThrow();
 expect(readShopeePush(body,createHmac('sha256','push').update(`https://rakit.test/api/shopee/push|${body}`).digest('hex'))).toBe('S1');
 await pollShopeeOrders(f);await importShopeeOrders(['S1'],f); // poll + duplicate push
 expect(listOrders(admin).map(o=>o.orderNumber)).toEqual(['S1']); // S2 has an unknown SKU
 expect(getOrder(admin,orderIdByNumber('S1')!)).toMatchObject({airwayBill:'SPX123',items:[{sku:'A',qty:2}]});
 orders.S1={order_sn:'S1',order_status:'CANCELLED'};await importShopeeOrders(['S1'],f);
 expect(orderIdByNumber('S1')).toBeNull();
});

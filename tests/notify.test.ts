import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder,getOrder } from '../src/lib/orders';
import { notifyInstantReady,notifyNewOrder,saveNotifyTarget,sendTestNotification } from '../src/lib/notify';
test('new order notification goes to the saved target, flags instant orders, and never throws',async()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'001A',name:'Jaket',rack:1,shelf:'B',quantity:5,active:true});
 const order=getOrder(admin,createOrder(admin,{orderNumber:'O1',airwayBill:'96XF',receiptPages:[],items:[{productId,qty:2}]}));
 const sent:string[][]=[];const send=async(target:string,message:string)=>{sent.push([target,message]);};
 await notifyNewOrder(order,send);expect(sent).toEqual([]); // disabled until a target is saved
 await expect(sendTestNotification(admin,send)).rejects.toThrow(/Simpan target/);
 expect(()=>saveNotifyTarget(staff,{target:'1@g.us'})).toThrow();expect(()=>saveNotifyTarget(admin,{target:'telegram:123'})).toThrow();
 expect(()=>saveNotifyTarget(admin,{target:'whatsapp:1@g.us; rm -rf /'})).toThrow();
 expect(saveNotifyTarget(admin,{target:'whatsapp:120363@g.us'})).toEqual({target:'120363@g.us'});
 await notifyNewOrder(order,send);
 expect(sent[0][0]).toBe('120363@g.us');expect(sent[0][1]).toMatch(/INSTANT[\s\S]*O1[\s\S]*Resi: 96XF[\s\S]*2× 001A — Jaket/);
 await notifyInstantReady(order,send);expect(sent[1][1]).toMatch(/SIAP DIANTAR: O1\nKode pengambilan: 96XF/);
 await notifyInstantReady({...order,airwayBill:'JX0001'},send);expect(sent).toHaveLength(2); // regular orders: no message
 await expect(notifyInstantReady(order,async()=>{throw new Error('down');})).resolves.toBeUndefined();
 await expect(notifyNewOrder(order,async()=>{throw new Error('down');})).resolves.toBeUndefined();
 await expect(sendTestNotification(admin,async()=>{throw new Error('down');})).rejects.toThrow(/gagal dikirim/);
 saveNotifyTarget(admin,{target:''});await notifyNewOrder(order,send);expect(sent).toHaveLength(2);
});

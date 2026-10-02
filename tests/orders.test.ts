import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder,getOrder,updateOrder } from '../src/lib/orders';
import { getDatabase } from '../src/lib/db';
test('manual orders validate, merge SKU rows and reject staff and duplicates',()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'001A',name:'A',rack:1,shelf:'B',active:true});
 const input={orderNumber:'ORD-1',receiptPages:[],items:[{productId,qty:1},{productId,qty:1}]};
 const id=createOrder(admin,input);expect(getOrder(staff,id).items).toHaveLength(1);expect(getOrder(staff,id).items[0].qty).toBe(2);
 expect(()=>createOrder(admin,input)).toThrow();expect(()=>createOrder(staff,{...input,orderNumber:'STAFF'})).toThrow();
 for(const qty of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) expect(()=>createOrder(admin,{...input,orderNumber:'BAD',items:[{productId,qty}]})).toThrow();
});
test('relocation changes instructions without erasing progress; started order items are immutable',()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'B',active:true});
 const input={orderNumber:'ORD-2',receiptPages:[],items:[{productId,qty:2}]};const id=createOrder(admin,input);
 getDatabase().prepare("UPDATE orders SET status='picking',assignee_id=? WHERE id=?").run(staff.id,id);
 getDatabase().prepare('UPDATE order_items SET picked_qty=1 WHERE order_id=?').run(id);
 saveProduct(admin,productId,{sku:'A',name:'A',rack:4,shelf:'F',active:true});
 expect(getOrder(staff,id).items[0]).toMatchObject({rack:4,shelf:'F',pickedQty:1});
 expect(()=>updateOrder(admin,id,{...input,items:[{productId,qty:3}]})).toThrow();
 updateOrder(admin,id,{...input,airwayBill:'000123'});expect(getOrder(staff,id).items[0].pickedQty).toBe(1);
});
test('admin can add receipt data to a started order after its SKU is deactivated',()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'B',active:true});
 const input={orderNumber:'INACTIVE',receiptPages:[],items:[{productId,qty:2}]};const id=createOrder(admin,input);
 getDatabase().prepare("UPDATE orders SET status='packing',assignee_id=? WHERE id=?").run(staff.id,id);getDatabase().prepare('UPDATE order_items SET picked_qty=qty WHERE order_id=?').run(id);
 saveProduct(admin,productId,{sku:'A',name:'A',rack:1,shelf:'B',active:false});
 expect(()=>updateOrder(admin,id,{...input,airwayBill:'0001'})).not.toThrow();expect(getOrder(admin,id)).toMatchObject({status:'packing',airwayBill:'0001'});
 expect(()=>createOrder(admin,{...input,orderNumber:'NEW'})).toThrow();
});

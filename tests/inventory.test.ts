import { test,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { fixture } from './helpers';
import { saveProduct,listProducts } from '../src/lib/catalog';
import { createOrder,getOrder,updateOrder } from '../src/lib/orders';
import { claimOrder,scanOrder } from '../src/lib/picking';
import { storeUpload } from '../src/lib/files';
import { saveRack } from '../src/lib/racks';
import { getDatabase } from '../src/lib/db';
const code=(kind:'sku'|'airwayBill',value:string,locationId?:string)=>({kind,code:value,locationId,requestId:randomUUID()});
async function setup(){
 const ctx=fixture();const productId=saveProduct(ctx.admin,null,{sku:'MULTI',name:'Produk multi',active:true,locations:[{rack:1,shelf:'B',quantity:2},{rack:3,shelf:'D',quantity:4}]} as never);
 const product=()=>listProducts(ctx.admin).find(p=>p.id===productId)!;
 const pdf=await PDFDocument.create();pdf.addPage();const file=await storeUpload(ctx.admin,new File([new Uint8Array(await pdf.save())],'resi.pdf',{type:'application/pdf'}),'pdf');
 const order=(number:string,qty=2)=>createOrder(ctx.admin,{orderNumber:number,airwayBill:`AWB-${number}`,pdfFileId:file.id,receiptPages:[1],items:[{productId,qty}]});
 return {...ctx,productId,product,order};
}
test('one SKU has quantities per location and packing deducts only picked locations exactly once',async()=>{
 const {admin,staff,product,order}=await setup();const initial=product();expect(initial.locations.map(l=>l.quantity)).toEqual([2,4]);expect(initial.totalQuantity).toBe(6);
 const id=order('PACK');claimOrder(staff,id);const [a,b]=initial.locations;
 const first=code('sku','MULTI',a.id);scanOrder(staff,id,first);expect(scanOrder(staff,id,first).replayed).toBe(true);
 scanOrder(staff,id,code('sku','MULTI',b.id));expect(getOrder(admin,id).status).toBe('packing');expect(product().locations.map(l=>l.quantity)).toEqual([2,4]);expect(product().locations.map(l=>l.reservedQuantity)).toEqual([1,1]);
 const completion=code('airwayBill','AWB-PACK');scanOrder(staff,id,completion);expect(product().locations.map(l=>l.quantity)).toEqual([1,3]);expect(product().totalQuantity).toBe(4);expect(product().locations.every(l=>l.reservedQuantity===0)).toBe(true);
 scanOrder(staff,id,completion);scanOrder(staff,id,code('airwayBill','AWB-PACK'));expect(product().totalQuantity).toBe(4);
});
test('location is required for split SKU; wrong, empty and unknown locations do not count',async()=>{
 const {admin,staff,productId,product,order}=await setup();const id=order('LOC');claimOrder(staff,id);
 for(const locationId of [undefined,randomUUID()])expect(()=>scanOrder(staff,id,code('sku','MULTI',locationId))).toThrow();
 const p=product();saveProduct(admin,productId,{sku:p.sku,name:p.name,active:true,locations:p.locations.map((l,i)=>({...l,quantity:i===0?0:null}))});
 for(const l of p.locations)expect(()=>scanOrder(staff,id,code('sku','MULTI',l.id))).toThrow();expect(getOrder(staff,id).items[0].pickedQty).toBe(0);
});
test('reserved stock cannot be consumed by another order or reduced, relocated or deleted by admin',async()=>{
 const {admin,staff,productId,product,order}=await setup();const id=order('FIRST'),other=order('OTHER');claimOrder(staff,id);claimOrder(staff,other);const a=product().locations[0];
 scanOrder(staff,id,code('sku','MULTI',a.id));scanOrder(staff,id,code('sku','MULTI',a.id));expect(()=>scanOrder(staff,other,code('sku','MULTI',a.id))).toThrow();
 const p=product(),base={sku:p.sku,name:p.name,active:true};
 for(const locations of [p.locations.filter(l=>l.id!==a.id),p.locations.map(l=>l.id===a.id?{...l,quantity:1}:l),p.locations.map(l=>l.id===a.id?{...l,rack:2}:l)])expect(()=>saveProduct(admin,productId,{...base,locations})).toThrow();
 expect(product().totalQuantity).toBe(6);scanOrder(staff,id,code('airwayBill','AWB-FIRST'));expect(product().locations[0].quantity).toBe(0);
});
test('invalid and duplicate locations are rejected; secondary locations also block rack shrink',async()=>{
 const {admin,staff,productId,product}=await setup();const p=product(),base={sku:p.sku,name:p.name,active:true};
 for(const locations of [[],[{rack:1,shelf:'B',quantity:-1}],[{rack:1,shelf:'B',quantity:1.5}],[{rack:99,shelf:'A',quantity:1}],[{rack:1,shelf:'B',quantity:1},{rack:1,shelf:'B',quantity:2}]])expect(()=>saveProduct(admin,productId,{...base,locations})).toThrow();
 expect(()=>saveProduct(staff,productId,{...base,locations:p.locations})).toThrow();expect(()=>saveRack(admin,3,{name:'Short',shelfCount:3})).toThrow();expect(product().locations).toHaveLength(2);
});
test('packing fails atomically without receipt or if inventory consistency was damaged',async()=>{
 const {admin,staff,product,order}=await setup();const id=order('ATOMIC');claimOrder(staff,id);for(const l of product().locations)scanOrder(staff,id,code('sku','MULTI',l.id));
 const current=getOrder(admin,id);updateOrder(admin,id,{orderNumber:current.orderNumber,airwayBill:current.airwayBill!,receiptPages:[],items:current.items.map(i=>({productId:i.productId,qty:i.qty}))});
 expect(()=>scanOrder(staff,id,code('airwayBill','AWB-ATOMIC'))).toThrow();expect(product().totalQuantity).toBe(6);expect(getOrder(admin,id).status).toBe('packing');
 expect(getDatabase().prepare('SELECT COUNT(*) n FROM order_location_picks WHERE order_id=?').get(id)).toMatchObject({n:2});
});

test('stale admin form cannot restore stock deducted by another staff packing',async()=>{
 const {admin,staff,productId,product,order}=await setup();const before=product(),id=order('STALE');claimOrder(staff,id);for(const l of before.locations)scanOrder(staff,id,code('sku','MULTI',l.id));scanOrder(staff,id,code('airwayBill','AWB-STALE'));
 expect(()=>saveProduct(admin,productId,{sku:before.sku,name:'Changed name',active:true,locations:before.locations.map(l=>({...l,expectedQuantity:l.quantity}))} as never)).toThrow(/berubah/);expect(product().totalQuantity).toBe(4);expect(product().name).toBe(before.name);
});
test('stock deduction rolls back every location and reservation when one location has insufficient stock',async()=>{
 const {admin,staff,product,order}=await setup();const id=order('ROLLBACK'),locations=product().locations;claimOrder(staff,id);for(const l of locations)scanOrder(staff,id,code('sku','MULTI',l.id));
 getDatabase().prepare('UPDATE product_locations SET quantity=0 WHERE id=?').run(locations[1].id);
 expect(()=>scanOrder(staff,id,code('airwayBill','AWB-ROLLBACK'))).toThrow();expect(product().locations.map(l=>l.quantity)).toEqual([2,0]);expect(product().locations.map(l=>l.reservedQuantity)).toEqual([1,1]);expect(getOrder(admin,id).status).toBe('packing');
 expect(getDatabase().prepare("SELECT COUNT(*) n FROM activities WHERE order_id=? AND action LIKE 'Stok dikurangi%'").get(id)).toMatchObject({n:0});
});

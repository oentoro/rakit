import { expect,test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder,getOrder,updateOrder } from '../src/lib/orders';
import { storeUpload } from '../src/lib/files';
import { claimOrder,scanOrder,reassignOrder } from '../src/lib/picking';
import { createStaff,setStaffActive } from '../src/lib/auth';
import { getDatabase } from '../src/lib/db';
async function setup(){
 const ctx=fixture();const productId=saveProduct(ctx.admin,null,{sku:'001A',name:'A',rack:1,shelf:'B',quantity:10,active:true});
 const pdf=await PDFDocument.create();pdf.addPage();const file=await storeUpload(ctx.admin,new File([new Uint8Array(await pdf.save())],'r.pdf',{type:'application/pdf'}),'pdf');
 const input={orderNumber:'O',airwayBill:'0001',pdfFileId:file.id,receiptPages:[1],items:[{productId,qty:2}]};return {...ctx,id:createOrder(ctx.admin,input),input};
}
const scan=(code:string,kind:'sku'|'airwayBill'='sku',requestId=randomUUID())=>({kind,code,requestId});
test('two SKU scans complete picking; wrong SKU and excessive qty do not mutate',async()=>{
 const {admin,staff,id}=await setup();claimOrder(staff,id);
 expect(()=>scanOrder(staff,id,scan('wrong'))).toThrow();expect(()=>scanOrder(staff,id,scan('0001','airwayBill'))).toThrow();
 expect(scanOrder(staff,id,scan('001A')).order).toMatchObject({status:'picking'});
 expect(scanOrder(staff,id,scan('001A')).order).toMatchObject({status:'packing'});
 expect(()=>scanOrder(staff,id,scan('001A'))).toThrow();expect(getOrder(admin,id).items[0].pickedQty).toBe(2);
 expect(()=>scanOrder(staff,id,scan('wrong','airwayBill'))).toThrow();
 expect(scanOrder(staff,id,scan('0001','airwayBill')).order).toMatchObject({status:'completed'});
 expect(scanOrder(staff,id,scan('0001','airwayBill')).replayed).toBe(true);
 expect(getDatabase().prepare("SELECT COUNT(*) n FROM activities WHERE order_id=? AND action='Packing selesai'").get(id)).toMatchObject({n:1});
});
test('network retries are idempotent and payload reuse is rejected',async()=>{
 const {staff,id}=await setup();claimOrder(staff,id);const request=scan('001A');scanOrder(staff,id,request);
 expect(scanOrder(staff,id,request).replayed).toBe(true);expect(getOrder(staff,id).items[0].pickedQty).toBe(1);
 expect(()=>scanOrder(staff,id,{...request,code:'B'})).toThrow();
 const failed=scan('B');expect(()=>scanOrder(staff,id,failed)).toThrow();expect(getDatabase().prepare('SELECT request_id FROM scan_requests WHERE request_id=?').get(failed.requestId)).toBeUndefined();
});
test('assignment and inactive accounts are checked on every scan; receipt required before completion',async()=>{
 const {admin,staff,id,input}=await setup();const other=createStaff(admin,{name:'Other',username:'other',password:'password123'});claimOrder(staff,id);
 expect(()=>claimOrder(other,id)).toThrow();expect(()=>scanOrder(other,id,scan('001A'))).toThrow();
 reassignOrder(admin,id,other.id);expect(()=>scanOrder(staff,id,scan('001A'))).toThrow();
 scanOrder(other,id,scan('001A'));scanOrder(other,id,scan('001A'));
 updateOrder(admin,id,{...input,pdfFileId:undefined,receiptPages:[]});expect(()=>scanOrder(other,id,scan('0001','airwayBill'))).toThrow();
 updateOrder(admin,id,input);setStaffActive(admin,other.id,false);expect(()=>scanOrder(other,id,scan('0001','airwayBill'))).toThrow();
 expect(getOrder(admin,id).status).toBe('packing');
});

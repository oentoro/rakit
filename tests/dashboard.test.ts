import { expect,test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { createOrder } from '../src/lib/orders';
import { storeUpload } from '../src/lib/files';
import { claimOrder,scanOrder } from '../src/lib/picking';
import { adminDashboard } from '../src/lib/dashboard';
test('admin dashboard counts today, instant backlog, staff completions, stock gaps and 7-day trend',async()=>{
 const {admin,staff}=fixture();
 const a=saveProduct(admin,null,{sku:'A',name:'Ada',rack:1,shelf:'A',quantity:5,active:true});
 saveProduct(admin,null,{sku:'E',name:'Habis',rack:1,shelf:'A',quantity:0,active:true});
 saveProduct(admin,null,{sku:'U',name:'Belum',rack:1,shelf:'A',quantity:null,active:true});
 const pdf=await PDFDocument.create();pdf.addPage();const file=await storeUpload(admin,new File([new Uint8Array(await pdf.save())],'r.pdf',{type:'application/pdf'}),'pdf');
 const order=(n:string,awb:string)=>createOrder(admin,{orderNumber:n,airwayBill:awb,pdfFileId:file.id,receiptPages:[1],items:[{productId:a,qty:1}]});
 const done=order('O1','SPX0001');order('O2','96XF');order('O3','SPX0003');
 claimOrder(staff,done);scanOrder(staff,done,{kind:'sku',code:'A',requestId:randomUUID()});scanOrder(staff,done,{kind:'airwayBill',code:'SPX0001',requestId:randomUUID()});
 const d=adminDashboard(admin);
 expect(d.today).toEqual({created:3,completed:1,open:2,instantOpen:1});
 expect(d.staff.find(s=>s.id===staff.id)).toMatchObject({completedToday:1,inProgress:0});
 expect(d.stock.empty.map(p=>p.sku)).toEqual(['E']);expect(d.stock.uncounted.map(p=>p.sku)).toEqual(['U']);
 expect(d.stock.most).toEqual([{sku:'A',name:'Ada',quantity:4}]); // 5 minus the packed unit; empty and uncounted SKUs excluded
 expect(d.trend).toHaveLength(7);expect(d.trend.at(-1)!.completed).toBe(1);expect(d.trend.reduce((n,t)=>n+t.completed,0)).toBe(1);
 expect(()=>adminDashboard(staff)).toThrow();
});

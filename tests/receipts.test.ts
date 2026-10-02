import { expect,test } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { storeUpload } from '../src/lib/files';
import { createOrder,buildReceipt } from '../src/lib/orders';
test('receipt includes selected first and last pages and rejects invalid pages',async()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'A',active:true});
 const pdf=await PDFDocument.create();pdf.addPage([100,200]);pdf.addPage([200,200]);pdf.addPage([300,200]);
 const {id:pdfFileId}=await storeUpload(admin,new File([new Uint8Array(await pdf.save())],'pdf.pdf',{type:'application/pdf'}),'pdf');
 const input={orderNumber:'PDF-1',pdfFileId,airwayBill:'0001',receiptPages:[1,3],items:[{productId,qty:1}]};
 const id=createOrder(admin,input);const receipt=await PDFDocument.load(await buildReceipt(staff,id));
 expect(receipt.getPages().map(p=>p.getWidth())).toEqual([100,300]);
 for(const pages of [[0],[4],[1,1],[]]) expect(()=>createOrder(admin,{...input,orderNumber:'BAD',airwayBill:'0002',receiptPages:pages})).toThrow();
 await expect(storeUpload(admin,new File(['%PDF-broken'],'bad.pdf',{type:'application/pdf'}),'pdf')).rejects.toThrow();
});

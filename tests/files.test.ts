import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { storeUpload,readAuthorizedFile } from '../src/lib/files';
import { PDFDocument } from 'pdf-lib';
test('uploads validate content and permissions; valid PDF preserves page count',async()=>{
 const {admin,staff}=fixture();const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();
 const result=await storeUpload(admin,new File([new Uint8Array(await pdf.save())],'resi.pdf',{type:'application/pdf'}),'pdf');
 expect(result.pageCount).toBe(2);expect(readAuthorizedFile(admin,result.id).mimeType).toBe('application/pdf');
 expect(()=>readAuthorizedFile(staff,result.id)).toThrow();
 expect(()=>readAuthorizedFile(admin,'../../secret')).toThrow();
 await expect(storeUpload(admin,new File(['<svg/>'],'fake.png',{type:'image/png'}),'photo')).rejects.toThrow();
 await expect(storeUpload(staff,new File(['no'],'x.pdf',{type:'application/pdf'}),'pdf')).rejects.toThrow();
 await expect(storeUpload(admin,new File([new Uint8Array(5*1024*1024+1)],'big.png',{type:'image/png'}),'photo')).rejects.toThrow();
});

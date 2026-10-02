import { getDatabase } from '../src/lib/db';
import { createUser } from '../src/lib/auth';
import { saveProduct } from '../src/lib/catalog';
import { createOrder } from '../src/lib/orders';
import { storeUpload } from '../src/lib/files';
import { PDFDocument,StandardFonts } from 'pdf-lib';
import type { Actor } from '../src/lib/types';
const password=process.env.DEMO_PASSWORD;if(!password)throw new Error('Isi DEMO_PASSWORD (minimal 10 karakter) untuk membuat akun contoh.');
const db=getDatabase();
function user(username:string,name:string,role:'admin'|'staff'):Actor {const existing=db.prepare('SELECT id,name,role FROM users WHERE username=?').get(username) as Actor|undefined;return existing||createUser({username,name,role,password:password!});}
const admin=user('admin.demo','Admin Demo','admin');user('staff.demo','Staff Demo','staff');
if(!db.prepare("SELECT id FROM products WHERE sku='SKU-A'").get())saveProduct(admin,null,{sku:'SKU-A',name:'Tumbler stainless 500 ml',rack:1,shelf:'B',quantity:100,active:true});
if(!db.prepare("SELECT id FROM products WHERE sku='SKU-B'").get())saveProduct(admin,null,{sku:'SKU-B',name:'Notebook A5',rack:3,shelf:'D',quantity:100,active:true});
if(!db.prepare("SELECT id FROM orders WHERE order_number='DEMO-001'").get()) {
 const pdf=await PDFDocument.create();const page=pdf.addPage([288,432]);const font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('CONTOH RESI INTERNAL',{x:24,y:390,size:15,font});page.drawText('DEMO-001 / AWB-DEMO-001',{x:24,y:350,size:13,font});page.drawText('SKU-A | Qty: 2',{x:24,y:300,size:13,font});page.drawText('Bukan resi kurir yang dapat digunakan.',{x:24,y:260,size:10,font});
 const file=await storeUpload(admin,new File([new Uint8Array(await pdf.save())],'contoh-resi.pdf',{type:'application/pdf'}),'pdf');
 const product=db.prepare("SELECT id FROM products WHERE sku='SKU-A'").get()!;
 createOrder(admin,{orderNumber:'DEMO-001',airwayBill:'AWB-DEMO-001',pdfFileId:file.id,receiptPages:[1],items:[{productId:product.id as string,qty:2}]});
}
console.log('Data contoh tersedia. Akun: admin.demo dan staff.demo. Password sesuai DEMO_PASSWORD.');

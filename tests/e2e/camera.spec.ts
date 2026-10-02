import { test,expect } from '@playwright/test';
import { QRCodeWriter,BarcodeFormat } from '@zxing/library';
import { execFileSync } from 'node:child_process';
test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('actual camera decoder reads QR from a simulated video stream and pauses after one unit',async({page})=>{
 const bitmap=new QRCodeWriter().encode('SKU-B',BarcodeFormat.QR_CODE,360,360,new Map());
 const pixels=Array.from({length:360},(_,y)=>Array.from({length:360},(_,x)=>bitmap.get(x,y)));
 await page.addInitScript((pixels)=>{
  navigator.mediaDevices.getUserMedia=async()=>{
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;const ctx=canvas.getContext('2d')!;
    function draw(){ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.fillStyle='black';for(let y=0;y<360;y++)for(let x=0;x<360;x++)if(pixels[y][x])ctx.fillRect(60+x,60+y,1,1);}
    draw();const stream=canvas.captureStream(10);const interval=setInterval(()=>{if(stream.getVideoTracks()[0].readyState==='ended')clearInterval(interval);else draw();},100);return stream;
  };
 },pixels);
 await page.goto('/login');await page.getByLabel('Username').fill('admin.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 const products=await (await page.request.get('/api/products')).json();const orders=await (await page.request.get('/api/orders')).json();const product=products.find((p:{sku:string})=>p.sku==='SKU-B');const source=orders.find((o:{orderNumber:string})=>o.orderNumber==='DEMO-001');
 const created=await page.request.post('/api/orders',{headers:{origin:'http://127.0.0.1:3010'},data:{orderNumber:'CAMERA-001',airwayBill:'CAMERA-AWB',pdfFileId:source.pdfFileId,receiptPages:[1],items:[{productId:product.id,qty:2}]}});expect(created.ok()).toBeTruthy();const {id}=await created.json();
 await page.request.post('/api/auth/logout',{headers:{origin:'http://127.0.0.1:3010'}});await page.goto('/login');await page.getByLabel('Username').fill('staff.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.goto(`/orders/${id}`);await page.getByRole('button',{name:'Mulai picking'}).click();await page.screenshot({path:'/tmp/picking-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Aktifkan kamera'}).click();await expect(page.getByRole('status')).toContainText('+1 unit');
 expect((await (await page.request.get(`/api/orders/${id}`)).json()).order.items[0].pickedQty).toBe(1);
 await page.getByRole('button',{name:'Scan unit berikutnya'}).click();await expect(page.getByRole('heading',{name:'Packing & resi'})).toBeVisible();
 expect((await (await page.request.get(`/api/orders/${id}`)).json()).order.items[0].pickedQty).toBe(2);
});

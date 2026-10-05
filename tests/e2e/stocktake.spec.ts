import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { QRCodeWriter,BarcodeFormat } from '@zxing/library';

test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('admin counts stock, sees differences and history; stale submissions and staff access are rejected',async({page})=>{
 const headers={origin:'http://127.0.0.1:3010'};
 await page.goto('/login');await page.getByLabel('Username').fill('admin.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();
 await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 const created=await page.request.post('/api/products',{headers,data:{sku:'OPNAME-E2E',name:'Barang hitung',active:true,locations:[{rack:1,shelf:'A',quantity:10},{rack:2,shelf:'B',quantity:5}]}});expect(created.ok()).toBeTruthy();
 await page.getByRole('link',{name:'Stok opname',exact:true}).click();
 await page.getByLabel('Cari SKU atau nama barang').fill('OPNAME-E2E');await page.getByRole('button',{name:'Cari',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Stok opname',exact:true})).toBeVisible();
 await page.getByLabel('Filter rak').selectOption('1');await page.getByRole('button',{name:'Cari',exact:true}).click();
 await expect(page.getByRole('form',{name:'Opname OPNAME-E2E Rak 2 B'})).toHaveCount(0);
 const row=page.getByRole('form',{name:'Opname OPNAME-E2E Rak 1 A'});
 await row.getByLabel('Jumlah fisik').fill('8');await expect(row).toContainText('Selisih: -2 unit');await row.getByLabel('Catatan').fill('Dua unit rusak');await row.getByRole('button',{name:'Simpan opname'}).click();
 await expect(page.getByRole('status')).toContainText('berhasil disimpan');await expect(page.getByRole('region',{name:'Riwayat opname'})).toContainText('Dua unit rusak');
 const products=await (await page.request.get('/api/products')).json();const product=products.find((p:{sku:string})=>p.sku==='OPNAME-E2E');expect(product.locations.map((l:{quantity:number})=>l.quantity)).toEqual([8,5]);
 const payload={locationId:product.locations[0].id,expectedQuantity:10,expectedRack:1,expectedShelf:'A',quantity:20,note:''};
 expect((await page.request.post('/api/stocktakes',{headers,data:payload})).status()).toBe(409);
 expect((await page.request.post('/api/stocktakes',{headers:{origin:'http://other.example'},data:payload})).status()).toBe(403);
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.getByRole('heading',{name:'Stok opname',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.request.post('/api/auth/logout',{headers});await page.goto('/login');await page.getByLabel('Username').fill('staff.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 expect((await page.request.post('/api/stocktakes',{headers,data:payload})).status()).toBe(403);expect((await page.request.get('/api/stocktakes')).status()).toBe(403);
 await page.goto('/admin/stocktakes');await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
});

test('phone camera QR finds the exact SKU outside current filters and counting requires an explicit location and save',async({page})=>{
 const sku='ZZZ-OPNAME-QR',headers={origin:'http://127.0.0.1:3010'};
 const bitmap=new QRCodeWriter().encode(sku,BarcodeFormat.QR_CODE,360,360,new Map());
 const pixels=Array.from({length:360},(_,y)=>Array.from({length:360},(_,x)=>bitmap.get(x,y)));
 await page.addInitScript(pixels=>{
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;const context=canvas.getContext('2d')!;
   function draw(){context.fillStyle='white';context.fillRect(0,0,480,480);context.fillStyle='black';for(let y=0;y<360;y++)for(let x=0;x<360;x++)if(pixels[y][x])context.fillRect(60+x,60+y,1,1);}
   draw();const stream=canvas.captureStream(10),timer=setInterval(()=>{if(stream.getVideoTracks()[0].readyState==='ended')clearInterval(timer);else draw();},100);return stream;
  };
 },pixels);
 await page.setViewportSize({width:390,height:844});await page.goto('/login');await page.getByLabel('Username').fill('admin.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 for(const code of [sku,`${sku}-OTHER`])expect((await page.request.post('/api/products',{headers,data:{sku:code,name:code===sku?'Barang QR opname':'SKU lain',active:true,locations:[{rack:1,shelf:'A',quantity:10},{rack:2,shelf:'B',quantity:5}]}})).ok()).toBeTruthy();
 await page.goto('/admin/stocktakes?search=tidak-ada&rack=4');await expect(page.getByText('Barang tidak ditemukan. Coba pencarian atau rak lainnya.')).toBeVisible();
 await page.getByRole('button',{name:'Aktifkan kamera'}).click();await expect(page.getByRole('region',{name:'Barang hasil scan'})).toContainText('Barang QR opname');
 const scanned=page.getByRole('region',{name:'Barang hasil scan'});await expect(scanned.getByRole('form')).toHaveCount(0);await expect(page.getByRole('button',{name:'Scan barang berikutnya'})).toBeVisible();
 expect((await (await page.request.get('/api/stocktakes/product?sku=ZZZ-OPNAME-QR')).json()).locations.map((l:{quantity:number})=>l.quantity)).toEqual([10,5]);
 await scanned.getByLabel(`Lokasi opname ${sku}`).selectOption({label:'Rak 2 / B'});
 const row=scanned.getByRole('form',{name:`Opname hasil scan ${sku} Rak 2 B`});await row.getByLabel('Jumlah fisik').fill('3');await expect(row).toContainText('Selisih: -2 unit');await row.getByRole('button',{name:'Simpan opname'}).click();
 await expect(page.getByRole('status').filter({hasText:'berhasil disimpan'})).toBeVisible();await expect(row).toContainText('Stok sistem: 3');
 await row.getByLabel('Jumlah fisik').fill('2');await row.getByRole('button',{name:'Simpan opname'}).click();await expect(row).toContainText('Stok sistem: 2');
 expect((await (await page.request.get(`/api/stocktakes/product?sku=${sku}`)).json()).locations.map((l:{quantity:number})=>l.quantity)).toEqual([10,2]);
 await page.getByRole('button',{name:'Tutup kamera'}).click();await page.getByLabel('Kode manual').fill('SKU-TIDAK-ADA');await page.getByRole('button',{name:'Kirim kode'}).click();await expect(page.getByRole('alert').filter({hasText:'SKU tidak ditemukan'})).toBeVisible();
 await page.getByLabel('Kode manual').fill(`${sku}-OTHER`);await page.getByRole('button',{name:'Kirim kode'}).click();await expect(scanned).toContainText('SKU lain');await expect(scanned.getByRole('form')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'/tmp/picking-stocktake-scanner-mobile.png',fullPage:true});
 await page.request.post('/api/auth/logout',{headers});await page.request.post('/api/auth/login',{headers,data:{username:'staff.demo',password:'testpassword123'}});
 expect((await page.request.get(`/api/stocktakes/product?sku=${sku}`)).status()).toBe(403);
});

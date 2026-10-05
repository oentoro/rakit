import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { QRCodeWriter,BarcodeFormat } from '@zxing/library';

test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('admin and staff can count stock; stale submissions and invalid origins are rejected',async({page})=>{
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
 await page.getByRole('link',{name:'Stok opname',exact:true}).click();await expect(page.getByRole('heading',{name:'Stok opname',exact:true})).toBeVisible();
 expect((await page.request.post('/api/stocktakes',{headers,data:payload})).status()).toBe(409);expect((await page.request.get('/api/stocktakes')).status()).toBe(200);
 await page.getByLabel('Kode manual').fill('OPNAME-E2E');await page.getByRole('button',{name:'Kirim kode'}).click();
 const scanned=page.getByRole('region',{name:'Barang hasil scan'});await expect(scanned).toContainText('Barang hitung');await scanned.getByLabel('Lokasi opname OPNAME-E2E').selectOption(product.locations[0].id);
 const staffCount=scanned.getByRole('form');await expect(staffCount.getByLabel('Jumlah fisik')).toHaveValue('1');await staffCount.getByRole('button',{name:'Simpan opname'}).click();
 await expect(page.getByRole('region',{name:'Riwayat opname'})).toContainText('Staff Demo');
 const history=await (await page.request.get('/api/stocktakes')).json();expect(history[0]).toMatchObject({actorName:'Staff Demo',quantity:1});
});

test('phone QR scans fill physical quantity, count one unit per rearm, keep location counts and save explicitly',async({page})=>{
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
 const scanned=page.getByRole('region',{name:'Barang hasil scan'});await expect(scanned.getByRole('form')).toHaveCount(0);
 const inventory=await (await page.request.get('/api/stocktakes/product?sku=ZZZ-OPNAME-QR')).json();expect(inventory.locations.map((l:{quantity:number})=>l.quantity)).toEqual([10,5]);
 await scanned.getByLabel(`Lokasi opname ${sku}`).selectOption({label:'Rak 2 / B'});
 const row=scanned.getByRole('form',{name:`Opname hasil scan ${sku} Rak 2 B`});await expect(row.getByLabel('Jumlah fisik')).toHaveValue('1');
 for(const quantity of ['2','3']){await page.getByRole('button',{name:'Scan unit berikutnya'}).click();await expect(row.getByLabel('Jumlah fisik')).toHaveValue(quantity);}
 await expect.poll(()=>page.getByLabel('Pratinjau kamera').evaluate((video:HTMLVideoElement)=>video.currentTime)).toBeGreaterThan(0.5);await expect(row.getByLabel('Jumlah fisik')).toHaveValue('3');
 await scanned.getByLabel(`Lokasi opname ${sku}`).selectOption(inventory.locations[0].id);await expect(scanned.getByLabel('Jumlah fisik')).toHaveValue('');
 await scanned.getByLabel(`Lokasi opname ${sku}`).selectOption(inventory.locations[1].id);await expect(row.getByLabel('Jumlah fisik')).toHaveValue('3');
 await page.getByRole('button',{name:'Tutup kamera'}).click();await page.getByLabel('Kode manual').fill(`${sku}-OTHER`);await page.getByRole('button',{name:'Kirim kode'}).click();await expect(page.getByRole('alert').filter({hasText:'Simpan hasil'})).toBeVisible();await expect(row.getByLabel('Jumlah fisik')).toHaveValue('3');
 await expect(row).toContainText('Selisih: -2 unit');await row.getByRole('button',{name:'Simpan opname'}).click();
 await expect(page.getByRole('status').filter({hasText:'berhasil disimpan'})).toBeVisible();await expect(row).toContainText('Stok sistem: 3');
 await page.getByLabel('Kode manual').fill(sku);await page.getByRole('button',{name:'Kirim kode'}).click();await expect(row.getByLabel('Jumlah fisik')).toHaveValue('1');
 await row.getByLabel('Jumlah fisik').fill('2');await page.getByLabel('Kode manual').fill(sku);await page.getByRole('button',{name:'Kirim kode'}).click();await expect(row.getByLabel('Jumlah fisik')).toHaveValue('3');
 await row.getByLabel('Jumlah fisik').fill('2');await row.getByRole('button',{name:'Simpan opname'}).click();await expect(row).toContainText('Stok sistem: 2');
 expect((await (await page.request.get(`/api/stocktakes/product?sku=${sku}`)).json()).locations.map((l:{quantity:number})=>l.quantity)).toEqual([10,2]);
 await page.getByLabel('Kode manual').fill('SKU-TIDAK-ADA');await page.getByRole('button',{name:'Kirim kode'}).click();await expect(page.getByRole('alert').filter({hasText:'SKU tidak ditemukan'})).toBeVisible();
 await page.getByLabel('Kode manual').fill(`${sku}-OTHER`);await page.getByRole('button',{name:'Kirim kode'}).click();await expect(scanned).toContainText('SKU lain');await expect(scanned.getByRole('form')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'/tmp/picking-stocktake-scanner-mobile.png',fullPage:true});
 await page.request.post('/api/auth/logout',{headers});await page.request.post('/api/auth/login',{headers,data:{username:'staff.demo',password:'testpassword123'}});
 expect((await page.request.get(`/api/stocktakes/product?sku=${sku}`)).status()).toBe(200);
});

import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

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

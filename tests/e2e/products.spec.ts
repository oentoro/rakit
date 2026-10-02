import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('staff searches product names and SKUs and enlarges their photos',async({page,playwright})=>{
 const admin=await playwright.request.newContext({baseURL:'http://127.0.0.1:3010',extraHTTPHeaders:{origin:'http://127.0.0.1:3010'}});
 await admin.post('/api/auth/login',{data:{username:'admin.demo',password:'testpassword123'}});
 const products=await (await admin.get('/api/products')).json(),product=products.find((p:{sku:string})=>p.sku==='SKU-A');
 const image=await (await admin.post('/api/files',{multipart:{kind:'photo',file:{name:'qc.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXwAAAABJRU5ErkJggg==','base64')}}})).json();
 expect((await admin.patch(`/api/products/${product.id}`,{data:{...product,photoFileId:image.id}})).ok()).toBeTruthy();await admin.dispose();
 await page.setViewportSize({width:390,height:844});await page.goto('/login');await page.getByLabel('Username').fill('staff.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await page.getByRole('button',{name:'Masuk ke gudang'}).click();await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 await page.getByRole('link',{name:'Daftar produk',exact:true}).click();await expect(page.getByRole('heading',{name:'Daftar produk'})).toBeVisible();
 const search=page.getByLabel('Cari SKU atau nama barang');await search.fill('  tumbLER  ');await page.getByRole('button',{name:'Cari produk',exact:true}).click();
 const row=page.getByRole('article').filter({hasText:'SKU-A'});await expect(row).toContainText('Rak 1');await expect(row).toContainText('Ambalan B');await expect(page.getByRole('article').filter({hasText:'Notebook A5'})).toHaveCount(0);
 await row.getByRole('button',{name:'Perbesar foto Tumbler stainless 500 ml'}).click();const dialog=page.getByRole('dialog',{name:'Tumbler stainless 500 ml'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('img')).toBeVisible();await dialog.getByRole('button',{name:'Tutup foto'}).click();
 await search.fill('sku-b');await page.getByRole('button',{name:'Cari produk',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(1);await expect(page.getByRole('article')).toContainText('Notebook A5');
 await search.fill('tidak-ada');await page.getByRole('button',{name:'Cari produk',exact:true}).click();await expect(page.getByText('Barang tidak ditemukan',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Reset pencarian'}).click();await expect(page.getByRole('article').filter({hasText:'SKU-A'})).toBeVisible();await page.screenshot({path:'/tmp/picking-products-mobile.png',fullPage:true});
});

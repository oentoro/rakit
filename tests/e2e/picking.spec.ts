import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('staff completes two units through mobile picking and resi; admin routes stay protected',async({page,playwright})=>{
 const admin=await playwright.request.newContext({baseURL:'http://127.0.0.1:3010',extraHTTPHeaders:{origin:'http://127.0.0.1:3010'}});
 await admin.post('/api/auth/login',{data:{username:'admin.demo',password:'testpassword123'}});
 const products=await (await admin.get('/api/products')).json();const product=products.find((p:{sku:string})=>p.sku==='SKU-A');
 const image=await (await admin.post('/api/files',{multipart:{kind:'photo',file:{name:'qc.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXwAAAABJRU5ErkJggg==','base64')}}})).json();
 expect((await admin.patch(`/api/products/${product.id}`,{data:{...product,photoFileId:image.id}})).ok()).toBeTruthy();await admin.dispose();
 page.on('pageerror',e=>console.log('Browser error:',e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/login');
 await page.getByLabel('Username').fill('staff.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')),page.getByRole('button',{name:'Masuk ke gudang'}).click()]);
 await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 await page.getByRole('link',{name:'DEMO-001',exact:true}).last().click();
 const photo=page.getByRole('button',{name:'Perbesar foto Tumbler stainless 500 ml'});await photo.click();
 const preview=page.getByRole('dialog',{name:'Tumbler stainless 500 ml'});await expect(preview).toBeVisible();await expect(preview.getByText('SKU-A',{exact:true})).toBeVisible();await expect(preview.getByRole('img')).toBeVisible();
 await preview.getByRole('button',{name:'Tutup foto'}).click();await expect(preview).not.toBeVisible();await expect(photo).toBeFocused();
 await photo.click();await page.keyboard.press('Escape');await expect(preview).not.toBeVisible();
 await photo.click();await page.mouse.click(2,2);await expect(preview).not.toBeVisible();
 await page.getByRole('button',{name:'Mulai picking'}).click();
 for(const code of ['WRONG','SKU-A','SKU-A']) {await page.getByLabel('Kode manual').fill(code);await page.getByRole('button',{name:'Kirim kode'}).click();if(code==='WRONG')await expect(page.getByRole('alert').filter({hasText:'SKU tidak sesuai'})).toContainText('SKU tidak sesuai');else await expect(page.getByRole('status')).toContainText('+1 unit');}
 await expect(page.getByRole('heading',{name:'Packing & resi'})).toBeVisible();
 await page.getByLabel('Kode manual').fill('AWB-DEMO-001');await page.getByRole('button',{name:'Kirim kode'}).click();await expect(page.getByText('Order siap dikirim',{exact:true})).toBeVisible();
 const denied=await page.request.post('/api/products',{headers:{origin:'http://127.0.0.1:3010'},data:{}});expect(denied.status()).toBe(403);
 const rackDenied=await page.request.post('/api/racks',{headers:{origin:'http://127.0.0.1:3010'},data:{name:'Forbidden',shelfCount:3}});expect(rackDenied.status()).toBe(403);
 await page.goto('/admin/products');await expect(page).toHaveURL('http://127.0.0.1:3010/');
});

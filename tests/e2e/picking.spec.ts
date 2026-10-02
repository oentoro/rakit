import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
test.beforeAll(()=>{execFileSync('node',['--import','tsx','scripts/demo.ts'],{env:{...process.env,DATABASE_PATH:process.env.E2E_DATABASE_PATH,UPLOAD_DIR:'/tmp/picking-e2e-uploads',DEMO_PASSWORD:'testpassword123'},stdio:'pipe'});});
test('staff completes two units through mobile picking and resi; admin routes stay protected',async({page})=>{
 page.on('pageerror',e=>console.log('Browser error:',e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/login');
 await page.getByLabel('Username').fill('staff.demo');await page.getByLabel('Password',{exact:true}).fill('testpassword123');await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')),page.getByRole('button',{name:'Masuk ke gudang'}).click()]);
 await expect(page.getByRole('heading',{name:'Ringkasan gudang'})).toBeVisible();
 await page.getByRole('link',{name:'DEMO-001',exact:true}).last().click();
 await page.getByRole('button',{name:'Mulai picking'}).click();
 for(const code of ['WRONG','SKU-A','SKU-A']) {await page.getByLabel('Kode manual').fill(code);await page.getByRole('button',{name:'Kirim kode'}).click();if(code==='WRONG')await expect(page.getByRole('alert').filter({hasText:'SKU tidak sesuai'})).toContainText('SKU tidak sesuai');else await expect(page.getByRole('status')).toContainText('+1 unit');}
 await expect(page.getByRole('heading',{name:'Packing & resi'})).toBeVisible();
 await page.getByLabel('Kode manual').fill('AWB-DEMO-001');await page.getByRole('button',{name:'Kirim kode'}).click();await expect(page.getByText('Order siap dikirim',{exact:true})).toBeVisible();
 const denied=await page.request.post('/api/products',{headers:{origin:'http://127.0.0.1:3010'},data:{}});expect(denied.status()).toBe(403);
 const rackDenied=await page.request.post('/api/racks',{headers:{origin:'http://127.0.0.1:3010'},data:{name:'Forbidden',shelfCount:3}});expect(rackDenied.status()).toBe(403);
 await page.goto('/admin/products');await expect(page).toHaveURL('http://127.0.0.1:3010/');
});

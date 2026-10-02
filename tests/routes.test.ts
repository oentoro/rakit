import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { authenticate } from '../src/lib/auth';
import { POST as productsPOST } from '../src/app/api/products/route';
import { POST as ordersPOST } from '../src/app/api/orders/route';
test('actual routes reject staff mutations even when payload is sent directly',async()=>{
 fixture();const token=await authenticate('staff','password123');
 for(const route of [productsPOST,ordersPOST]) {
  const response=await route(new Request('http://localhost:3000/api/orders',{method:'POST',headers:{origin:'http://localhost:3000',cookie:`session=${token}`,'Content-Type':'application/json'},body:'{}'}));
  expect(response.status).toBe(403);
 }
});

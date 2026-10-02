import { beforeEach, expect, test } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, authenticate, requireActor, setStaffActive,listStaff } from '../src/lib/auth';
import { getDatabase,openDatabase } from '../src/lib/db';
beforeEach(() => { process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'picking-auth-')), 'db.sqlite'); });
test('valid credentials create a session; invalid credentials are rejected', async () => {
  createUser({name:'Admin',username:'admin',password:'password123',role:'admin'});
  const token = await authenticate('admin', 'password123');
  expect(requireActor(new Request('http://localhost', {headers:{cookie:`session=${token}`}})).role).toBe('admin');
  await expect(authenticate('admin', 'wrong')).rejects.toMatchObject({status:401});
});
test('staff cannot use admin endpoints and inactive sessions are revoked', async () => {
  const admin = createUser({name:'Admin',username:'admin',password:'password123',role:'admin'});
  const staff = createUser({name:'Staff',username:'staff',password:'password123',role:'staff'});
  const token = await authenticate('staff', 'password123');
  const req = new Request('http://localhost', {headers:{cookie:`session=${token}`}});
  expect(() => requireActor(req,['admin'])).toThrow();
  setStaffActive(admin, staff.id, false);
  expect(() => requireActor(req)).toThrow();
});
test('expired session is rejected and database persists after reopen', async () => {
  createUser({name:'Admin',username:'admin',password:'password123',role:'admin'});
  const token = await authenticate('admin','password123');
  getDatabase().prepare('UPDATE sessions SET expires_at=0').run();
  expect(() => requireActor(new Request('http://localhost', {headers:{cookie:`session=${token}`}}))).toThrow();
  expect(getDatabase().prepare('SELECT username FROM users').get()).toMatchObject({username:'admin'});
  const reopened=openDatabase(process.env.DATABASE_PATH!);expect(reopened.prepare('SELECT username FROM users').get()).toMatchObject({username:'admin'});reopened.close();
});
test('session actors and staff records are plain objects for React server/client boundaries',async()=>{
  const admin=createUser({name:'Admin',username:'admin',password:'password123',role:'admin'});
  const token=await authenticate('admin','password123');
  expect(Object.getPrototypeOf(requireActor(new Request('http://localhost',{headers:{cookie:`session=${token}`}})))).toBe(Object.prototype);
  expect(Object.getPrototypeOf(listStaff(admin)[0])).toBe(Object.prototype);
});

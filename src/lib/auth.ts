import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import { getDatabase, inTransaction } from './db';
import { databaseError, fail } from './errors';
import type { Actor, Role } from './types';
const userSchema=z.object({name:z.string().trim().min(1).max(100),username:z.string().trim().toLowerCase().regex(/^[a-z0-9_.@-]{3,100}$/),password:z.string().min(10).max(128),role:z.enum(['admin','staff'])});
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
function hashPassword(password:string):string { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
function verifyPassword(password:string,hash:string):boolean {
  const [salt,stored]=hash.split(':'); const actual=scryptSync(password,salt,64); const expected=Buffer.from(stored,'hex'); return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export function createUser(input:{name:string;username:string;password:string;role:Role}):Actor {
  const data=userSchema.parse(input);const id=randomUUID();
  try {getDatabase().prepare('INSERT INTO users(id,name,username,password_hash,role) VALUES(?,?,?,?,?)').run(id,data.name,data.username,hashPassword(data.password),data.role);} catch(error) {databaseError(error);}
  return {id,name:data.name,role:data.role};
}
export function assertActiveActor(actor:Actor,roles?:Role[]):Actor {
  const row=getDatabase().prepare('SELECT id,name,role FROM users WHERE id=? AND active=1').get(actor.id) as Actor|undefined;
  if(!row) fail(401,'Sesi tidak aktif. Silakan login kembali.');
  if(roles && !roles.includes(row.role)) fail(403,'Anda tidak memiliki akses untuk tindakan ini.');return {...row};
}
export async function authenticate(username:string,password:string):Promise<string> {
  if(typeof username!=='string'||typeof password!=='string'||password.length>128) fail(401,'Username atau password salah.');
  const name=username.trim().toLowerCase();const db=getDatabase();const now=Date.now();
  db.prepare('DELETE FROM login_attempts WHERE attempted_at<?').run(now-900000);
  const attempts=db.prepare('SELECT COUNT(*) n FROM login_attempts WHERE username=?').get(name) as {n:number};
  if(attempts.n>=5) fail(429,'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  const user=db.prepare('SELECT * FROM users WHERE username=?').get(name) as {id:string;active:number;password_hash:string}|undefined;
  const valid=user ? verifyPassword(password,user.password_hash) : (scryptSync(password,'dummy-login-salt',64),false);
  if(!user||!valid||!user.active) {db.prepare('INSERT INTO login_attempts VALUES(?,?)').run(name,now);fail(401,'Username atau password salah.');}
  db.prepare('DELETE FROM login_attempts WHERE username=?').run(name);db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
  const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token),user.id,now+43200000);return token;
}
export function requireActor(request:Request,roles?:Role[]):Actor {
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);
  if(!token) fail(401,'Silakan login.');
  const row=getDatabase().prepare('SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(hashToken(token),Date.now()) as Actor|undefined;
  if(!row) fail(401,'Sesi berakhir. Silakan login.');return assertActiveActor(row,roles);
}
export function logout(token:string):void {getDatabase().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));}
export function createStaff(actor:Actor,input:{name:string;username:string;password:string}):Actor {assertActiveActor(actor,['admin']);return createUser({...input,role:'staff'});}
export function listStaff(actor:Actor) {assertActiveActor(actor,['admin']);return getDatabase().prepare('SELECT id,name,username,role,active FROM users ORDER BY role,name').all().map(row=>({...row}));}
export function setStaffActive(actor:Actor,id:string,active:boolean):void {
  inTransaction(()=>{assertActiveActor(actor,['admin']);const db=getDatabase();const target=db.prepare('SELECT role FROM users WHERE id=?').get(id);
    if(!target) fail(404,'Akun tidak ditemukan.');
    if(!active&&target.role==='admin'&&(db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").get() as {n:number}).n<=1) fail(409,'Admin terakhir tidak dapat dinonaktifkan.');
    db.prepare('UPDATE users SET active=? WHERE id=?').run(active?1:0,id);if(!active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  });
}
export function resetPassword(actor:Actor,id:string,password:string):void {assertActiveActor(actor,['admin']);userSchema.shape.password.parse(password);const db=getDatabase();if(!db.prepare('SELECT id FROM users WHERE id=?').get(id)) fail(404,'Akun tidak ditemukan.');db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password),id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);}

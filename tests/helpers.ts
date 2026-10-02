import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser } from '../src/lib/auth';
export function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'warehouse-'));process.env.DATABASE_PATH=join(dir,'db.sqlite');process.env.UPLOAD_DIR=join(dir,'uploads');
 const admin=createUser({name:'Admin',username:'admin',password:'password123',role:'admin'});
 const staff=createUser({name:'Staff',username:'staff',password:'password123',role:'staff'});
 return {admin,staff,dir};
}

import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { createStaff,setStaffActive,authenticate,resetPassword } from '../src/lib/auth';
test('only admin manages accounts; duplicates and last-admin removal are rejected',async()=>{
 const {admin,staff}=fixture();
 const created=createStaff(admin,{name:'Baru',username:'baru',password:'password123'});
 expect(created.role).toBe('staff');
 expect(()=>createStaff(staff,{name:'No',username:'nope',password:'password123'})).toThrow();
 expect(()=>createStaff(admin,{name:'Again',username:'baru',password:'password123'})).toThrow();
 expect(()=>setStaffActive(admin,admin.id,false)).toThrow();
 resetPassword(admin,staff.id,'newpassword123');
 await expect(authenticate('staff','password123')).rejects.toMatchObject({status:401});
 expect(await authenticate('staff','newpassword123')).toBeTruthy();
});

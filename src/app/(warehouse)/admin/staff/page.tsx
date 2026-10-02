import { pageActor } from '@/lib/server-actor';
import { listStaff } from '@/lib/auth';
import { StaffWorkspace } from '@/components/staff-workspace';
export default async function Staff(){const actor=await pageActor(['admin']);return <><div className="page-heading"><div><span className="eyebrow">AKSES & PENUGASAN</span><h1>Tim gudang</h1><p>Kelola akun yang membantu operasional gudang.</p></div></div><StaffWorkspace users={listStaff(actor) as {id:string;name:string;username:string;role:string;active:number}[]}/></>;}

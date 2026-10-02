import { pageActor } from '@/lib/server-actor';
import { listRacks } from '@/lib/racks';
import { AppShell } from '@/components/app-shell';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function Layout({children}:{children:React.ReactNode}){const actor=await pageActor(),racks=listRacks(actor);return <AppShell actor={actor} rackCount={racks.length} shelfCount={racks.reduce((sum,r)=>sum+r.shelfCount,0)}>{children}</AppShell>;}

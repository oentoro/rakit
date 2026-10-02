import { pageActor } from '@/lib/server-actor';
import { getOrder,listActivities } from '@/lib/orders';
import { listProducts } from '@/lib/catalog';
import { listStaff } from '@/lib/auth';
import { getFile } from '@/lib/files';
import { PickingWorkspace } from '@/components/picking-workspace';
export default async function Detail({params}:{params:Promise<{id:string}>}){const actor=await pageActor();const order=getOrder(actor,(await params).id);return <PickingWorkspace actor={actor} initialOrder={order} products={actor.role==='admin'?listProducts(actor):[]} pageCount={order.pdfFileId?getFile(order.pdfFileId).page_count:null} users={actor.role==='admin'?listStaff(actor).filter(u=>u.active) as {id:string;name:string}[]:[]} activities={listActivities(actor,order.id) as {action:string;sku:string|null;actorName:string;createdAt:number}[]}/>;}

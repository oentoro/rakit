import { getDatabase } from './db';
import { assertActiveActor } from './auth';
import { listProducts } from './catalog';
import { isInstant } from './utils';
import type { Actor } from './types';
const DAY=86_400_000;
// Day boundaries follow the server's local timezone (the warehouse server runs in WIB).
function startOfDay(time:number):number{const d=new Date(time);d.setHours(0,0,0,0);return d.getTime();}
export type AdminDashboard={
  today:{created:number;completed:number;open:number;instantOpen:number};
  staff:{id:string;name:string;completedToday:number;inProgress:number}[];
  stock:{empty:{sku:string;name:string}[];uncounted:{sku:string;name:string}[];most:{sku:string;name:string;quantity:number}[]};
  trend:{day:number;completed:number}[];
};
export function adminDashboard(actor:Actor,now=Date.now()):AdminDashboard{
  assertActiveActor(actor,['admin']);const db=getDatabase(),today=startOfDay(now);
  const count=(sql:string,...args:(string|number)[])=>Number(db.prepare(sql).get(...args)?.n??0);
  const open=db.prepare("SELECT airway_bill AS airwayBill FROM orders WHERE status<>'completed'").all() as {airwayBill:string|null}[];
  // Completions credited to whoever finished packing, from the activity log.
  const staff=db.prepare(`SELECT u.id,u.name,
      (SELECT COUNT(*) FROM activities a WHERE a.actor_id=u.id AND a.action='Packing selesai' AND a.created_at>=?) AS completedToday,
      (SELECT COUNT(*) FROM orders o WHERE o.assignee_id=u.id AND o.status IN ('picking','packing')) AS inProgress
    FROM users u WHERE u.active=1 ORDER BY completedToday DESC,inProgress DESC,u.name`).all(today).map(r=>({id:String(r.id),name:String(r.name),completedToday:Number(r.completedToday),inProgress:Number(r.inProgress)}));
  const products=listProducts(actor).filter(p=>p.active),pick=(p:{sku:string;name:string})=>({sku:p.sku,name:p.name});
  const trend=Array.from({length:7},(_,i)=>{const day=startOfDay(today-(6-i)*DAY+DAY/2);return {day,completed:count('SELECT COUNT(*) AS n FROM orders WHERE completed_at>=? AND completed_at<?',day,startOfDay(day+DAY+DAY/2))};});
  return {
    today:{created:count('SELECT COUNT(*) AS n FROM orders WHERE created_at>=?',today),completed:count('SELECT COUNT(*) AS n FROM orders WHERE completed_at>=?',today),open:open.length,instantOpen:open.filter(o=>isInstant(o.airwayBill)).length},
    staff,
    stock:{empty:products.filter(p=>p.totalQuantity===0).map(pick),uncounted:products.filter(p=>p.totalQuantity===null).map(pick),
      most:products.flatMap(p=>p.totalQuantity?[{...pick(p),quantity:p.totalQuantity}]:[]).sort((a,b)=>b.quantity-a.quantity).slice(0,10)},
    trend,
  };
}

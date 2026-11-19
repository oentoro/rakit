import Link from 'next/link';
import { Package,ArrowUpRight,Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { statusLabels } from '@/lib/client';
import { isInstant } from '@/lib/utils';
import type { OrderDetail } from '@/lib/types';
export function StatusBadge({status}:{status:OrderDetail['status']}){return <Badge variant="outline" className={`status-badge ${status}`}><span className="size-1.5 rounded-full bg-current"/>{statusLabels[status]}</Badge>;}
// Highlight only while it still needs pick & pack.
const priority=(o:OrderDetail)=>o.status!=='completed'&&isInstant(o.airwayBill);
// Rendered on the server, so times follow the server timezone (WIB).
const orderDate=(time:number)=>new Date(time).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const InstantBadge=()=><span className="instant-badge"><Zap className="size-3"/>Instant / sameday</span>;
export function OrderList({orders}:{orders:OrderDetail[]}){
 if(!orders.length)return <div className="empty-state"><span className="empty-icon"><Package className="size-7"/></span><h3>Belum ada order di sini</h3><p>Order yang masuk akan muncul di antrean ini.</p></div>;
 return <><div className="desktop-orders"><table className="orders-table"><thead><tr><th>ORDER / RESI</th><th>TANGGAL MASUK</th><th>BARANG</th><th>PROGRES PICKING</th><th>STAFF</th><th>STATUS</th><th></th></tr></thead><tbody>{orders.map(o=>{const qty=o.items.reduce((n,i)=>n+i.qty,0),picked=o.items.reduce((n,i)=>n+i.pickedQty,0);return <tr key={o.id} className={priority(o)?'priority-order':undefined}><td><Link className="order-number" href={`/orders/${o.id}`}>{o.orderNumber}</Link>{priority(o)&&<InstantBadge/>}<span className="cell-caption">{o.airwayBill||'Resi belum diisi'}</span></td><td className="whitespace-nowrap text-muted-foreground">{orderDate(o.createdAt)}</td><td><strong>{o.items.length} SKU</strong><span className="cell-caption">{qty} unit barang</span></td><td><div className="flex items-center gap-3"><div className="progress-track w-24"><div style={{width:`${picked/qty*100}%`}}/></div><span className="text-xs text-muted-foreground">{picked}/{qty}</span></div></td><td className="text-muted-foreground">{o.assigneeName||'Belum ditugaskan'}</td><td><StatusBadge status={o.status}/></td><td><Link href={`/orders/${o.id}`} aria-label={`Buka order ${o.orderNumber}`}><ArrowUpRight className="size-4 text-slate-400"/></Link></td></tr>;})}</tbody></table></div><div className="mobile-orders">{orders.map(o=><Link href={`/orders/${o.id}`} key={o.id} aria-label={o.orderNumber} className={`mobile-order${priority(o)?' priority-order':''}`}><div className="flex items-center justify-between gap-2"><strong>{o.orderNumber}</strong>{priority(o)&&<InstantBadge/>}<StatusBadge status={o.status}/></div><p>{o.items.length} SKU · {o.items.reduce((n,i)=>n+i.qty,0)} unit · {orderDate(o.createdAt)}</p><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{o.assigneeName||'Siap diambil'}</span><ArrowUpRight className="size-4"/></div></Link>)}</div></>;
}

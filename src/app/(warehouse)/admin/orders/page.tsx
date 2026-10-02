import Link from 'next/link';
import { Plus,FileUp } from 'lucide-react';
import { pageActor } from '@/lib/server-actor';
import { listOrders } from '@/lib/orders';
import { OrderList } from '@/components/order-list';
export default async function Orders(){const actor=await pageActor(['admin']);const orders=listOrders(actor);return <><div className="page-heading"><div><span className="eyebrow">MANAJEMEN ORDER</span><h1>Semua order</h1><p>Masukkan dan kelola order untuk tim gudang.</p></div><div className="heading-actions"><Link className="action-link secondary" href="/admin/import"><FileUp className="size-4"/>Import PDF</Link><Link className="action-link" href="/admin/orders/new"><Plus className="size-4"/>Order baru</Link></div></div><section className="surface"><div className="section-heading"><h2>Daftar order</h2><span className="subtle-pill">{orders.length} order</span></div><OrderList orders={orders}/></section></>;}

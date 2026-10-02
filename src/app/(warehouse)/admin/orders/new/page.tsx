import { pageActor } from '@/lib/server-actor';
import { listProducts } from '@/lib/catalog';
import { OrderForm } from '@/components/order-form';
export default async function NewOrder(){const actor=await pageActor(['admin']);return <><div className="page-heading"><div><span className="eyebrow">INPUT MANUAL</span><h1>Order baru</h1><p>Masukkan barang dan jumlahnya. Resi dapat dilengkapi kemudian.</p></div></div><section className="surface form-surface"><OrderForm products={listProducts(actor)}/></section></>;}

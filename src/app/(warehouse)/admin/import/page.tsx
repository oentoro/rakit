import { pageActor } from '@/lib/server-actor';
import { listProducts } from '@/lib/catalog';
import { ImportWorkspace } from '@/components/import-workspace';
export default async function Import(){const actor=await pageActor(['admin']);return <><div className="page-heading"><div><span className="eyebrow">INPUT DENGAN BANTUAN AI</span><h1>Import PDF</h1><p>Dari dokumen order menjadi antrean picking, dengan pemeriksaan admin.</p></div></div><ImportWorkspace products={listProducts(actor)} configured={!!process.env.GEMINI_API_KEY&&!!process.env.GEMINI_MODEL}/></>;}

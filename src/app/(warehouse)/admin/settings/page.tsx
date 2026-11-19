import { pageActor } from '@/lib/server-actor';
import { aiStatus } from '@/lib/settings';
import { AiSettings } from '@/components/ai-settings';
import { notifyStatus } from '@/lib/notify';
import { NotifySettings } from '@/components/notify-settings';
import { tiktokStatus } from '@/lib/tiktok';
import { shopeeStatus } from '@/lib/shopee';
import { ChannelSettings } from '@/components/channel-settings';
export default async function Settings(){const actor=await pageActor(['admin']);return <><div className="page-heading"><div><span className="eyebrow">KONFIGURASI SISTEM</span><h1>Pengaturan</h1><p>Atur integrasi AI, notifikasi order, TikTok Shop, dan Shopee.</p></div></div><AiSettings status={aiStatus(actor)}/><NotifySettings {...notifyStatus(actor)}/><ChannelSettings title="TikTok Shop" endpoint="/api/settings/tiktok" status={tiktokStatus(actor)} fields={[{name:'appKey',label:'App Key'},{name:'appSecret',label:'App Secret',secret:true},{name:'serviceId',label:'Service ID'}]}/><ChannelSettings title="Shopee" endpoint="/api/settings/shopee" pull status={shopeeStatus(actor)} fields={[{name:'partnerId',label:'Partner ID',numeric:true},{name:'partnerKey',label:'Partner Key',secret:true},{name:'pushKey',label:'Push Partner Key (dari Set Push)',secret:true}]}/></>;}

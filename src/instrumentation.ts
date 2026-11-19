// Positive NEXT_RUNTIME check (not an early return) so webpack drops the Node-only imports from the edge bundle.
// Production only: the dev server (own database) must not sync stock or poll orders against the same shops.
export async function register(){
  if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NODE_ENV==='production'){
    const [{syncTiktokStock},{syncShopeeStock,pollShopeeOrders}]=await Promise.all([import('./lib/tiktok'),import('./lib/shopee')]);
    // Every 5 minutes; each does nothing until its shop is connected. Errors are recorded for the settings page.
    setInterval(()=>{syncTiktokStock().catch(()=>{});pollShopeeOrders().catch(()=>{}).then(()=>syncShopeeStock()).catch(()=>{});},300_000).unref();
  }
}

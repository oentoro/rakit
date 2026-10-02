import { getDatabase } from './db';
import type { ProductLocation } from './types';
export function productLocations(productId:string,orderId:string|null=null):ProductLocation[]{
 return getDatabase().prepare(`SELECT l.id,l.rack,r.name AS rackName,l.shelf,l.quantity,
   COALESCE((SELECT SUM(p.quantity) FROM order_location_picks p WHERE p.location_id=l.id),0) AS reservedQuantity,
   COALESCE((SELECT SUM(p.quantity) FROM order_location_picks p WHERE p.location_id=l.id AND p.order_id=?),0) AS pickedQty
   FROM product_locations l JOIN racks r ON r.id=l.rack WHERE l.product_id=? ORDER BY l.rack,length(l.shelf),l.shelf`)
   .all(orderId,productId).map(row=>({...row,availableQuantity:row.quantity===null?null:Number(row.quantity)-Number(row.reservedQuantity)})) as ProductLocation[];
}

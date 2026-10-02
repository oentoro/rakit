export type Role = 'admin' | 'staff';
export type Status = 'waiting' | 'picking' | 'packing' | 'completed';
export type Actor = {id:string; name:string; role:Role};
export type Rack = {id:number;name:string;shelfCount:number};
export type RackOverview = Rack & {skuCount:number;occupiedShelves:string[]};
export type ProductLocation = {id:string;rack:number;rackName:string;shelf:string;quantity:number|null;reservedQuantity:number;availableQuantity:number|null;pickedQty:number};
export type Product = {id:string; sku:string; name:string; rack:number;rackName:string; shelf:string; photoFileId:string|null; active:boolean;locations:ProductLocation[];totalQuantity:number|null};
export type OrderInput = {orderNumber:string; airwayBill?:string; pdfFileId?:string; receiptPages:number[]; items:{productId:string;qty:number}[]};
export type ExtractedOrder = {orderNumber:string;airwayBill:string;receiptPages:number[];items:{sku:string;name:string;qty:number}[]};
export type OrderDetail = {id:string;orderNumber:string;airwayBill:string|null;status:Status;assigneeId:string|null;assigneeName:string|null;pdfFileId:string|null;receiptPages:number[];createdAt:number;completedAt:number|null;items:{productId:string;sku:string;name:string;photoFileId:string|null;rack:number;rackName:string;shelf:string;qty:number;pickedQty:number;locations:ProductLocation[]}[]};
export type ScanResult = {order:OrderDetail;message:string;replayed:boolean};

export type ProductPage = {products:Product[];total:number;totalPages:number;page:number;pageSize:number};

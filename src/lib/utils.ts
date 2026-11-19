export { cn } from "cn"

// Instant/sameday labels carry a 4-character pickup code (e.g. "96XF") instead of a long resi.
export function isInstant(airwayBill:string|null):boolean{return /^[a-z0-9]{4}$/i.test(airwayBill?.trim()||'');}

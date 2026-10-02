import { claimOrder,scanOrder } from '../src/lib/picking';
const input=JSON.parse(process.argv[2]);
try {const result=input.action==='claim'?claimOrder(input.actor,input.orderId):scanOrder(input.actor,input.orderId,input.scan);console.log(JSON.stringify({ok:true,result}));}
catch(error) {console.log(JSON.stringify({ok:false,status:(error as {status:number}).status}));}

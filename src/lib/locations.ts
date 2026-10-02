export function shelfLabels(count:number):string[] {
  return Array.from({length:count},(_,index)=>{
    let number=index+1,label='';
    while(number>0){number--;label=String.fromCharCode(65+number%26)+label;number=Math.floor(number/26);}
    return label;
  });
}

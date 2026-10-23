/** Per-entry save sequencing. A later edit must never reach D1 before the prior edit finishes. */
export function createSerialSaver(save:(day:string,slot:number,text:string)=>Promise<unknown>){
  const pending=new Map<string,Promise<void>>();
  return {
    queue(day:string,slot:number,text:string):Promise<void>{
      const key=`${day}/${slot}`;
      const previous=pending.get(key)??Promise.resolve();
      const next=previous.catch(()=>undefined).then(async()=>{await save(day,slot,text)});
      pending.set(key,next);
      const remove=()=>{if(pending.get(key)===next)pending.delete(key)};
      void next.then(remove,remove);
      return next;
    },
    async waitAll():Promise<void>{
      const result=await Promise.allSettled([...pending.values()]);
      const failed=result.find((r):r is PromiseRejectedResult=>r.status==='rejected');
      if(failed)throw failed.reason;
    }
  };
}

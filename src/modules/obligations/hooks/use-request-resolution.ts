import { useRef,useState } from "react";

/** Prevent same-tick repeated confirmations and keep the form on failed requests. */
export function useRequestResolution(isResolving:boolean) {
  const locked=useRef(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  async function run(action:()=>Promise<void>,onSuccess?:()=>void) {
    if(locked.current||isResolving)return;
    locked.current=true;setPending(true);setError("");
    try{await action();onSuccess?.();}
    catch(e){setError(e instanceof Error?e.message:"No se pudo responder. Revisa la solicitud y reintenta.");}
    finally{locked.current=false;setPending(false);}
  }
  return {run,error,setError,busy:isResolving||pending};
}

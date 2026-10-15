import { useEffect,useRef } from "react";
import { notificationObligationReadState,resolveNotificationObligationTarget } from "../lib/notification-obligation-target";

type Target=ReturnType<typeof resolveNotificationObligationTarget>;
export function useObligationNotificationOpening(input:{
  params:URLSearchParams;workspaceId?:number;snapshotWorkspaceId?:number;stale:boolean;
  data:Parameters<typeof resolveNotificationObligationTarget>[1];
  reads:{shared:"loading"|"error"|"ready";payments:"loading"|"error"|"ready";events:"loading"|"error"|"ready"};
  onError:(kind:"read"|"missing")=>void;onTarget:(target:Target)=>void;onConsume:()=>void;
}) {
  const consumed=useRef("");
  useEffect(()=>{
    if(!input.params.has("resource")){consumed.current="";return;}
    if(!input.workspaceId||input.workspaceId!==input.snapshotWorkspaceId||input.stale)return;
    const key=`${input.workspaceId}:${input.params.toString()}`;
    if(consumed.current===key)return;
    const reads=notificationObligationReadState(input.params,{owned:input.data.owned,...input.reads});
    if(reads==="loading")return;
    if(reads==="error"){input.onError("read");return;}
    const target=resolveNotificationObligationTarget(input.params,input.data);
    consumed.current=key;
    if(!target)input.onError("missing");
    input.onTarget(target);input.onConsume();
  },[input]);
}

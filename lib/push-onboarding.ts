export type PushOnboarding={failures:number;reason?:"unsupported"|"denied"|"failed";dismissed?:boolean};
const fallback=new Map<string,PushOnboarding>();
const key=(userId:string)=>`pasion-push-onboarding-state-v1:${userId}`;
export function readPushOnboarding(userId:string):PushOnboarding{
 const temporary=fallback.get(userId);
 if(temporary)return temporary;
 try{
  const value=JSON.parse(localStorage.getItem(key(userId))??"null");
  if(value&&Number.isInteger(value.failures)&&value.failures>=0){
   return {failures:value.failures,reason:["unsupported","denied","failed"].includes(value.reason)?value.reason:undefined,dismissed:value.dismissed===true};
  }
 }catch{}
 return {failures:0};
}
export function writePushOnboarding(userId:string,value:PushOnboarding){
 try{
  localStorage.setItem(key(userId),JSON.stringify(value));
  fallback.delete(userId);
 }catch{fallback.set(userId,value);}
 window.dispatchEvent(new Event("pasion-push-onboarding"));
}
export function recordPushFailure(state:PushOnboarding,reason:NonNullable<PushOnboarding["reason"]>):PushOnboarding{
 return {...state,failures:state.failures+1,reason};
}
export function canDismissPush(state:PushOnboarding){
 return state.reason==="unsupported"||state.reason==="denied"||state.failures>=2;
}

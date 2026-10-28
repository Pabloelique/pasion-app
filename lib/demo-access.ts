export type DemoProfile={role:string;approval_status:string;viewer_access_expires_at:string|null};
export function demoAccess(profile:DemoProfile|null,now=Date.now()){
 const preview=Boolean(profile&&profile.role==="superadmin"&&profile.approval_status==="approved");
 const expires=profile?.viewer_access_expires_at?Date.parse(profile.viewer_access_expires_at):0;
 const remaining=profile?.role==="viewer"&&profile.approval_status==="demo"&&Number.isFinite(expires)?Math.max(0,Math.floor((expires-now)/1000)):0;
 return {allowed:preview||remaining>0,preview,remainingSeconds:preview?900:remaining};
}

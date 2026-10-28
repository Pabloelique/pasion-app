import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import {demoAccess} from "@/lib/demo-access";
import DemoApp from "./demo-app";
export const dynamic="force-dynamic";
export default async function DemoPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("role,approval_status,viewer_access_expires_at").eq("id",user.id).single();
 if(!profile||(profile.role!=="viewer"&&!(profile.role==="superadmin"&&profile.approval_status==="approved")))redirect("/panel");
 const access=demoAccess(profile);
 return <DemoApp initialSeconds={access.remainingSeconds} preview={access.preview}/>;
}

import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import Activity from "./activity";
export const dynamic="force-dynamic";
export default async function ActivityPage(){
 const db=await getSupabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("role,approval_status").eq("id",user.id).single();
 if(profile?.role!=="superadmin"||profile.approval_status!=="approved")redirect("/panel");
 return <Activity/>;
}

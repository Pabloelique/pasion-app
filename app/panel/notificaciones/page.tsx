import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import Notifications from "./notifications";
export const dynamic="force-dynamic";
export default async function NotificationsPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("approval_status").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved")redirect("/panel");
 return <Notifications userId={user.id}/>;
}
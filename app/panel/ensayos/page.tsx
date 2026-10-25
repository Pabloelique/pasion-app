import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import RehearsalPlanner from "./rehearsal-planner";
export const dynamic="force-dynamic";
export default async function RehearsalsPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("role,approval_status").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved")redirect("/panel");
 return <RehearsalPlanner role={profile.role} userId={user.id}/>;
}
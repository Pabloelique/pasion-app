import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import Members from "./members";
export const dynamic="force-dynamic";
export default async function MembersPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("approval_status,role").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved"||profile.role==="viewer")redirect("/panel");
 return <Members userId={user.id}/>;
}

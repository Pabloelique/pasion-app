import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import Inventory from "./inventory";
export const dynamic="force-dynamic";
export default async function InventoryPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("role,approval_status").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved"||!["directiva","superadmin"].includes(profile.role))redirect("/panel");
 return <Inventory userId={user.id}/>;
}
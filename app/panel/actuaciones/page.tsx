import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import Bookings from "./bookings";
export const dynamic="force-dynamic";
export default async function BookingsPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("role,approval_status").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved"||!["directiva","superadmin"].includes(profile.role))redirect("/panel");
 return <Bookings userId={user.id}/>;
}
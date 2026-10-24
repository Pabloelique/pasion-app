import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import RequestList from "./request-list";
export const dynamic="force-dynamic";
export default async function RequestsPage() {
  const db=await getSupabaseServer();
  const {data:{user}}=await db.auth.getUser();
  if(!user)redirect("/acceso");
  const {data:profile}=await db.from("profiles").select("role,approval_status").eq("id",user.id).single();
  if(!profile||profile.approval_status!=="approved"||!["superadmin","directiva"].includes(profile.role))redirect("/panel");
  return <RequestList role={profile.role}/>;
}

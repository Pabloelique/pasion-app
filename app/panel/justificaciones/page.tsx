import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import AbsenceReports from "./absence-reports";
export const dynamic="force-dynamic";
export default async function AbsencePage(){
 const db=await getSupabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:allowed,error}=await db.rpc("can_review_absences");
 if(error||allowed!==true)redirect("/panel");
 return <AbsenceReports/>;
}

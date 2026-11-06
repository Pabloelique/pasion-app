import {redirect} from "next/navigation";
import {getSupabaseServer} from "@/lib/supabase/server";
import MusicTools from "./tools";
export const dynamic="force-dynamic";
export default async function MusicToolsPage(){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("approval_status,musical_part_id").eq("id",user.id).single();
 if(!profile||profile.approval_status!=="approved")redirect("/panel");
 let partName:string|null=null;
 if(profile.musical_part_id){const {data:part}=await db.from("musical_parts").select("name").eq("id",profile.musical_part_id).maybeSingle();partName=part?.name??null;}
 return <MusicTools partName={partName}/>;
}

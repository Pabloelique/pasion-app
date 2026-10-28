import {NextResponse} from "next/server";
import {getSupabaseServer} from "@/lib/supabase/server";
import {demoAccess} from "@/lib/demo-access";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(){
 const db=await getSupabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({allowed:false,remainingSeconds:0},{status:401,headers});
 const {data,error}=await db.from("profiles").select("role,approval_status,viewer_access_expires_at").eq("id",user.id).single();
 if(error)return NextResponse.json({allowed:false,remainingSeconds:0},{status:403,headers});
 return NextResponse.json(demoAccess(data),{headers});
}
export async function POST(){
 const db=await getSupabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Inicia sesión para solicitar acceso."},{status:401,headers});
 const {error}=await db.rpc("request_viewer_access");
 if(error)return NextResponse.json({error:"No se pudo solicitar el acceso de demostración."},{status:403,headers});
 return NextResponse.json({requested:true},{headers});
}

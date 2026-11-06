import {NextRequest,NextResponse} from "next/server";
import {getSupabaseServer} from "@/lib/supabase/server";
import {validId} from "@/lib/notice-links";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};

// Confirmación rápida de asistencia desde el botón de la notificación push.
// La ausencia no se acepta aquí porque exige justificación: se rellena en el calendario.
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Origen no permitido"},{status:403,headers});
 let body:{eventId?:unknown;answer?:unknown};
 try{body=await request.json();}catch{return NextResponse.json({error:"Solicitud incorrecta"},{status:400,headers});}
 if(typeof body.eventId!=="string"||!validId(body.eventId)||body.answer!=="asistire")
  return NextResponse.json({error:"Solicitud incorrecta"},{status:400,headers});
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Inicia sesión"},{status:401,headers});
 const {error}=await db.rpc("submit_event_response",{target_event:body.eventId,answer:"asistire",reason:null});
 if(error)return NextResponse.json({error:"No se pudo guardar la respuesta"},{status:403,headers});
 // El aviso queda leído: ya se ha respondido.
 await db.from("app_notifications").update({read_at:new Date().toISOString()})
  .eq("user_id",user.id).eq("source_id",body.eventId).is("read_at",null);
 return NextResponse.json({saved:true},{headers});
}

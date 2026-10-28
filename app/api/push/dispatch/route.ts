import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";
import {timingSafeEqual} from "node:crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function tokenMatches(actual:string|null,expected:string){
 if(!actual||!expected)return false;
 const left=Buffer.from(actual),right=Buffer.from(expected);
 return left.length===right.length&&timingSafeEqual(left,right);
}
type Hook={type?:string;table?:string;schema?:string;record?:{id?:string;title?:string;message?:string;created_at?:string};old_record?:{title?:string;message?:string;created_at?:string}};
function uuid(value:unknown):value is string{
 return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export async function POST(request:NextRequest){
 const secret=process.env.PUSH_WEBHOOK_SECRET;
 if(!secret||!tokenMatches(request.headers.get("x-pasion-push-secret"),secret)){
  return NextResponse.json({error:"No autorizado"},{status:401});
 }
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 const privateKey=process.env.VAPID_PRIVATE_KEY;
 const subject=process.env.VAPID_SUBJECT;
 if(!url||!service||!publicKey||!privateKey||!subject)
  return NextResponse.json({error:"Configuración push pendiente"},{status:503});
 let input:Hook;
 try{input=await request.json() as Hook;}catch{return NextResponse.json({error:"Solicitud incorrecta"},{status:400});}
 if(!["INSERT","UPDATE"].includes(input.type??"")||input.table!=="app_notifications"||input.schema!=="public"||!uuid(input.record?.id))
  return NextResponse.json({error:"Evento no válido"},{status:400});
 // Evitar avisos duplicados al marcar una notificación como leída.
 if(input.type==="UPDATE"&&(!input.old_record||
  (input.record?.title===input.old_record.title&&input.record?.message===input.old_record.message&&input.record?.created_at===input.old_record.created_at)))
  return NextResponse.json({sent:0,reason:"Actualización sin contenido nuevo"});
 const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:notice,error:noticeError}=await db.from("app_notifications")
  .select("id,user_id,title,message,destination").eq("id",input.record.id).maybeSingle();
 if(noticeError)return NextResponse.json({error:"No se pudo consultar el aviso"},{status:500});
 if(!notice)return NextResponse.json({sent:0,reason:"Aviso inexistente"});
 const {data:member,error:memberError}=await db.from("profiles")
  .select("approval_status").eq("id",notice.user_id).maybeSingle();
 if(memberError)return NextResponse.json({error:"No se pudo validar el miembro"},{status:500});
 if(member?.approval_status!=="approved")return NextResponse.json({sent:0,reason:"Miembro no aprobado"});
 const {data:devices,error:deviceError}=await db.from("push_subscriptions")
  .select("id,endpoint,p256dh,auth_key").eq("user_id",notice.user_id).limit(30);
 if(deviceError)return NextResponse.json({error:"No se pudieron consultar dispositivos"},{status:500});
 webpush.setVapidDetails(subject,publicKey,privateKey);
 let sent=0;let failed=0;
 for(const device of devices??[]){
  try{
   const endpoint=new URL(device.endpoint);
   const approvedHosts=["fcm.googleapis.com","updates.push.services.mozilla.com","push.services.mozilla.com","web.push.apple.com"];
   if(endpoint.protocol!=="https:"||!approvedHosts.includes(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.port){failed++;continue;}
   await webpush.sendNotification(
    {endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth_key}},
    JSON.stringify({title:notice.title,body:notice.message||"Tienes una novedad en PASIÓN APP.",
     url:"/panel/notificaciones#aviso-"+notice.id,
     tag:"pasion-"+notice.id}),
    {TTL:86400,urgency:"normal",timeout:6500}
   );
   sent++;
  }catch(err){
   failed++;
   const code=(err as {statusCode?:number}).statusCode;
   if(code===404||code===410)await db.from("push_subscriptions").delete().eq("id",device.id);
  }
 }
 return NextResponse.json({sent,failed});
}

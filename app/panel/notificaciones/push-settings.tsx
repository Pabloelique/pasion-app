"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowser} from "@/lib/supabase/client";

function toBytes(base64:string){
 const padding="=".repeat((4-base64.length%4)%4);
 const raw=atob((base64+padding).replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function b64Url(buffer:ArrayBuffer|null){
 if(!buffer)throw new Error("El navegador no ha generado las claves de la suscripción.");
 const bytes=new Uint8Array(buffer);
 let str="";for(const b of bytes)str+=String.fromCharCode(b);
 return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function supported(){
 return typeof window!=="undefined"&&"serviceWorker" in navigator&&
 "PushManager" in window&&"Notification" in window;
}

export default function PushSettings({userId}:{userId:string}){
 const [available,setAvailable]=useState<boolean|null>(null);
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [info,setInfo]=useState("");
 const [error,setError]=useState("");
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 useEffect(()=>{
  let mounted=true;
  async function check(){
   const yes=supported();
   if(!mounted)return;
   setAvailable(yes);
   if(!yes)return;
   try{
    const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
    const sub=await reg.pushManager.getSubscription();
    if(!mounted)return;
    setEnabled(Boolean(sub)&&Notification.permission==="granted");
   }catch{if(mounted)setInfo("El navegador no ha permitido preparar las notificaciones.");}
  }
  void check();return()=>{mounted=false};
 },[]);
 async function activate(){
  if(busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   if(!publicKey)throw new Error("Falta configurar la clave pública de notificaciones en Vercel.");
   if(!supported())throw new Error("Este dispositivo no admite notificaciones push desde esta página.");
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("Activa el permiso de notificaciones en los ajustes del dispositivo.");
   const reg=await navigator.serviceWorker.ready;
   const existing=await reg.pushManager.getSubscription();
   const sub=existing??await reg.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:toBytes(publicKey)
   });
   const data=sub.toJSON();
   if(!data.endpoint||!data.keys?.p256dh||!data.keys?.auth)throw new Error("No se pudo preparar la suscripción.");
   // La base de datos solo acepta suscripciones del usuario autenticado.
   const {error:err}=await getSupabaseBrowser().from("push_subscriptions").upsert({
    user_id:userId,endpoint:data.endpoint,p256dh:data.keys.p256dh,auth_key:data.keys.auth,
    updated_at:new Date().toISOString()
   },{onConflict:"endpoint"});
   if(err)throw err;
   setEnabled(true);
   setInfo("Notificaciones activadas en este dispositivo.");
  }catch(e){setError(e instanceof Error?e.message:"No se pudieron activar los avisos.");}
  finally{setBusy(false);}
 }
 async function deactivate(){
  if(busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(sub){
    const {error:err}=await getSupabaseBrowser().from("push_subscriptions")
     .delete().eq("user_id",userId).eq("endpoint",sub.endpoint);
    if(err)throw err;
    await sub.unsubscribe();
   }
   setEnabled(false);setInfo("Notificaciones desactivadas en este dispositivo.");
  }catch(e){setError(e instanceof Error?e.message:"No se pudieron desactivar los avisos.");}
  finally{setBusy(false);}
 }
 return <section className="notificationPanel">
  <h2>Notificaciones al móvil</h2>
  <p className="muted">Recibe avisos de ensayos convocados, cancelaciones, votaciones y comunicados importantes aunque no tengas PASIÓN APP abierta. Puedes desactivarlos cuando quieras.</p>
  {available===null?<p className="muted">Comprobando compatibilidad…</p>:!available?
   <p className="muted">Este navegador no admite notificaciones push en este contexto. En iPhone usa Safari → Compartir → Añadir a pantalla de inicio y abre PASIÓN APP desde su icono. En Android, utiliza un navegador compatible.</p>:
   <div className="attendanceActions">
    {enabled?<button className="secondaryButton" disabled={busy} type="button" onClick={()=>void deactivate()}>{busy?"Procesando…":"Desactivar notificaciones"}</button>:
     <button className="primaryButton" disabled={busy} type="button" onClick={()=>void activate()}>{busy?"Activando…":"Activar notificaciones push"}</button>}
   </div>}
  {enabled&&<p className="formSuccess">Permiso de notificaciones activo en este dispositivo.</p>}
  {info&&<p className="muted" role="status">{info}</p>}
  {error&&<p className="formError" role="alert">{error}</p>}
  <p className="muted small">Cada móvil debe activar los avisos por separado. Si no los activas, seguirás viendo las novedades en la bandeja de PASIÓN APP.</p>
 </section>;
}

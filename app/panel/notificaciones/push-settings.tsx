"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {useDemoMode} from "@/lib/app-data";
import {pushActivationError} from "@/lib/push-errors";

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

export default function PushSettings({userId,required=false}:{userId:string;required?:boolean}){
 const isDemo=useDemoMode();
 const [completed,setCompleted]=useState(false);
 const [unsupportedDismissed,setUnsupportedDismissed]=useState(false);
 const completionKey=`pasion-push-onboarding-v1:${userId}`;
 function remember(){try{localStorage.setItem(completionKey,"done");}catch{}setCompleted(true);}
 const [available,setAvailable]=useState<boolean|null>(null);
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [info,setInfo]=useState("");
 const [error,setError]=useState("");
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 useEffect(()=>{
  if(isDemo){setAvailable(true);setInfo("Demostración: no se solicitan permisos ni se activan avisos reales.");return;}
  let mounted=true;
  try{if(localStorage.getItem(completionKey)==="done")setCompleted(true);}catch{}
  async function check(){
   const yes=supported();
   if(!mounted)return;
   setAvailable(yes);
   if(!yes)return;
   try{
    const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
    const sub=await reg.pushManager.getSubscription();
    if(!mounted)return;
    const active=Boolean(sub)&&Notification.permission==="granted";
    if(active&&sub){
     const {data,error:lookupError}=await getSupabaseBrowser().from("push_subscriptions").select("user_id").eq("user_id",userId).eq("endpoint",sub.endpoint).maybeSingle();
     if(!mounted)return;
     if(lookupError)throw lookupError;
     setEnabled(Boolean(data));
     if(data)remember();
    }else setEnabled(false);
   }catch{if(mounted)setInfo("El navegador no ha permitido preparar las notificaciones.");}
  }
  void check();
  const recheck=()=>{if(document.visibilityState==="visible")void check();};
  window.addEventListener("focus",recheck);document.addEventListener("visibilitychange",recheck);
  return()=>{mounted=false;window.removeEventListener("focus",recheck);document.removeEventListener("visibilitychange",recheck);};
 },[isDemo,userId,completionKey]);
 async function activate(){
  if(isDemo||busy)return;
  let phase:"preparación"|"permiso"|"suscripción"|"guardado"="preparación";
  setBusy(true);setError("");setInfo("");
  try{
   if(!publicKey)throw new Error("Falta configurar la clave pública de notificaciones en Vercel.");
   if(!supported())throw new Error("Este dispositivo no admite notificaciones push desde esta página.");
   phase="permiso";
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("Activa el permiso de notificaciones en los ajustes del dispositivo.");
   phase="suscripción";
   const reg=await navigator.serviceWorker.ready;
   const existing=await reg.pushManager.getSubscription();
   const sub=existing??await reg.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:toBytes(publicKey)
   });
   const data=sub.toJSON();
   if(!data.endpoint||!data.keys?.p256dh||!data.keys?.auth)throw new Error("No se pudo preparar la suscripción.");
   phase="guardado";
   // La base de datos solo acepta suscripciones del usuario autenticado.
   const {error:err}=await getSupabaseBrowser().from("push_subscriptions").upsert({
    user_id:userId,endpoint:data.endpoint,p256dh:data.keys.p256dh,auth_key:data.keys.auth,
    updated_at:new Date().toISOString()
   },{onConflict:"user_id,endpoint"});
   if(err)throw err;
   setEnabled(true);remember();
   setInfo("Notificaciones activadas en este dispositivo.");
  }catch(e){setError(pushActivationError(e,phase));}
  finally{setBusy(false);}
 }
 async function deactivate(){
  if(isDemo||busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(sub){
    const {error:err}=await getSupabaseBrowser().from("push_subscriptions")
     .delete().eq("user_id",userId).eq("endpoint",sub.endpoint);
    if(err)throw err;
    // La suscripción del navegador puede estar compartida por otras cuentas.
    // Dar de baja solo este registro mantiene sus avisos independientes.
   }
   setEnabled(false);setInfo("Notificaciones desactivadas para esta cuenta en este dispositivo.");
  }catch(e){setError(e instanceof Error?e.message:"No se pudieron desactivar los avisos.");}
  finally{setBusy(false);}
 }
 if(required&&(isDemo||completed||unsupportedDismissed))return null;
 const panel=<section className="notificationPanel" style={required?{maxWidth:760,margin:"0 auto"}:undefined}>
 {required&&<><h1>Activa los avisos de PASIÓN APP</h1><p>Antes de continuar, activa las notificaciones para enterarte de ensayos, cambios y comunicados de la agrupación. Solo tendrás que hacerlo una vez en este móvil.</p><p>Pulsa «Activar notificaciones push» y después «Permitir» cuando lo pregunte tu móvil.</p></>}
  <h2>Notificaciones al móvil</h2>
  <p className="muted">Recibe avisos de ensayos convocados, cancelaciones, votaciones y comunicados aunque no tengas PASIÓN APP abierta. Puedes desactivarlos cuando quieras.</p>
  {available===null?<p className="muted">Comprobando compatibilidad…</p>:!available?
   <p className="muted">Este navegador no admite notificaciones push en este contexto. En iPhone usa Safari → Compartir → Añadir a pantalla de inicio y abre PASIÓN APP desde su icono. En Android, utiliza un navegador compatible.</p>:
   <div className="attendanceActions">
    {enabled?<button className="secondaryButton" disabled={isDemo||busy} type="button" onClick={()=>void deactivate()}>{busy?"Procesando…":"Desactivar notificaciones"}</button>:
     <button className="primaryButton" disabled={isDemo||busy} type="button" onClick={()=>void activate()}>{busy?"Activando…":"Activar notificaciones push"}</button>}
   </div>}
  {enabled&&<p className="formSuccess">Permiso de notificaciones activo en este dispositivo.</p>}
  {info&&<p className="muted" role="status">{info}</p>}
  {error&&<p className="formError" role="alert">{error}</p>}
  <p className="muted small">Cada cuenta debe activar los avisos una vez en cada móvil. Si utilizas varias cuentas en el mismo dispositivo, cada una mantiene su activación independiente. Si no los activas, seguirás viendo las novedades en la bandeja de PASIÓN APP.</p>
  <div aria-labelledby="push-guide-title">
   <h3 id="push-guide-title">Guía según tu móvil</h3>
   <p className="muted">Si ya tienes PASIÓN APP en la pantalla de inicio, empieza abriendo ese icono. No borres el acceso: primero sigue los pasos de tu móvil.</p>
   <details className="notice">
    <summary>iPhone y iPad</summary>
    <ol className="muted">
     <li>Abre PASIÓN APP desde su icono en la pantalla de inicio e inicia sesión.</li>
     <li>Entra en <strong>Notificaciones</strong> y pulsa <strong>Activar notificaciones push</strong>.</li>
     <li>Cuando el móvil pregunte, pulsa <strong>Permitir</strong>. Debe aparecer el mensaje de notificaciones activadas.</li>
    </ol>
    <p className="muted">Necesitas iOS o iPadOS 16.4 o posterior. Si el icono abre una pestaña del navegador y no permite activar los avisos, puede ser un marcador: abre pasion-app.vercel.app en Safari, pulsa Compartir → Añadir a pantalla de inicio y abre el icono creado. Solo hace falta este paso si el acceso actual no funciona como aplicación web.</p>
    <p className="muted">Si antes rechazaste el permiso, busca PASIÓN APP en Ajustes → Notificaciones y activa Permitir notificaciones. Vuelve después a esta pantalla.</p>
   </details>
   <details className="notice">
    <summary>Android: Samsung, Xiaomi, Redmi, OPPO, realme, Motorola y otros</summary>
    <ol className="muted">
     <li>Abre el icono que ya tienes de PASIÓN APP e inicia sesión.</li>
     <li>Entra en <strong>Notificaciones</strong>, pulsa <strong>Activar notificaciones push</strong> y acepta el permiso.</li>
     <li>Comprueba que aparece el mensaje de notificaciones activadas en este dispositivo.</li>
    </ol>
    <p className="muted">Si tu navegador no admite los avisos, abre pasion-app.vercel.app en Chrome actualizado y repite los pasos. En Chrome no necesitas instalar otra aplicación para activar las notificaciones.</p>
    <p className="muted">Si bloqueaste el permiso: abre la web en Chrome → información del sitio, junto a la dirección → Permisos → Notificaciones → Permitir. Comprueba también en los ajustes del móvil que las notificaciones de Chrome o PASIÓN APP estén permitidas. Los nombres de los menús pueden variar.</p>
   </details>
   <details className="notice">
    <summary>Ya los he activado, pero no me llegan</summary>
    <ul className="muted">
     <li>Actívalos por separado en cada móvil o tablet que utilices, con tu cuenta aprobada.</li>
     <li>Si no ves el botón o la guía actualizada, cierra y vuelve a abrir PASIÓN APP con conexión; si sigue igual, recarga la página.</li>
     <li>Revisa los permisos del móvil y del navegador, el modo No molestar o Concentración y tu conexión a Internet. Usa una ventana normal, no privada.</li>
     <li>Si el móvil restringe la actividad en segundo plano o usa ahorro de batería, revisa esas opciones para el navegador o PASIÓN APP.</li>
     <li>Los avisos corresponden a las novedades que te afectan. Activarlos no vuelve a enviar los avisos antiguos; compruébalo con un aviso nuevo de directiva.</li>
    </ul>
    <p className="muted">Puedes pulsar Desactivar notificaciones en esta pantalla cuando quieras. Aunque no actives los avisos al móvil, las novedades seguirán en tu bandeja de entrada. La entrega puede retrasarse según la conexión y los ajustes del dispositivo.</p>
   </details>
  </div>
 {required&&available===false&&<button type="button" className="secondaryButton" onClick={()=>setUnsupportedDismissed(true)}>Mi dispositivo no es compatible: continuar</button>}
 </section>;
 return required?<dialog aria-label="Activar notificaciones" ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={event=>event.preventDefault()} style={{position:"fixed",inset:0,width:"100%",maxWidth:"none",height:"100dvh",maxHeight:"none",margin:0,border:0,overflowY:"auto",background:"var(--page)",color:"var(--text)",padding:24}}>{panel}</dialog>:panel;
}

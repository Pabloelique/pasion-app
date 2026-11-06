self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
/* PASIÓN APP · Service Worker: push privado, sin cachear datos sensibles. */
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SECTIONS=["/panel/calendario","/panel/tablon","/panel/votaciones","/panel/notificaciones"];
const LINK=new RegExp("^/panel/(?:notificaciones#aviso-|calendario#evento-|tablon#anuncio-)"+UUID+"$","i");
const ID=new RegExp("^"+UUID+"$","i");
function safeUrl(url){return typeof url==="string"&&(SECTIONS.includes(url)||LINK.test(url))?url:"/panel/notificaciones";}

self.addEventListener("push",event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch{data={}}
 const title=typeof data.title==="string"?data.title:"PASIÓN APP";
 const eventId=typeof data.eventId==="string"&&ID.test(data.eventId)?data.eventId:null;
 const actions=eventId&&Array.isArray(data.actions)?data.actions
  .filter(a=>a&&["asistire","no_asistire"].includes(a.action)&&typeof a.title==="string")
  .map(a=>({action:a.action,title:a.title.slice(0,40)})):[];
 event.waitUntil(self.registration.showNotification(title,{
  body:typeof data.body==="string"?data.body:"Tienes una novedad de La Pasión de Mazarrón.",
  icon:"/icons/logo-192.png",badge:"/icons/logo-192.png",
  tag:typeof data.tag==="string"?data.tag:"pasion-aviso",
  actions,
  data:{url:safeUrl(data.url),eventId}
 }));
});

async function openApp(path){
 const url=new URL(path,self.location.origin).href;
 const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
 for(const client of clientsList){
  if(client.url.startsWith(self.location.origin)&&"focus" in client){
   if("navigate" in client)await client.navigate(url);
   return client.focus();
  }
 }
 return self.clients.openWindow(url);
}

self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const data=event.notification.data||{};
 const path=safeUrl(data.url);
 const eventId=typeof data.eventId==="string"&&ID.test(data.eventId)?data.eventId:null;
 event.waitUntil((async()=>{
  if(eventId&&event.action==="asistire"){
   // Confirmación con un toque, usando la sesión guardada en el navegador.
   try{
    const res=await fetch("/api/eventos/respuesta",{method:"POST",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,answer:"asistire"})});
    if(res.ok){
     return self.registration.showNotification("✅ Asistencia confirmada",{
      body:"Gracias por confirmar. ¡Nos vemos en el ensayo!",icon:"/icons/logo-192.png",badge:"/icons/logo-192.png",
      tag:"pasion-confirmado-"+eventId,data:{url:"/panel/calendario#evento-"+eventId}});
    }
   }catch{}
   return openApp("/panel/calendario#evento-"+eventId);
  }
  if(eventId&&event.action==="no_asistire"){
   // La ausencia necesita justificación: se abre el evento con «No asistiré» ya marcado.
   return openApp("/panel/calendario?responder=no_asistire#evento-"+eventId);
  }
  return openApp(path);
 })());
});

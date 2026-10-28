self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
/* PASIÓN APP · Service Worker: push privado, sin cachear datos sensibles. */
self.addEventListener("push",event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch{data={}}
 const title=typeof data.title==="string"?data.title:"PASIÓN APP";
 const target=typeof data.url==="string"&&(["/panel/calendario","/panel/tablon","/panel/votaciones","/panel/notificaciones"].includes(data.url)||/^\/panel\/notificaciones#aviso-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.url))?data.url:"/panel/notificaciones";
 event.waitUntil(self.registration.showNotification(title,{
  body:typeof data.body==="string"?data.body:"Tienes una novedad de La Pasión de Mazarrón.",
  icon:"/icons/logo-192.png",badge:"/icons/logo-192.png",
  tag:typeof data.tag==="string"?data.tag:"pasion-aviso",
  data:{url:target}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const path=event.notification.data&&event.notification.data.url||"/panel/notificaciones";
 event.waitUntil((async()=>{
  const url=new URL(path,self.location.origin).href;
  const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clientsList){
   if(client.url.startsWith(self.location.origin)&&"focus" in client){
    if("navigate" in client)await client.navigate(url);
    return client.focus();
   }
  }
  return self.clients.openWindow(url);
 })());
});

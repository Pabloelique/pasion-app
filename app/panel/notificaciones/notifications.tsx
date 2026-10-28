"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {noticeLink,actionLabel,safeAppLink,detectAnnouncementLink,validId} from "@/lib/notice-links";
import {useRecordAnchor} from "@/lib/use-record-anchor";
import PushSettings from "./push-settings";
type LinkedPost={id:string;content:string;link_path:string|null};
type Notification={id:string;user_id:string;kind:string;source_id:string;title:string;message:string;destination:string;created_at:string;read_at:string|null};
const label:Record<string,string>={ensayo:"Ensayo",actuacion:"Actuación",evento:"Actividad",comunicado:"Comunicado",votacion:"Votación"};
const dateTime=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"});
export default function Notifications({userId}:{userId:string}){
 const db=getSupabaseBrowser();
 const router=useRouter();
 const [items,setItems]=useState<Notification[]>([]);
 const [linkedPosts,setLinkedPosts]=useState<LinkedPost[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [filter,setFilter]=useState<"todas"|"sin_leer">("todas");
 async function load(){
  setLoading(true);setError("");
  const {data,error:err}=await db.from("app_notifications")
   .select("id,user_id,kind,source_id,title,message,destination,created_at,read_at")
   .eq("user_id",userId).order("created_at",{ascending:false}).limit(250);
  if(err)setError(err.message);else{
   const notices=(data??[]) as Notification[];
   const linkedId=window.location.hash.startsWith("#aviso-")?window.location.hash.slice(7):"";
   if(validId(linkedId)&&!notices.some(n=>n.id===linkedId)){
    const linked=await db.from("app_notifications").select("id,user_id,kind,source_id,title,message,destination,created_at,read_at").eq("id",linkedId).eq("user_id",userId).maybeSingle();
    if(linked.error)setError("No se pudo cargar el aviso enlazado.");
    else if(linked.data)notices.unshift(linked.data as Notification);
    else setError("El aviso enlazado ya no está disponible.");
   }
   setItems(notices);
   const ids=notices.filter(n=>n.kind==="comunicado").map(n=>n.source_id);
   if(ids.length){
    const posts=await db.from("board_posts").select("id,content,link_path").in("id",ids);
    if(posts.error)setError("No se pudo cargar el mensaje completo. Abre el comunicado para leerlo.");
    setLinkedPosts((posts.data??[]) as LinkedPost[]);
   }else setLinkedPosts([]);
  }
  setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 useRecordAnchor("aviso-",items.map(n=>n.id).join(",")+"|"+linkedPosts.map(p=>p.id).join(","));
 const unread=items.filter(n=>!n.read_at);
 const shown=useMemo(()=>filter==="sin_leer"?items.filter(n=>!n.read_at):items,[filter,items]);
 async function mark(id:string,destination?:string){
  if(busy)return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("app_notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId).is("read_at",null);
  setBusy(false);if(err){setError(err.message);return;}
  setItems(old=>old.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));
  if(destination)router.push(destination);
 }
 async function markAll(){
  if(busy||unread.length===0)return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("app_notifications").update({read_at:new Date().toISOString()}).eq("user_id",userId).is("read_at",null);
  setBusy(false);if(err){setError(err.message);return;}
  const timestamp=new Date().toISOString();
  setItems(old=>old.map(n=>({...n,read_at:n.read_at??timestamp})));
  setSuccess("Todas las notificaciones marcadas como leídas.");
 }
 return <main className="container">
  <Link className="backLink" href="/panel">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Notificaciones</h1></div></header>
  <p className="muted">Avisos sobre ensayos, actuaciones, comunicados y votaciones. Activa las notificaciones push para recibirlos también fuera de PASIÓN APP.</p>
  <PushSettings userId={userId}/>
  <section className="notificationPanel">
   <div className="notificationToolbar">
    <div><h2>Bandeja de entrada</h2><p className="muted small">{unread.length} sin leer</p></div>
    <button className="secondaryButton" type="button" disabled={busy||loading||unread.length===0} onClick={()=>void markAll()}>Marcar todas como leídas</button>
   </div>
   <div className="notificationToolbar">
    <div className="notificationFilters">
     <button type="button" className={filter==="todas"?"notificationFilter active":"notificationFilter"} onClick={()=>setFilter("todas")}>Todas</button>
     <button type="button" className={filter==="sin_leer"?"notificationFilter active":"notificationFilter"} onClick={()=>setFilter("sin_leer")}>Sin leer ({unread.length})</button>
    </div>
    <button className="secondaryButton" type="button" disabled={loading||busy} onClick={()=>void load()}>Actualizar</button>
   </div>
   {error&&<p className="formError" role="alert">{error}</p>}
   {success&&<p className="formSuccess" role="status">{success}</p>}
   {loading?<p className="muted">Cargando avisos…</p>:shown.length===0?<p className="muted">No tienes notificaciones en esta categoría.</p>:
    <div className="notificationList">{shown.map(item=>{
     const post=linkedPosts.find(p=>p.id===item.source_id);
     const target=safeAppLink(post?.link_path)??(post?detectAnnouncementLink(item.message+" "+post.content,[]):null)??noticeLink(item.kind,item.source_id,item.destination);
     const cta=item.kind==="ensayo"?"VER ENSAYO":item.kind==="actuacion"?"VER ACTUACIÓN":item.kind==="votacion"&&item.title.toLowerCase().includes("aportación")?"RESPONDE AQUÍ":actionLabel(target);
     return <article key={item.id} id={"aviso-"+item.id} tabIndex={-1} className={item.read_at?"notificationItem linkedRecord":"notificationItem notificationUnread linkedRecord"}>
      <div className="notificationInfo"><div className="notificationMeta">
       <span className="notificationKind">{label[item.kind]??"Aviso"}</span>
       {!item.read_at&&<span className="notificationDot" aria-label="Sin leer"/>}
       <time dateTime={item.created_at}>{dateTime.format(new Date(item.created_at))}</time>
      </div><h3>{item.title}</h3>{(post?.content||item.message)&&<p className="noticeMessage">{post?.content||item.message}</p>}
       <button className="primaryButton noticeCta" type="button" disabled={busy} onClick={()=>{if(item.read_at)router.push(target);else void mark(item.id,target);}}>{cta}</button>
      </div>
      <div className="notificationActions">
       {!item.read_at&&<button type="button" className="secondaryButton" disabled={busy} onClick={()=>void mark(item.id)}>Marcar leída</button>}
      </div>
     </article>;})}</div>}
   {items.length>=250&&<p className="muted small">Se muestran los 250 avisos más recientes.</p>}
  </section>
 </main>;
}

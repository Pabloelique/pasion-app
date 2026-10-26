"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Notification={id:string;user_id:string;kind:string;source_id:string;title:string;message:string;destination:string;created_at:string;read_at:string|null};
const label:Record<string,string>={ensayo:"Ensayo",actuacion:"Actuación",evento:"Actividad",comunicado:"Comunicado",votacion:"Votación"};
const dateTime=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"});
export default function Notifications({userId}:{userId:string}){
 const db=getSupabaseBrowser();
 const router=useRouter();
 const [items,setItems]=useState<Notification[]>([]);
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
  if(err)setError(err.message);else setItems((data??[]) as Notification[]);
  setLoading(false);
 }
 useEffect(()=>{void load();},[]);
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
  <header className="header"><span className="brandIcon">♧</span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Notificaciones</h1></div></header>
  <p className="muted">Avisos internos para tu cuenta: ensayos, actuaciones, comunicados importantes y nuevas votaciones. Puedes consultarlos al entrar en PASIÓN APP.</p>
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
    <div className="notificationList">{shown.map(item=><article key={item.id} className={item.read_at?"notificationItem":"notificationItem notificationUnread"}>
      <div className="notificationInfo"><div className="notificationMeta">
       <span className="notificationKind">{label[item.kind]??"Aviso"}</span>
       {!item.read_at&&<span className="notificationDot" aria-label="Sin leer"/>}
       <time dateTime={item.created_at}>{dateTime.format(new Date(item.created_at))}</time>
      </div><h3>{item.title}</h3>{item.message&&<p>{item.message}</p>}</div>
      <div className="notificationActions">
       <button className="primaryButton" type="button" disabled={busy} onClick={()=>{if(item.read_at)router.push(item.destination);else void mark(item.id,item.destination);}}>Ver detalle</button>
       {!item.read_at&&<button type="button" className="secondaryButton" disabled={busy} onClick={()=>void mark(item.id)}>Marcar leída</button>}
      </div>
     </article>)}</div>}
   {items.length>=250&&<p className="muted small">Se muestran los 250 avisos más recientes.</p>}
  </section>
 </main>;
}

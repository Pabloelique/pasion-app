"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "@/lib/app-data";
import {useAppDatabase,useDemoMode} from "@/lib/app-data";
import {actionLabel,detectAnnouncementLink,safeAppLink,type LinkChoice} from "@/lib/notice-links";
import {useRecordAnchor} from "@/lib/use-record-anchor";
type Post={link_path:string|null;id:string;title:string;content:string;priority:string;author_id:string;created_at:string};
type Comment={id:string;post_id:string;content:string;author_id:string;created_at:string};
type Person={id:string;display_name:string};
const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"});
export default function BulletinBoard({role,userId}:{role:string;userId:string}){
 const db=useAppDatabase();
 const isDemo=useDemoMode();
 const isBoard=role==="superadmin"||role==="directiva";
 const [posts,setPosts]=useState<Post[]>([]);
 const [comments,setComments]=useState<Comment[]>([]);
 const [people,setPeople]=useState<Person[]>([]);
 const [title,setTitle]=useState("");
 const [content,setContent]=useState("");
 const [priority,setPriority]=useState("normal");
 const [linkMode,setLinkMode]=useState("auto");
 const [choices,setChoices]=useState<LinkChoice[]>([]);
 const [linkError,setLinkError]=useState("");
 const [search,setSearch]=useState("");
 const [writing,setWriting]=useState<Record<string,string>>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 async function reload(){
  setLoading(true);
  const [a,b,p]=await Promise.all([
   db.from("board_posts").select("id,title,content,priority,author_id,created_at,link_path").order("created_at",{ascending:false}).limit(200),
   db.from("board_comments").select("id,post_id,content,author_id,created_at").order("created_at",{ascending:true}).limit(1000),
   db.rpc("board_people")
  ]);
  if(a.error)setError(a.error.message);else setPosts((a.data??[]) as Post[]);
  if(b.error)setError(b.error.message);else setComments((b.data??[]) as Comment[]);
  if(p.error)setError(p.error.message);else setPeople((p.data??[]) as Person[]);
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 useEffect(()=>{
  void Promise.all([
   db.from("march_contests").select("id,title,closes_at").order("created_at",{ascending:false}),
   db.from("march_proposals").select("id,title,closes_at").order("created_at",{ascending:false}),
   db.from("band_events").select("id,title,event_type,starts_at").order("starts_at",{ascending:false})
  ]).then(([a,b,e])=>{
   if(a.error||b.error||e.error)setLinkError("No se pudieron cargar todos los destinos. Puedes elegir una sección o volver a abrir esta página.");
   const votes=[...(a.data??[]),...(b.data??[])].map(v=>({path:"/panel/votaciones#votacion-"+v.id,title:v.title,label:"Votación: "+v.title+" · "+date.format(new Date(v.closes_at))}));
   const events=(e.data??[]).map(v=>({path:"/panel/calendario#evento-"+v.id,title:v.title,label:v.title+" · "+date.format(new Date(v.starts_at))}));
   setChoices([...votes,...events]);
  });
 },[]);
 useRecordAnchor("anuncio-",posts.map(p=>p.id).join(","));
 const detected=detectAnnouncementLink(title+" "+content,choices);
 const destination=linkMode==="auto"?detected:linkMode==="none"?null:safeAppLink(linkMode);

 const names=useMemo(()=>new Map(people.map(p=>[p.id,p.display_name])),[people]);
 const filtered=useMemo(()=>posts.filter(p=>(p.title+" "+p.content).toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))),[posts,search]);
 async function publish(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!isBoard||busy)return;
  if(title.trim().length<3||content.trim().length<3){setError("Escribe un título y un anuncio válidos.");return;}
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("board_posts").insert({title:title.trim(),content:content.trim(),priority,author_id:userId,link_path:destination});
  setBusy(false);
  if(err){setError(err.message);return;}
  setTitle("");setContent("");setPriority("normal");setLinkMode("auto");setSuccess("Comunicado publicado correctamente.");await reload();
 }
 async function sendComment(postId:string){
  const value=writing[postId]?.trim();
  if(!value||busy)return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("board_comments").insert({post_id:postId,author_id:userId,content:value});
  setBusy(false);
  if(err){setError(err.message);return;}
  setWriting(old=>({...old,[postId]:""}));setSuccess("Mensaje enviado.");await reload();
 }
 async function removePost(post:Post){
  if(!isBoard||busy)return;
  if(!window.confirm("¿Eliminar el anuncio «"+post.title+"» y su conversación? Se borrarán también sus avisos de la bandeja. Esta acción no se puede deshacer."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("delete_board_post",{p_post_id:post.id});
  setBusy(false);
  if(err){setError(err.message);return;}
  setPosts(old=>old.filter(p=>p.id!==post.id));
  setComments(old=>old.filter(c=>c.post_id!==post.id));
  setWriting(old=>{const next={...old};delete next[post.id];return next;});
  if(expanded===post.id)setExpanded(null);
  setSuccess("Anuncio eliminado con su conversación y sus avisos.");
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Tablón de anuncios</h1></div></header>
  <p className="muted">Comunicados y conversación interna. Solo los miembros aprobados pueden acceder.</p>
  {isBoard&&<section className="boardComposer">
   <h2>Publicar comunicado</h2>
   <form className="boardForm" onSubmit={e=>void publish(e)}>
    <label>Título<input required maxLength={160} minLength={3} placeholder="Ej. Cambio de horario del ensayo" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Mensaje<textarea required rows={4} maxLength={4000} minLength={3} placeholder="Escribe el comunicado para todos los músicos…" value={content} onChange={e=>setContent(e.target.value)}/></label>
    <label>Importancia<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="importante">Importante</option></select></label>
    <label>Botón dentro del anuncio<select value={linkMode} onChange={e=>setLinkMode(e.target.value)}>
     <option value="auto">Reconocer automáticamente</option><option value="none">Sin botón</option>
     <option value="/panel/votaciones">Votación de nuevas marchas</option><option value="/panel/calendario">Calendario</option><option value="/panel/partituras">Partituras</option><option value="/panel/repertorio">Repertorio</option>
     {choices.map(v=><option key={v.path} value={v.path}>{v.label}</option>)}
    </select></label>
    {linkError&&<p className="muted small">{linkError}</p>}
    <p className="muted small">{destination?"Se añadirá el botón «"+actionLabel(destination)+"». Destino: "+(choices.find(v=>v.path===destination)?.label??destination):"El mensaje se publicará sin botón. Puedes elegir un destino arriba."}</p>
    <button type="submit" disabled={busy} className="primaryButton">{busy?"Publicando…":"Publicar anuncio"}</button>
    <p className="muted small">Todos los anuncios nuevos generan un aviso, tanto normales como importantes. Reciben el aviso al móvil quienes tengan las notificaciones activadas.</p>
   </form>
  </section>}
  <section className="boardFeed">
   <div className="boardHead"><h2>Comunicados recientes</h2><button className="secondaryButton" type="button" onClick={()=>void reload()} disabled={loading}>Actualizar</button></div>
   <label className="boardSearch">Buscar anuncios<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por título o mensaje"/></label>
   {error&&<p role="alert" className="formError">{error}</p>}
   {success&&<p role="status" className="formSuccess">{success}</p>}
   {loading?<p className="muted">Cargando anuncios…</p>:filtered.length===0?<p className="muted">Todavía no hay comunicados con esta búsqueda.</p>:filtered.map(post=>{
    const replies=comments.filter(c=>c.post_id===post.id);
    const postLink=safeAppLink(post.link_path)??detectAnnouncementLink(post.title+" "+post.content,choices);
    return <article className="boardPost linkedRecord" key={post.id} id={"anuncio-"+post.id} tabIndex={-1}>
     <div className="boardPostTop"><span className={post.priority==="importante"?"boardPriority important":"boardPriority"}>{post.priority==="importante"?"IMPORTANTE":"Comunicado"}</span><span className="muted small">{date.format(new Date(post.created_at))}</span></div>
     <h3>{post.title}</h3><p className="boardBody">{post.content}</p>
     {postLink&&<Link className="primaryButton linkButton noticeCta" href={postLink}>{actionLabel(postLink)}</Link>}
     <p className="muted small">Publicado por {names.get(post.author_id)||"Directiva"}</p>
     <button className="boardCommentsButton" type="button" onClick={()=>setExpanded(expanded===post.id?null:post.id)}>{expanded===post.id?"Ocultar conversación":"Ver conversación"} · {replies.length} mensajes</button>
     {isBoard&&<div className="attendanceActions"><button className="secondaryButton" type="button" disabled={busy} onClick={()=>void removePost(post)}>Eliminar anuncio</button></div>}
     {expanded===post.id&&<div className="boardThread">
      {replies.length===0?<p className="muted small">Todavía no hay mensajes.</p>:replies.map(reply=><div className="boardReply" key={reply.id}>
       <div className="boardReplyHeading"><strong>{names.get(reply.author_id)||"Miembro"}</strong><span className="muted small">{date.format(new Date(reply.created_at))}</span></div>
       <p>{reply.content}</p>
      </div>)}
      <form onSubmit={e=>{e.preventDefault();void sendComment(post.id);}} className="boardReplyForm">
       <label>Escribir mensaje<textarea required rows={2} maxLength={1500} value={writing[post.id]??""} onChange={e=>setWriting(old=>({...old,[post.id]:e.target.value}))} placeholder="Responder a este comunicado…"/></label>
       <button disabled={isDemo||busy||!(writing[post.id]??"").trim()} className="primaryButton" type="submit">{busy?"Enviando…":"Enviar respuesta"}</button>
      </form>
     </div>}
    </article>;
   })}
  </section>
 </main>;
}

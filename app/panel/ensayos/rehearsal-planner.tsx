"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "@/lib/app-data";
import {useAppDatabase} from "@/lib/app-data";
type Event={id:string;title:string;starts_at:string;ends_at:string;location:string};
type Piece={id:string;event_id:string;march_title:string;objective:string;progress:string;position:number};
type Score={title:string};
const stages:Record<string,string>={pendiente:"Pendiente",trabajando:"En aprendizaje",mejorando:"Perfeccionando",lista:"Lista para actuar"};
const dateFormat=new Intl.DateTimeFormat("es-ES",{dateStyle:"full",timeStyle:"short"});
export default function RehearsalPlanner({role,userId}:{role:string;userId:string}){
 const db=useAppDatabase();
 const canManage=role==="directiva"||role==="superadmin";
 const [events,setEvents]=useState<Event[]>([]);
 const [eventId,setEventId]=useState("");
 const [pieces,setPieces]=useState<Piece[]>([]);
 const [suggestions,setSuggestions]=useState<string[]>([]);
 const [title,setTitle]=useState("");
 const [objective,setObjective]=useState("");
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [filter,setFilter]=useState("");
 async function reload(){
  setLoading(true);setError("");
  const [ev,pc]=await Promise.all([
   db.from("band_events").select("id,title,starts_at,ends_at,location").eq("event_type","ensayo").order("starts_at",{ascending:false}).limit(150),
   db.from("rehearsal_pieces").select("id,event_id,march_title,objective,progress,position").order("position").limit(2000)
  ]);
  if(ev.error)setError(ev.error.message);else{const all=(ev.data??[]) as Event[];setEvents(all);setEventId(old=>all.some(e=>e.id===old)?old:(all[0]?.id??""));}
  if(pc.error)setError(pc.error.message);else setPieces((pc.data??[]) as Piece[]);
  if(canManage){
   const [scores,full]=await Promise.all([
    db.from("march_scores").select("title").limit(3000),
    db.from("full_scores").select("title").limit(3000)
   ]);
   const values=[...((scores.data??[]) as Score[]),...((full.data??[]) as Score[])].map(x=>x.title.trim()).filter(Boolean);
   setSuggestions([...new Set(values)].sort((a,b)=>a.localeCompare(b,"es")));
  }
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const current=events.find(e=>e.id===eventId);
 const rehearsal=useMemo(()=>pieces.filter(p=>p.event_id===eventId&&p.march_title.toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))).sort((a,b)=>a.position-b.position),[pieces,eventId,filter]);
 const all=pieces.filter(p=>p.event_id===eventId);
 const ready=all.filter(p=>p.progress==="lista").length;
 async function add(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!eventId||!title.trim()||busy)return;
  setBusy("add");setError("");setSuccess("");
  const {error:err}=await db.from("rehearsal_pieces").insert({event_id:eventId,march_title:title.trim(),objective:objective.trim(),position:all.reduce((m,p)=>Math.max(m,p.position),0)+1,created_by:userId});
  setBusy(null);
  if(err){setError(err.message);return;}
  setTitle("");setObjective("");setSuccess("Marcha añadida al plan de ensayo.");await reload();
 }
 async function change(p:Piece,progress:string){
  if(!canManage||busy)return;
  setBusy(p.id);setError("");setSuccess("");
  const {error:err}=await db.from("rehearsal_pieces").update({progress,updated_at:new Date().toISOString()}).eq("id",p.id);
  setBusy(null);
  if(err){setError(err.message);return;}
  setSuccess("Progreso actualizado.");await reload();
 }
 async function remove(p:Piece){
  if(!canManage||busy)return;
  if(!window.confirm("¿Quitar «"+p.march_title+"» de este ensayo? No se eliminará ninguna partitura."))return;
  setBusy(p.id);setError("");setSuccess("");
  const {error:err}=await db.from("rehearsal_pieces").delete().eq("id",p.id);
  setBusy(null);
  if(err){setError(err.message);return;}
  setSuccess("Marcha retirada del plan de ensayo.");await reload();
 }
 return <main className="container">
  <Link className="backLink" href="/panel">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Ensayos y repertorio</h1></div></header>
  <p className="muted">Prepara el repertorio de cada ensayo y consulta el progreso de las marchas. Los archivos siguen protegidos en la biblioteca de partituras.</p>
  <section className="rehearsalCard">
   <div className="rehearsalHead"><h2>Seleccionar ensayo</h2><Link href="/panel/calendario" className="secondaryButton linkButton">Calendario</Link></div>
   <label className="rehearsalLabel">Ensayo del calendario<select value={eventId} onChange={e=>{setEventId(e.target.value);setFilter("");setError("");}}>
    {events.length===0?<option value="">Todavía no hay ensayos creados</option>:events.map(ev=><option value={ev.id} key={ev.id}>{ev.title} · {new Date(ev.starts_at).toLocaleDateString("es-ES")}</option>)}
   </select></label>
   {current&&<p className="muted">{dateFormat.format(new Date(current.starts_at))}{current.location?" · "+current.location:""}</p>}
   {current&&<p className="rehearsalSummary">{all.length} marchas planificadas · {ready} preparadas para actuar</p>}
  </section>
  {canManage&&current&&<section className="rehearsalCard">
   <h2>Añadir marcha al ensayo</h2>
   <form onSubmit={e=>void add(e)} className="rehearsalForm">
    <label className="rehearsalLabel">Marcha<input list="rehearsal-titles" minLength={2} maxLength={180} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Elige una de la biblioteca o escribe una nueva"/><datalist id="rehearsal-titles">{suggestions.map((v,i)=><option value={v} key={i}/>)}</datalist></label>
    <label className="rehearsalLabel">Objetivo del ensayo<textarea rows={3} maxLength={1000} value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Ej. Repasar el trío y ajustar la afinación"/></label>
    <button type="submit" className="primaryButton" disabled={busy!==null}>Añadir al plan</button>
   </form>
  </section>}
  <section className="rehearsalCard">
   <div className="rehearsalHead"><h2>Plan de trabajo</h2><button className="secondaryButton" disabled={loading} onClick={()=>void reload()}>Actualizar</button></div>
   <label className="rehearsalLabel">Buscar marcha<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nombre de la marcha"/></label>
   {error&&<p role="alert" className="formError">{error}</p>}
   {success&&<p role="status" className="formSuccess">{success}</p>}
   {loading?<p className="muted">Cargando plan…</p>:!current?<p className="muted">Crea primero un ensayo desde el calendario.</p>:rehearsal.length===0?<p className="muted">No hay marchas planificadas para este ensayo.</p>:<div className="rehearsalList">
    {rehearsal.map(p=><article className="rehearsalItem" key={p.id}>
      <div><strong>{p.march_title}</strong><p className="muted small">{p.objective||"Sin objetivo específico"}</p>
       <Link href="/panel/partituras" className="rehearsalLink">Consultar biblioteca de partituras</Link>
      </div>
      <div className="rehearsalControls">{canManage?<label className="rehearsalLabel">Progreso<select disabled={busy!==null} value={p.progress} onChange={e=>void change(p,e.target.value)}>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>:<span className="rehearsalStage">{stages[p.progress]??p.progress}</span>}
       {canManage&&<button type="button" disabled={busy!==null} className="rehearsalRemove" onClick={()=>void remove(p)}>Quitar del ensayo</button>}
      </div>
    </article>)}
   </div>}
  </section>
 </main>;
}
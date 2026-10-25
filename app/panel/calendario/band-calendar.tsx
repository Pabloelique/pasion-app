"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Event={id:string;title:string;event_type:string;description:string;location:string;starts_at:string;ends_at:string};
type Response={event_id:string;response:string;justification:string|null};
const types:{[key:string]:string}={ensayo:"Ensayo",actuacion:"Actuación",reunion:"Reunión",otro:"Otro"};
const weekdays=["L","M","X","J","V","S","D"];
const fmt=new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric"});
const tm=new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit"});
const dateKey=(dt:Date)=>[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,"0"),String(dt.getDate()).padStart(2,"0")].join("-");
const today=new Date();
const initialMonth=new Date(today.getFullYear(),today.getMonth(),1);
const prettyMonth=(d:Date)=>new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(d);
export default function BandCalendar({role}:{role:string}){
 const db=getSupabaseBrowser();
 const manager=role==="directiva"||role==="superadmin";
 const [month,setMonth]=useState(initialMonth);
 const [events,setEvents]=useState<Event[]>([]);
 const [answers,setAnswers]=useState<Response[]>([]);
 const [selected,setSelected]=useState<Event|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [creating,setCreating]=useState(false);
 const [busy,setBusy]=useState(false);
 const [title,setTitle]=useState("");
 const [kind,setKind]=useState("ensayo");
 const [starts,setStarts]=useState("");
 const [ends,setEnds]=useState("");
 const [place,setPlace]=useState("");
 const [details,setDetails]=useState("");
 const [reply,setReply]=useState("");
 const [reason,setReason]=useState("");
 async function reload(){
  setLoading(true);setError("");
  const start=new Date(month.getFullYear(),month.getMonth(),1);
  const end=new Date(month.getFullYear(),month.getMonth()+1,1);
  const [e,a]=await Promise.all([
   db.from("band_events").select("id,title,event_type,description,location,starts_at,ends_at").gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString()).order("starts_at"),
   db.from("event_responses").select("event_id,response,justification")
  ]);
  if(e.error)setError(e.error.message);else setEvents((e.data??[]) as Event[]);
  if(a.error)setError(a.error.message);else setAnswers((a.data??[]) as Response[]);
  setLoading(false);
 }
 useEffect(()=>{void reload();},[month]);
 const days=useMemo(()=>{
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  return [...Array(offset).fill(null),...Array.from({length:count},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1))] as (Date|null)[];
 },[month]);
 const grouped=useMemo(()=>{const m=new Map<string,Event[]>();events.forEach(e=>{const k=dateKey(new Date(e.starts_at));m.set(k,[...(m.get(k)??[]),e]);});return m;},[events]);
 const selectedAnswer=selected?answers.find(r=>r.event_id===selected.id):undefined;
 function choose(e:Event){setSelected(e);const r=answers.find(a=>a.event_id===e.id);setReply(r?.response??"");setReason(r?.justification??"");setMessage("");setError("");}
 function move(delta:number){setSelected(null);setMonth(old=>new Date(old.getFullYear(),old.getMonth()+delta,1));}
 async function create(ev:React.FormEvent<HTMLFormElement>){
  ev.preventDefault();setError("");setMessage("");
  const from=new Date(starts),to=new Date(ends);
  if(!starts||!ends||!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from){setError("La fecha de finalización debe ser posterior al inicio.");return;}
  setBusy(true);
  const result=await db.from("band_events").insert({title:title.trim(),event_type:kind,description:details.trim(),location:place.trim(),starts_at:from.toISOString(),ends_at:to.toISOString()});
  setBusy(false);
  if(result.error){setError(result.error.message);return;}
  setCreating(false);setTitle("");setStarts("");setEnds("");setPlace("");setDetails("");
  setMessage("Evento creado correctamente.");
  setMonth(new Date(from.getFullYear(),from.getMonth(),1));await reload();
 }
 async function respond(){
  if(!selected||!reply)return;
  if(reply==="no_asistire"&&reason.trim().length<5){setError("Escribe una justificación de al menos 5 caracteres.");return;}
  setBusy(true);setError("");setMessage("");
  const result=await db.from("event_responses").upsert({event_id:selected.id,response:reply,justification:reply==="no_asistire"?reason.trim():null,updated_at:new Date().toISOString()},{onConflict:"event_id,user_id"});
  setBusy(false);
  if(result.error){setError(result.error.message);return;}
  setMessage("Tu respuesta se ha guardado.");
  const a=await db.from("event_responses").select("event_id,response,justification");
  if(!a.error)setAnswers((a.data??[]) as Response[]);
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon">▦</span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Calendario</h1></div></header>
  <p className="muted">Ensayos, actuaciones y reuniones de la agrupación. Puedes navegar por cualquier mes y responder a los eventos.</p>
  {manager&&<div className="attendanceActions"><button className="primaryButton" type="button" onClick={()=>{setCreating(!creating);setError("");}}>+ Crear evento</button><Link href="/panel/asistencia" className="secondaryButton linkButton">Pasar lista →</Link></div>}
  {creating&&<section className="calendarForm"><h2>Nuevo evento</h2><form className="scoreForm" onSubmit={e=>void create(e)}>
   <label>Título<input required minLength={3} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Ensayo general"/></label>
   <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(types).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Inicio<input type="datetime-local" value={starts} required onChange={e=>setStarts(e.target.value)}/></label>
   <label>Final<input type="datetime-local" value={ends} required onChange={e=>setEnds(e.target.value)}/></label>
   <label>Lugar<input value={place} onChange={e=>setPlace(e.target.value)} maxLength={200} placeholder="Local de ensayo"/></label>
   <label>Detalles<textarea value={details} onChange={e=>setDetails(e.target.value)} rows={3} placeholder="Indicaciones para los músicos"/></label>
   <button disabled={busy} className="primaryButton" type="submit">{busy?"Guardando…":"Guardar evento"}</button>
  </form></section>}
  <section className="calendarBox"><div className="calendarHeading">
   <button type="button" aria-label="Mes anterior" onClick={()=>move(-1)}>‹</button><h2>{prettyMonth(month)}</h2><button type="button" aria-label="Mes siguiente" onClick={()=>move(1)}>›</button>
  </div><div className="calendarDays">{weekdays.map(w=><span key={w}>{w}</span>)}</div>
  <div className="calendarDays calendarCells">{days.map((d,i)=>{
   if(!d)return <div key={"empty"+i} className="calendarEmpty"/>;
   const items=grouped.get(dateKey(d))??[];
   return <div key={dateKey(d)} className={"calendarDay "+(dateKey(d)===dateKey(new Date())?"calendarToday":"")}>
    <span>{d.getDate()}</span><div className="calendarEvents">{items.map(item=><button type="button" key={item.id} title={item.title} onClick={()=>choose(item)} className={"calendarEvent calendar-"+item.event_type}>{item.title}</button>)}</div>
   </div>;
  })}</div>
  </section>
  {loading&&<p className="muted">Cargando eventos…</p>}
  {!loading&&events.length===0&&<p className="muted">No hay eventos programados en este mes.</p>}
  {error&&<p className="formError" role="alert">{error}</p>}
  {message&&<p className="formSuccess" role="status">{message}</p>}
  {selected&&<section className="calendarDetail">
   <div className="calendarDetailTop"><span className="eyebrow">{types[selected.event_type]}</span><button type="button" className="secondaryButton" onClick={()=>setSelected(null)}>Cerrar</button></div>
   <h2>{selected.title}</h2>
   <p><strong>Inicio:</strong> {fmt.format(new Date(selected.starts_at))} a las {tm.format(new Date(selected.starts_at))}</p>
   <p><strong>Final:</strong> {fmt.format(new Date(selected.ends_at))} a las {tm.format(new Date(selected.ends_at))}</p>
   {selected.location&&<p><strong>Lugar:</strong> {selected.location}</p>}
   {selected.description&&<p>{selected.description}</p>}
   <h3>Mi asistencia</h3><p className="muted">{selectedAnswer?"Respuesta registrada: "+(selectedAnswer.response==="asistire"?"Asistiré":"No asistiré"):"Todavía no has respondido."}</p>
   <div className="calendarChoices"><label><input type="radio" name="response" checked={reply==="asistire"} onChange={()=>setReply("asistire")}/> Asistiré</label>
   <label><input type="radio" name="response" checked={reply==="no_asistire"} onChange={()=>setReply("no_asistire")}/> No asistiré</label></div>
   {reply==="no_asistire"&&<label className="calendarReason">Justificación de ausencia<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} minLength={5} placeholder="Explica el motivo de tu ausencia"/></label>}
   <button type="button" className="primaryButton" disabled={busy||!reply} onClick={()=>void respond()}>{busy?"Guardando…":"Guardar mi respuesta"}</button>
  </section>}
  <section className="calendarAgenda"><h2>Próximos eventos del mes</h2>{events.map(e=><button key={e.id} type="button" onClick={()=>choose(e)} className="calendarAgendaItem"><span>{fmt.format(new Date(e.starts_at))} · {tm.format(new Date(e.starts_at))}</span><strong>{e.title}</strong><small>{types[e.event_type]}{e.location?" · "+e.location:""}</small></button>)}</section>
 </main>;
}

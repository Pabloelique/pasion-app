"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Event={id:string;title:string;event_type:string;starts_at:string;cancelled_at:string|null};
type Member={member_id:string;member_name:string;part_name:string;response:string|null;justification:string|null;attendance:string|null;note:string|null};
type Audit={audit_id:number;member_name:string;actor_name:string;previous_status:string|null;current_status:string;previous_note:string|null;current_note:string|null;changed_at:string};
type Totals={member_id:string;member_name:string;part_name:string;attended:number;absent:number;justified:number};
const dateFormat=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"});
const labels:Record<string,string>={presente:"Presente",ausente:"Ausente",justificada:"Justificada"};
export default function AttendanceBoard(){
 const db=getSupabaseBrowser();
 const [events,setEvents]=useState<Event[]>([]);
 const [eventId,setEventId]=useState("");
 const [people,setPeople]=useState<Member[]>([]);
 const [totals,setTotals]=useState<Totals[]>([]);
 const [filter,setFilter]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [note,setNote]=useState("");
 const [state,setState]=useState("presente");
 const [showTotals,setShowTotals]=useState(false);
 const [showAudit,setShowAudit]=useState(false);
 const [audits,setAudits]=useState<Audit[]>([]);
 async function loadEvents(){
   setLoading(true);
   const {data,error:err}=await db.from("band_events").select("id,title,event_type,starts_at,cancelled_at").is("cancelled_at",null).order("starts_at",{ascending:false}).limit(150);
   if(err)setError(err.message);else {const all=(data??[]) as Event[];setEvents(all);setEventId(old=>all.some(e=>e.id===old)?old:(all[0]?.id||""));}
   setLoading(false);
 }
 async function loadRoster(id:string){
   if(!id){setPeople([]);return;}
   setLoading(true);setError("");
   const {data,error:err}=await db.rpc("attendance_roster",{target_event:id});
   if(err)setError(err.message);else setPeople((data??[]) as Member[]);
   setLoading(false);
 }
 async function loadAudit(id:string){if(!id)return;const {data,error:err}=await db.rpc("attendance_event_audit",{target_event:id});if(err)setError(err.message);else setAudits((data??[]) as Audit[]);}
 async function loadTotals(){
   const {data,error:err}=await db.rpc("attendance_summary");
   if(err)setError(err.message);else setTotals((data??[]) as Totals[]);
 }
 useEffect(()=>{void loadEvents();},[]);
 useEffect(()=>{void loadRoster(eventId);if(showAudit)void loadAudit(eventId);},[eventId]);
 const visible=useMemo(()=>people.filter(p=>(p.member_name+" "+p.part_name).toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))),[people,filter]);
 const present=people.filter(p=>p.attendance==="presente").length;
 const absent=people.filter(p=>p.attendance==="ausente").length;
 const justified=people.filter(p=>p.attendance==="justificada").length;
 function edit(p:Member){setEditing(p.member_id);setState(p.attendance??"presente");setNote(p.note??"");setError("");setSuccess("");}
 async function save(p:Member){
   if(!eventId)return;
   setBusy(p.member_id);setError("");setSuccess("");
   const {error:err}=await db.rpc("record_attendance",{target_event:eventId,target_member:p.member_id,attendance_status:state,manager_note:note.trim()||null});
   setBusy(null);
   if(err){setError(err.message);return;}
   setEditing(null);setSuccess("Asistencia registrada para "+(p.member_name||"miembro")+".");
   await loadRoster(eventId);
   if(showTotals)await loadTotals();
   if(showAudit)await loadAudit(eventId);
 }
 return <main className="container">
  <Link className="backLink" href="/panel/calendario">← Volver al calendario</Link>
  <header className="header"><span className="brandIcon">✓</span><div><small>DIRECTIVA · LA PASIÓN DE MAZARRÓN</small><h1>Pasar lista</h1></div></header>
  <p className="muted">Solo aparecen los músicos convocados al evento. En un ensayo de cornetas, la lista incluye únicamente a los cornetas. Los ensayos cancelados no permiten pasar lista.</p>
  <section className="attendanceSelect">
   <label>Evento<select value={eventId} onChange={e=>{setEventId(e.target.value);setEditing(null);setSuccess("");}}>
    {events.length===0?<option value="">No hay eventos disponibles</option>:events.map(e=><option value={e.id} key={e.id}>{e.title} · {dateFormat.format(new Date(e.starts_at))}</option>)}
   </select></label>
   <label>Buscar músico<input value={filter} placeholder="Nombre o instrumento" onChange={e=>setFilter(e.target.value)}/></label>
  </section>
  {error&&<p className="formError" role="alert">{error}</p>}
  {success&&<p className="formSuccess" role="status">{success}</p>}
  {loading?<p className="muted">Cargando lista…</p>:!eventId?<p className="muted">Crea primero un evento desde el calendario.</p>:<>
    <div className="attendanceStats"><span><strong>{present}</strong> presentes</span><span><strong>{absent}</strong> ausentes</span><span><strong>{justified}</strong> justificadas</span><span><strong>{people.length-present-absent-justified}</strong> sin pasar lista</span></div>
    <div className="attendanceMembers">{visible.map(p=><article className="attendanceMember" key={p.member_id}>
     <div><strong>{p.member_name||"Miembro sin nombre"}</strong><p className="muted small">{p.part_name} · {p.response==="asistire"?"Confirmó asistencia":p.response==="no_asistire"?"Avisó que faltará":"Sin respuesta previa"}</p>
      {p.justification&&<p className="attendanceJustification">Justificación comunicada: {p.justification}</p>}
      <p className="muted small">Asistencia real: <b>{p.attendance?labels[p.attendance]: "Sin registrar"}</b>{p.note?" · "+p.note:""}</p>
     </div>
     {editing===p.member_id?<div className="attendanceEdit">
      <label>Resultado<select value={state} onChange={e=>setState(e.target.value)}><option value="presente">Presente</option><option value="ausente">Ausente</option><option value="justificada">Ausencia justificada</option></select></label>
      <label>Nota de directiva<textarea rows={2} maxLength={1000} placeholder="Opcional" value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div className="attendanceActions"><button className="primaryButton" disabled={busy===p.member_id} onClick={()=>void save(p)}>{busy===p.member_id?"Guardando…":"Guardar"}</button><button className="secondaryButton" disabled={busy===p.member_id} onClick={()=>setEditing(null)}>Cancelar</button></div>
     </div>:<button className="secondaryButton" onClick={()=>edit(p)}>{p.attendance?"Corregir":"Pasar lista"}</button>}
    </article>)}</div>
  </>}
  <section className="attendanceReport"><h2>Historial de correcciones</h2>
   <p className="muted small">Solo directiva. Registro de cambios de asistencia del evento seleccionado, con fecha y responsable.</p>
   <button className="secondaryButton" type="button" disabled={!eventId} onClick={()=>{setShowAudit(v=>!v);if(!showAudit)void loadAudit(eventId);}}>{showAudit?"Ocultar correcciones":"Consultar correcciones"}</button>
   {showAudit&&<div className="attendanceMembers">{audits.length===0?<p className="muted">No constan correcciones registradas para este evento.</p>:audits.map(item=><article className="attendanceMember" key={item.audit_id}>
    <div><strong>{item.member_name}</strong><p className="muted small">{dateFormat.format(new Date(item.changed_at))} · {item.actor_name}</p></div>
    <div><strong>{item.previous_status?labels[item.previous_status]??item.previous_status:"Sin registro"}</strong> → <strong>{labels[item.current_status]??item.current_status}</strong>
    {item.current_note&&<p className="muted small">Nota: {item.current_note}</p>}</div>
   </article>)}</div>}
  </section>
  <section className="attendanceReport"><h2>Resumen acumulado</h2>
   <button className="secondaryButton" onClick={()=>{setShowTotals(v=>!v);if(!showTotals)void loadTotals();}}>{showTotals?"Ocultar resumen":"Ver faltas registradas"}</button>
   {showTotals&&<div className="attendanceMembers">{totals.map(p=><article key={p.member_id} className="attendanceMember"><div><strong>{p.member_name}</strong><p className="muted small">{p.part_name}</p></div><div><strong>{p.attended}</strong> presentes · <strong>{p.absent}</strong> ausencias · <strong>{p.justified}</strong> justificadas</div></article>)}</div>}
  </section>
 </main>;
}
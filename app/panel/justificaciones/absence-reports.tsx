"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {validId} from "@/lib/notice-links";
import {useRecordAnchor} from "@/lib/use-record-anchor";
type Report={report_id:string;event_id:string;event_title:string;event_starts_at:string;member_name:string;justification:string|null;response:string;updated_at:string};
const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"});
export default function AbsenceReports(){
 const [rows,setRows]=useState<Report[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");setRows([]);
  const db=getSupabaseBrowser(),result=await db.rpc("private_absence_reports");
  if(result.error){setError("No se pueden consultar las justificaciones o ya no tienes permiso.");setLoading(false);return;}
  const reports=(result.data??[]) as Report[];
  const linked=window.location.hash.startsWith("#falta-")?window.location.hash.slice(7):"";
  if(validId(linked)&&!reports.some(r=>r.report_id===linked)){
   const exact=await db.rpc("private_absence_reports",{target_response:linked});
   if(exact.error)setError("No se pudo cargar la justificación enlazada.");
   else if(exact.data?.length)reports.unshift(...exact.data as Report[]);
   else setError("La respuesta enlazada ya no está disponible.");
  }
  setRows(reports);setLoading(false);
 }
 useEffect(()=>{void load();window.addEventListener("hashchange",load);return()=>window.removeEventListener("hashchange",load);},[]);
 useRecordAnchor("falta-",loading?"":rows.map(r=>r.report_id).join(","));
 return <main className="container">
  <Link className="backLink" href="/panel">← Volver al panel</Link>
  <header className="header"><span className="brandIcon">✓</span><div><small>ACCESO PRIVADO</small><h1>Justificaciones de ausencia</h1></div></header>
  <p className="muted">Solo el superadmin y la persona autorizada pueden consultar estos motivos. Se muestran las 500 respuestas de ausencia más recientes de eventos no cancelados.</p>
  <button className="secondaryButton" type="button" disabled={loading} onClick={()=>void load()}>Actualizar</button>
  {error&&<p className="formError" role="alert">{error}</p>}
  {loading?<p className="muted">Cargando justificaciones…</p>:rows.length===0?<p className="muted">Todavía no hay avisos de ausencia.</p>:<div className="attendanceMembers">{rows.map(r=><article key={r.report_id} id={"falta-"+r.report_id} tabIndex={-1} className="requestCard linkedRecord">
   <h2>{r.member_name||"Miembro"}</h2><h3>{r.event_title}</h3>
   <p className="muted">{date.format(new Date(r.event_starts_at))} · {r.response==="no_asistire"?"Avisó que faltará":"Ha retirado el aviso: asistirá"}</p>
   {r.response==="no_asistire"&&<p className="noticeMessage"><strong>Justificación: </strong>{r.justification}</p>}
   <p className="muted small">Actualizada: {date.format(new Date(r.updated_at))}</p>
   <Link className="secondaryButton linkButton" href={"/panel/calendario#evento-"+r.event_id}>Ver evento</Link>
  </article>)}</div>}
 </main>;
}

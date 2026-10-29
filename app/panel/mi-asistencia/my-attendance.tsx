"use client";
import {useEffect,useState} from "react";
import Link from "@/lib/app-data";
import {useAppDatabase} from "@/lib/app-data";
type RecordItem={event_id:string;event_title:string;event_starts_at:string;attendance_status:string;marked_at:string};
const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"});
const labels:Record<string,string>={presente:"Presente",ausente:"Ausente",justificada:"Ausencia justificada"};
export default function MyAttendance(){
 const db=useAppDatabase();
 const [rows,setRows]=useState<RecordItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 async function reload(){
  setLoading(true);setError("");
  const {data,error:err}=await db.rpc("my_attendance_history");
  if(err)setError(err.message);else setRows((data??[]) as RecordItem[]);
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const n=(status:string)=>rows.filter(x=>x.attendance_status===status).length;
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon">✓</span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Mi asistencia</h1></div></header>
  <p className="muted">Consulta tus asistencias registradas por la directiva. Un evento sin lista pasada no cuenta como falta.</p>
  <div className="attendanceStats"><span><strong>{n("presente")}</strong> presentes</span><span><strong>{n("ausente")}</strong> ausencias</span><span><strong>{n("justificada")}</strong> justificadas</span></div>
  <button className="secondaryButton" disabled={loading} onClick={()=>void reload()}>Actualizar historial</button>
  {error&&<p className="formError" role="alert">{error}</p>}
  {loading?<p className="muted">Cargando tu historial…</p>:rows.length===0?<p className="muted">Aún no hay asistencias registradas para tu cuenta.</p>:
   <div className="attendanceMembers">{rows.map(r=><article className="attendanceMember" key={r.event_id}>
    <div><strong>{r.event_title}</strong><p className="muted small">{date.format(new Date(r.event_starts_at))}</p></div>
    <span className="attendanceStatus">{labels[r.attendance_status]??r.attendance_status}</span>
   </article>)}</div>}
 </main>;
}
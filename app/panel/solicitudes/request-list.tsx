"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";
type Request = {id:string;first_name:string;last_name:string;email:string;requested_role:string;musical_part:string|null;created_at:string};
export default function RequestList({ role }: {role:string}) {
  const [items,setItems] = useState<Request[]>([]);
  const [loading,setLoading] = useState(true);
  const [working,setWorking] = useState<string|null>(null);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  async function load() {
    setError("");setLoading(true);
    try {
      const { data,error } = await getSupabaseBrowser().rpc("pending_registration_requests");
      if(error) throw error;
      setItems((data ?? []) as Request[]);
    } catch (e) {setError(e instanceof Error?e.message:"No se pudieron obtener las solicitudes.");}
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function decide(item:Request,decision:"approved"|"rejected") {
    const action=decision==="approved"?"aprobar":"rechazar";
    if (!window.confirm(`¿Quieres ${action} la solicitud de ${item.first_name} ${item.last_name} (${item.requested_role})?`))return;
    setError("");setSuccess("");setWorking(item.id);
    try {
      const {error}=await getSupabaseBrowser().rpc("decide_registration",{target_user:item.id,decision});
      if(error)throw error;
      setItems(prev=>prev.filter(p=>p.id!==item.id));
      setSuccess(`Solicitud de ${item.first_name} ${decision==="approved"?"aprobada":"rechazada"} correctamente.`);
    }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar la decisión.");}
    finally{setWorking(null);}
  }
  const musicians=items.filter(i=>i.requested_role==="musico");
  const board=items.filter(i=>i.requested_role==="directiva");
  function renderGroup(title:string,people:Request[]) {
    return <section className="requestsSection"><h2>{title} <span className="count">{people.length}</span></h2>
      {people.length===0?<p className="muted">No hay solicitudes pendientes.</p>:<div className="requestGrid">{people.map(item=><article className="requestCard" key={item.id}>
        <div className="requestMeta"><strong>{item.first_name} {item.last_name}</strong><span>{item.musical_part || "Sin hilo asignado"}</span></div>
        <p className="emailText">{item.email}</p><p className="muted small">Solicitado: {new Date(item.created_at).toLocaleDateString("es-ES",{dateStyle:"medium"})}</p>
        <div className="requestActions">
          <button className="primaryButton" disabled={working!==null} onClick={()=>void decide(item,"approved")}>{working===item.id?"Procesando…":"Aprobar"}</button>
          <button className="secondaryButton" disabled={working!==null} onClick={()=>void decide(item,"rejected")}>Rechazar</button>
        </div></article>)}</div>}
    </section>;
  }
  return <main className="container">
    <Link className="backLink" href="/panel">← Volver a mi panel</Link>
    <header className="header"><span className="brandIcon">♙</span><div><small>ADMINISTRACIÓN · PASIÓN APP</small><h1>Solicitudes de acceso</h1></div></header>
    <p className="muted">Revisa las solicitudes antes de dar acceso a los contenidos privados de la agrupación.</p>
    <div className="requestToolbar"><span>{loading?"Cargando…":`${items.length} solicitudes pendientes`}</span><button className="secondaryButton" onClick={()=>void load()} disabled={loading||working!==null}>Actualizar</button></div>
    {error&&<p role="alert" className="formError">{error.includes("function")?"Falta activar las funciones de aprobación en Supabase. Ejecuta la migración SQL.":error}</p>}
    {success&&<p role="status" className="formSuccess">{success}</p>}
    {!loading&&<>{renderGroup("Músicos",musicians)}{role==="superadmin"&&renderGroup("Solicitudes de directiva",board)}</>}
    <p className="muted helpText">Solo el superadmin puede aprobar o rechazar solicitudes de directiva. Las comprobaciones se realizan en Supabase, no únicamente en esta pantalla.</p>
  </main>;
}

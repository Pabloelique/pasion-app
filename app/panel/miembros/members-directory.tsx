"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";

type Member = {id:string;first_name:string;last_name:string;email:string;musical_part_id:number|null;musical_part:string|null;role:string;requested_role:string;approval_status:string;created_at:string};
type ViewerAccess={id:string;requested_at:string|null;expires_at:string|null};
type Part = {id:number;name:string};
type Audit = {action:string;created_at:string;actor_name:string;before_state:unknown;after_state:unknown};

const states:Record<string,string>={pending:"Pendiente",approved:"Aprobado",rejected:"Rechazado",suspended:"Suspendido",demo:"Demostración"};
const roles:Record<string,string>={musico:"Músico",directiva:"Directiva",superadmin:"Superadmin",viewer:"Viewer · Demostración"};
export default function MembersDirectory({role}:{role:string}){
  const [members,setMembers]=useState<Member[]>([]);
  const [viewerAccess,setViewerAccess]=useState<ViewerAccess[]>([]);
  const [now,setNow]=useState(Date.now());
  const [parts,setParts]=useState<Part[]>([]);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [part,setPart]=useState("all");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [audit,setAudit]=useState<Audit[]|null>(null);
  const [auditName,setAuditName]=useState("");

  async function load(){
    setError("");setLoading(true);
    try{
      const db=getSupabaseBrowser();
      const [users,hilos,viewers]=await Promise.all([
        db.rpc("member_directory"),
        db.from("musical_parts").select("id,name").order("id"),
        role==="superadmin"?db.rpc("viewer_access_directory"):Promise.resolve({data:[],error:null})
      ]);
      if(users.error)throw users.error;
      if(hilos.error)throw hilos.error;
      if(viewers.error)throw viewers.error;
      setViewerAccess((viewers.data??[]) as ViewerAccess[]);setNow(Date.now());
      setMembers(((users.data??[]) as Member[]).filter(m=>role==="superadmin"||m.role!=="viewer"));
      setParts((hilos.data??[]) as Part[]);
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron consultar los miembros.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const filtered=useMemo(()=>members.filter(m=>{
    const q=search.trim().toLocaleLowerCase("es");
    return (!q||[m.first_name,m.last_name,m.email,m.musical_part??""].join(" ").toLocaleLowerCase("es").includes(q))
      &&(status==="all"||m.approval_status===status)
      &&(part==="all"||String(m.musical_part_id)===part);
  }),[members,search,status,part]);
  async function modify(m:Member,op:string,value:string|null=null){
    const labels:Record<string,string>={reactivate:"reactivar",suspend:"suspender",assign_part:"cambiar el hilo de",promote:"nombrar directivo a",demote:"retirar de directiva a"};
    if(!window.confirm(`¿Confirmas ${labels[op]??op} ${m.first_name} ${m.last_name}?`))return;
    setBusy(m.id);setError("");setSuccess("");
    try{
      const {error}=await getSupabaseBrowser().rpc("manage_member",{target_user:m.id,operation:op,new_value:value});
      if(error)throw error;
      setSuccess("Cambio realizado y guardado en el historial de auditoría.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"No se ha podido modificar la cuenta.");}
    finally{setBusy("");}
  }
  async function manageViewer(m:Member,operation:"assign"|"approve"|"revoke"){
    const labels={assign:"convertir esta cuenta en viewer sin acceso a datos reales",approve:"autorizar una visita de 15 minutos desde ahora",revoke:"bloquear la visita de demostración"};
    if(!window.confirm("¿Confirmas "+labels[operation]+" para "+m.first_name+" "+m.last_name+"?"))return;
    setBusy(m.id);setError("");setSuccess("");
    const {error:err}=await getSupabaseBrowser().rpc("manage_viewer_access",{target_user:m.id,operation});
    setBusy("");
    if(err){setError(err.message);return;}
    await load();setSuccess(operation==="approve"?"Visita autorizada durante 15 minutos. Al caducar necesitará otra autorización manual.":operation==="assign"?"Cuenta viewer preparada. Debes autorizar sus 15 minutos con el botón de su ficha.":"Acceso viewer bloqueado.");
  }
  async function history(m:Member){
    setAudit(null);setAuditName(`${m.first_name} ${m.last_name}`);
    try{
      const {data,error}=await getSupabaseBrowser().rpc("member_audit_history",{target_user:m.id});
      if(error)throw error;
      setAudit((data??[]) as Audit[]);
    }catch(e){setError(e instanceof Error?e.message:"No se pudo consultar la auditoría.");}
  }
  return <main className="container">
    <Link href="/panel" className="backLink">← Volver al panel</Link>
    <header className="header"><span className="brandIcon">♙</span><div><small>DIRECTIVA · PASIÓN APP</small><h1>Gestión de miembros</h1></div></header>
    <p className="muted">Consulta músicos, revisa su estado y administra sus permisos según tu rol. Cada modificación se verifica en Supabase.</p>
    {role==="superadmin"&&<p><Link className="secondaryButton linkButton" href="/demo">Ver demostración sin datos reales</Link></p>}
    <div className="memberStats"><div><strong>{members.length}</strong><span>Miembros</span></div><div><strong>{members.filter(m=>m.approval_status==="approved").length}</strong><span>Aprobados</span></div><div><strong>{members.filter(m=>m.approval_status==="pending").length}</strong><span>Pendientes</span></div></div>
    <div className="memberFilters"><label>Buscar<input aria-label="Buscar miembros" value={search} placeholder="Nombre, correo, instrumento…" onChange={e=>setSearch(e.target.value)}/></label><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option>{Object.entries(states).filter(([k])=>role==="superadmin"||k!=="demo").map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Instrumento<select value={part} onChange={e=>setPart(e.target.value)}><option value="all">Todos los hilos</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    <div className="requestToolbar"><span>{loading?"Cargando…":`${filtered.length} resultados`}</span><button className="secondaryButton" disabled={loading||Boolean(busy)} onClick={()=>void load()}>Actualizar</button></div>
    {error&&<p className="formError" role="alert">{error}</p>}
    {success&&<p className="formSuccess" role="status">{success}</p>}
    {!loading&&<div className="requestGrid">{filtered.map(m=>{
      const locked=Boolean(busy);
      const visit=viewerAccess.find(v=>v.id===m.id);
      const viewerActive=m.role==="viewer"&&m.approval_status==="demo"&&Boolean(visit?.expires_at&&Date.parse(visit.expires_at)>now);
      const canManage=role==="superadmin"||(m.role==="musico"&&m.requested_role!=="directiva");
      return <article className="requestCard" key={m.id}>
        <div className="memberHeader"><strong>{m.first_name} {m.last_name}</strong><span className="memberTag">{states[m.approval_status]??m.approval_status}</span></div>
        <p className="emailText">{m.email}</p><p className="muted small">{roles[m.role]??m.role} · {m.musical_part??"Sin hilo asignado"}</p>
        <p className="muted small">Alta: {new Date(m.created_at).toLocaleDateString("es-ES")}</p>
        {m.role==="viewer"&&role==="superadmin"&&<div className="notice">
          <p><strong>{viewerActive?"Visita activa hasta "+new Date(visit!.expires_at!).toLocaleTimeString("es-ES"):"Sin visita activa: requiere tu autorización"}</strong></p>
          {visit?.requested_at&&<p className="muted small">Última solicitud: {new Date(visit.requested_at).toLocaleString("es-ES")}</p>}
          <button type="button" className="primaryButton" disabled={locked||viewerActive} onClick={()=>void manageViewer(m,"approve")}>Autorizar 15 minutos</button>
          {viewerActive&&<button type="button" className="secondaryButton" disabled={locked} onClick={()=>void manageViewer(m,"revoke")}>Bloquear ahora</button>}
        </div>}
        {canManage&&m.role!=="viewer"&&<div className="memberControls">
          <label>Cambiar hilo<select aria-label={`Hilo de ${m.first_name}`} disabled={locked} value={m.musical_part_id??""} onChange={e=>void modify(m,"assign_part",e.target.value)}><option value="" disabled>Seleccionar</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {m.approval_status==="rejected"&&<button className="secondaryButton" disabled={locked} onClick={()=>void modify(m,"reactivate")}>Reconsiderar solicitud</button>}
          {m.approval_status==="suspended"&&<button className="secondaryButton" disabled={locked} onClick={()=>void modify(m,"reactivate")}>Restaurar acceso</button>}
          {m.approval_status==="approved"&&<button className="secondaryButton" disabled={locked} onClick={()=>void modify(m,"suspend")}>Suspender acceso</button>}
          {role==="superadmin"&&m.approval_status==="approved"&&m.role==="musico"&&<button className="primaryButton" disabled={locked} onClick={()=>void modify(m,"promote")}>Nombrar directiva</button>}
          {role==="superadmin"&&m.role==="directiva"&&<button className="secondaryButton" disabled={locked} onClick={()=>void modify(m,"demote")}>Retirar de directiva</button>}
          {role==="superadmin"&&m.role!=="superadmin"&&<button type="button" className="secondaryButton" disabled={locked} onClick={()=>void manageViewer(m,"assign")}>Convertir en viewer de demostración</button>}
          {role==="superadmin"&&<button className="auditButton" disabled={locked} onClick={()=>void history(m)}>Ver historial de cambios</button>}
        </div>}
      </article>;
    })}</div>}
    {!loading&&filtered.length===0&&<p className="muted">No hay miembros que coincidan con los filtros.</p>}
    {role==="superadmin"&&auditName&&<section className="auditPanel"><div className="auditTop"><h2>Historial: {auditName}</h2><button className="secondaryButton" onClick={()=>{setAuditName("");setAudit(null);}}>Cerrar</button></div>{audit===null?<p className="muted">Consultando…</p>:audit.length===0?<p className="muted">Todavía no hay cambios registrados en este módulo.</p>:audit.map((a,i)=><div className="auditEntry" key={i}><strong>{a.action}</strong><span>{new Date(a.created_at).toLocaleString("es-ES")} · {a.actor_name}</span></div>)}</section>}
    <p className="muted helpText">Las cuentas rechazadas vuelven a «Pendiente» al reconsiderarlas. No se permite modificar la cuenta superadmin desde esta sección.</p>
  </main>;
}

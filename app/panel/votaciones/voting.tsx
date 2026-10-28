"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import MultiMarchVoting from "./multi-march-voting";
import {getSupabaseBrowser} from "@/lib/supabase/client";

type Proposal={id:string;title:string;description:string;estimated_cost:number|null;closes_at:string;closed_at:string|null;created_at:string};
type Ballot={proposal_id:string;choice:string};
type Total={proposal_id:string;yes_votes:number;no_votes:number};
const fmt=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"});
const money=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
export default function Voting({role,userId}:{role:string;userId:string}){
 const db=getSupabaseBrowser();
 const canManage=role==="superadmin"||role==="directiva";
 const [proposals,setProposals]=useState<Proposal[]>([]);
 const [votes,setVotes]=useState<Ballot[]>([]);
 const [totals,setTotals]=useState<Total[]>([]);
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [price,setPrice]=useState("");
 const [ends,setEnds]=useState("");
 const [participants,setParticipants]=useState(40);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const closed=(p:Proposal)=>Boolean(p.closed_at)||new Date(p.closes_at).getTime()<=Date.now();
 const refresh=async()=>{
  setLoading(true);setError("");
  const [p,v,r]=await Promise.all([
   db.from("march_proposals").select("id,title,description,estimated_cost,closes_at,closed_at,created_at").order("created_at",{ascending:false}),
   db.from("march_proposal_votes").select("proposal_id,choice").eq("user_id",userId),
   db.rpc("march_vote_results")
  ]);
  if(p.error)setError(p.error.message);else setProposals((p.data??[]) as Proposal[]);
  if(v.error)setError(v.error.message);else setVotes((v.data??[]) as Ballot[]);
  if(r.error)setError(r.error.message);else setTotals((r.data??[]) as Total[]);
  setLoading(false);
 };
 useEffect(()=>{void refresh();},[]);
 const byVote=useMemo(()=>new Map(votes.map(v=>[v.proposal_id,v.choice])),[votes]);
 const byTotal=useMemo(()=>new Map(totals.map(v=>[v.proposal_id,v])),[totals]);
 const sorted=useMemo(()=>[...proposals].sort((a,b)=>Number(closed(a))-Number(closed(b))||new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[proposals]);
 const create=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(busy)return;
  const finish=new Date(ends),cost=price.trim()===""?null:Number(price);
  if(!Number.isFinite(finish.getTime())||finish.getTime()<=Date.now()){setError("La fecha de cierre debe ser futura.");return;}
  if(cost!==null&&(!Number.isFinite(cost)||cost<0||Math.round(cost*100)!==cost*100)){setError("Escribe un coste válido con hasta dos decimales.");return;}
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("march_proposals").insert({title:title.trim(),description:description.trim(),estimated_cost:cost,closes_at:finish.toISOString(),created_by:userId});
  setBusy(false);
  if(err){setError(err.message);return;}
  setTitle("");setDescription("");setPrice("");setEnds("");setSuccess("Propuesta publicada. Ya pueden votar los miembros aprobados.");await refresh();
 };
 const vote=async(p:Proposal,choice:"si"|"no")=>{
  if(closed(p)||busy||byVote.has(p.id))return;
  if(!window.confirm("¿Confirmas tu voto? No se podrá modificar después."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("march_proposal_votes").insert({proposal_id:p.id,user_id:userId,choice});
  setBusy(false);
  if(err){setError(err.code==="23505"?"Ya has votado esta propuesta.":err.message);return;}
  setSuccess("Voto registrado correctamente.");await refresh();
 };
 const close=async(p:Proposal)=>{
  if(!canManage||closed(p)||busy)return;
  if(!window.confirm("¿Cerrar esta votación de forma definitiva y mostrar resultados?"))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("close_march_proposal",{target_id:p.id});
  setBusy(false);
  if(err){setError(err.message);return;}
  setSuccess("Votación cerrada.");await refresh();
 };
 const removeLegacy=async(p:Proposal)=>{
  if(!canManage||busy)return;
  if(!window.confirm("¿Eliminar definitivamente la votación «"+p.title+"» y todos sus votos? No se puede deshacer."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("delete_legacy_march_proposal",{p_proposal_id:p.id});
  setBusy(false);
  if(err){setError(err.message);return;}
  setSuccess("Votación eliminada correctamente.");await refresh();
 };
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon">♫</span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Votaciones de marchas</h1></div></header>
  <p className="muted">Vota qué marchas te gustaría incorporar. Cada miembro aprobado dispone de un voto por propuesta. Los resultados se muestran al cerrar la votación.</p>
  <MultiMarchVoting manager={canManage} userId={userId}/>
  <hr style={{margin:"32px 0",opacity:0.2}}/>
  {canManage&&<section className="voteCard"><h2>Proponer una marcha (votación clásica Sí/No)</h2>
   <form className="voteForm" onSubmit={e=>void create(e)}>
    <label>Nombre de la marcha<input minLength={3} maxLength={160} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Cinco Llagas"/></label>
    <label>Información adicional<textarea maxLength={3000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Autor, dificultad, motivo de la propuesta…"/></label>
    <label>Coste estimado (€), opcional<input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Ej. 150.00"/></label>
    <label>Cierre de votación<input type="datetime-local" required value={ends} onChange={e=>setEnds(e.target.value)}/></label>
    <button className="primaryButton" disabled={busy} type="submit">{busy?"Guardando…":"Publicar propuesta"}</button>
   </form>
  </section>}
  <div className="voteHeader"><h2>Votaciones clásicas de la agrupación</h2><button className="secondaryButton" type="button" onClick={()=>void refresh()} disabled={loading}>Actualizar</button></div>
  {error&&<p className="formError" role="alert">{error}</p>}
  {success&&<p className="formSuccess" role="status">{success}</p>}
  {loading?<p className="muted">Cargando votaciones…</p>:sorted.length===0?<p className="muted">Todavía no hay ninguna marcha propuesta.</p>:<div className="voteList">
   {sorted.map(p=>{
    const done=closed(p),own=byVote.get(p.id),count=byTotal.get(p.id);
    const yes=Number(count?.yes_votes??0),no=Number(count?.no_votes??0),total=yes+no;
    return <article className="voteCard" key={p.id}>
     <div className="voteTop"><span className="votePill">{done?"Cerrada":"Abierta"}</span><span className="muted small">Cierra: {fmt.format(new Date(p.closes_at))}</span></div>
     <h3>{p.title}</h3>{p.description&&<p className="voteDescription">{p.description}</p>}
     {p.estimated_cost!==null&&<p className="muted">Coste orientativo de adquisición: <strong>{money.format(p.estimated_cost)}</strong></p>}
     {own?<p className="voteOwn">Tu voto: <strong>{own==="si"?"Sí, incorporarla":"No incorporarla"}</strong></p>:done?<p className="muted">La votación ha terminado.</p>:<div className="voteActions">
       <button type="button" className="primaryButton" disabled={busy} onClick={()=>void vote(p,"si")}>Sí, incorporarla</button>
       <button type="button" className="secondaryButton" disabled={busy} onClick={()=>void vote(p,"no")}>No incorporarla</button>
     </div>}
     {done&&<div className="voteResult">
      <h4>Resultado · {total} votos</h4>
      <div className="voteResultLine"><span>Sí: {yes} ({total?Math.round(100*yes/total):0} %)</span><div><i style={{width:(total?100*yes/total:0)+"%"}}/></div></div>
      <div className="voteResultLine"><span>No: {no} ({total?Math.round(100*no/total):0} %)</span><div><i style={{width:(total?100*no/total:0)+"%"}}/></div></div>
     </div>}
     {canManage&&done&&<p className="muted small">¿Habéis decidido incorporarla? <Link href="/panel/repertorio">Gestionar repertorio oficial →</Link></p>}
     {canManage&&!done&&<button className="voteClose" type="button" disabled={busy} onClick={()=>void close(p)}>Cerrar votación ahora</button>}
     {canManage&&<button className="voteClose" type="button" disabled={busy} onClick={()=>void removeLegacy(p)}>Eliminar votación</button>}
     {p.estimated_cost!==null&&<details className="voteContribution">
      <summary>Simular aportación voluntaria</summary>
      <label>Número de participantes<input type="number" min={1} max={10000} step={1} value={participants} onChange={e=>setParticipants(Number(e.target.value)||1)}/></label>
      <p>Si participan {participants} personas, la aportación orientativa sería <strong>{money.format(p.estimated_cost/Math.max(1,participants))}</strong> por persona.</p>
      <p className="muted small">Simulación informativa. No crea deudas, cobros, obligaciones ni compromisos de pago.</p>
     </details>}
    </article>;
   })}
  </div>}
 </main>;
}

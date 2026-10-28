"use client";
import {useEffect,useState,type FormEvent} from "react";
import {getSupabaseBrowser} from "@/lib/supabase/client";

type Contest={id:string;title:string;created_at:string;closes_at:string;winning_option_id:string|null;composer:string|null;estimated_cost:number|null;published_at:string|null};
type Option={id:string;contest_id:string;title:string};
type Vote={contest_id:string;option_id:string};
type Answer={contest_id:string;willing:boolean};
type Result={contest_id:string;option_id:string;vote_count:number};
type Total={contest_id:string;yes_count:number;no_count:number};
const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"});
const eur=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});

export default function MultiMarchVoting({manager,userId}:{manager:boolean;userId:string}){
 const db=getSupabaseBrowser();
 const [contests,setContests]=useState<Contest[]>([]);
 const [options,setOptions]=useState<Option[]>([]);
 const [votes,setVotes]=useState<Vote[]>([]);
 const [answers,setAnswers]=useState<Answer[]>([]);
 const [results,setResults]=useState<Result[]>([]);
 const [totals,setTotals]=useState<Total[]>([]);
 const [title,setTitle]=useState("");
 const [draft,setDraft]=useState(["",""]);
 const [details,setDetails]=useState<Record<string,{composer:string;cost:string}>>({});
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [now,setNow]=useState(Date.now());
 async function reload(){
  setLoading(true);setError("");
  const [a,b,c,d,e,f]=await Promise.all([
   db.from("march_contests").select("id,title,created_at,closes_at,winning_option_id,composer,estimated_cost,published_at").order("created_at",{ascending:false}),
   db.from("march_contest_options").select("id,contest_id,title"),
   db.from("march_contest_votes").select("contest_id,option_id").eq("user_id",userId),
   db.from("march_contest_contributions").select("contest_id,willing").eq("user_id",userId),
   db.rpc("march_contest_results"),
   db.rpc("march_contest_contribution_totals")
  ]);
  const problem=[a,b,c,d,e,f].find(r=>r.error)?.error;
  if(problem)setError(problem.message);
  else{
   setContests((a.data??[]) as Contest[]);
   setOptions((b.data??[]) as Option[]);
   setVotes((c.data??[]) as Vote[]);
   setAnswers((d.data??[]) as Answer[]);
   setResults((e.data??[]) as Result[]);
   setTotals((f.data??[]) as Total[]);
  }
  setNow(Date.now());setLoading(false);
 }
 useEffect(()=>{void reload();const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const getWinner=(id:string)=>{
  const ranked=results.filter(r=>r.contest_id===id).sort((a,b)=>Number(b.vote_count)-Number(a.vote_count));
  if(!ranked.length||Number(ranked[0].vote_count)===0)return {id:null,reason:"Nadie votó."};
  if(ranked.length>1&&Number(ranked[0].vote_count)===Number(ranked[1].vote_count))return {id:null,reason:"Empate: habrá que hacer una votación de desempate."};
  return {id:ranked[0].option_id,reason:""};
 };
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  const items=draft.map(s=>s.trim()).filter(Boolean);
  if(items.length<2){setError("Introduce al menos dos marchas.");return;}
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("create_march_contest",{p_title:title.trim(),p_titles:items});
  setBusy(false);
  if(err){setError(err.message);return;}
  setTitle("");setDraft(["",""]);setSuccess("Votación creada. Se cerrará automáticamente dentro de 24 horas.");await reload();
 }
 async function vote(contestId:string,optionId:string){
  if(busy||!window.confirm("¿Confirmas tu voto? Solo puedes votar una vez por votación."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("march_contest_votes").insert({contest_id:contestId,option_id:optionId,user_id:userId});
  setBusy(false);if(err){setError(err.code==="23505"?"Ya has votado.":err.message);return;}
  setSuccess("Voto registrado. Los resultados se verán al pasar las 24 horas.");await reload();
 }
 async function publish(id:string){
  if(!manager||busy)return;
  const values=details[id]??{composer:"",cost:""};
  if(values.composer.trim().length<2||values.cost.trim()===""||!Number.isFinite(Number(values.cost))||Number(values.cost)<0){
   setError("Introduce el autor y el importe antes de publicar.");return;
  }
  if(!window.confirm("¿Publicar la marcha ganadora con su autor e importe para que los músicos respondan si quieren contribuir?"))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("publish_march_contest",{p_contest_id:id,p_composer:values.composer.trim(),p_cost:Number(values.cost)});
  setBusy(false);if(err){setError(err.message);return;}
  setSuccess("Consulta publicada. Los miembros ya pueden indicar si aportarían dinero.");await reload();
 }
 async function answer(id:string,willing:boolean){
  if(busy||!window.confirm(willing?"¿Confirmas que estarías dispuesto a aportar voluntariamente? No es un pago ni una deuda.":"¿Confirmas que no participarías en esta aportación?"))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("march_contest_contributions").insert({contest_id:id,user_id:userId,willing});
  setBusy(false);if(err){setError(err.code==="23505"?"Ya has respondido.":err.message);return;}
  setSuccess("Respuesta guardada. No se ha realizado ningún cobro.");await reload();
 }
 async function remove(id:string){
  if(!manager||busy||!window.confirm("¿Eliminar definitivamente esta votación y todos sus votos y respuestas? No se podrá recuperar."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("delete_march_contest",{p_contest_id:id});
  setBusy(false);if(err){setError(err.message);return;}
  setSuccess("Votación eliminada.");await reload();
 }
 return <section className="voteMultiSection">
  <h2>Votación entre varias marchas · 24 horas</h2>
  <p className="muted">Cada músico elige una marcha. Al acabar las 24 horas se muestra la ganadora. La aportación económica <strong>solo se consulta cuando la directiva introduce el autor y el importe y pulsa Publicar</strong>.</p>
  {manager&&<section className="voteCard"><h3>Crear nueva votación</h3><form className="voteForm" onSubmit={e=>void create(e)}>
   <label>Título de la votación<input value={title} minLength={3} maxLength={160} required onChange={e=>setTitle(e.target.value)} placeholder="Elegir próxima marcha"/></label>
   <fieldset className="marchContestChoices"><legend>Marchas candidatas</legend>
    {draft.map((v,i)=><label key={i}>Marcha {i+1}<span className="marchContestEntry"><input minLength={3} maxLength={160} required value={v} onChange={e=>setDraft(old=>old.map((x,j)=>j===i?e.target.value:x))} placeholder={"Nombre de la marcha "+(i+1)}/>{draft.length>2&&<button type="button" className="secondaryButton" onClick={()=>setDraft(old=>old.filter((_,j)=>j!==i))}>Quitar</button>}</span></label>)}
    <button type="button" className="secondaryButton" disabled={draft.length>=15} onClick={()=>setDraft(old=>[...old,""])}>+ Añadir otra marcha</button>
   </fieldset>
   <p className="muted small">La votación se cerrará exactamente 24 horas después de publicarla. No hace falta poner precio ni autor ahora.</p>
   <button className="primaryButton" type="submit" disabled={busy}>{busy?"Publicando…":"Publicar votación de 24 horas"}</button>
  </form></section>}
  {error&&<p className="formError" role="alert">{error}</p>}
  {success&&<p className="formSuccess" role="status">{success}</p>}
  {loading?<p className="muted">Cargando votaciones…</p>:contests.length===0?<p className="muted">No hay votaciones de varias marchas todavía.</p>:
  <div className="voteList">{contests.map(c=>{
   const closed=new Date(c.closes_at).getTime()<=now;
   const myVote=votes.find(v=>v.contest_id===c.id);
   const myAnswer=answers.find(v=>v.contest_id===c.id);
   const opts=options.filter(o=>o.contest_id===c.id);
   const win=closed?getWinner(c.id):{id:null,reason:""};
   const winner=opts.find(o=>o.id===win.id);
   const counts=totals.find(t=>t.contest_id===c.id);
   const input=details[c.id]??{composer:"",cost:""};
   return <article className="voteCard" key={c.id}>
    <div className="voteTop"><span className="votePill">{c.published_at?"Aportaciones abiertas":closed?"24 horas finalizadas":"Votación abierta"}</span><span className="muted small">Cierra: {date.format(new Date(c.closes_at))}</span></div>
    <h3>{c.title}</h3>
    {!closed&&<p className="muted small">Quedan aproximadamente {Math.max(0,Math.ceil((new Date(c.closes_at).getTime()-now)/60000))} minutos.</p>}
    <div className="marchContestOptions">{opts.map(o=><div className="marchContestOption" key={o.id}>
     <span><strong>{o.title}</strong>{closed&&<small> · {Number(results.find(r=>r.contest_id===c.id&&r.option_id===o.id)?.vote_count??0)} votos</small>}{myVote?.option_id===o.id&&<small> · Tu elección</small>}</span>
     {!closed&&!myVote&&<button className="secondaryButton" disabled={busy} onClick={()=>void vote(c.id,o.id)}>Votar</button>}
    </div>)}</div>
    {!closed&&myVote&&<p className="voteOwn">Voto registrado. Se publicará el resultado al terminar las 24 horas.</p>}
    {closed&&<p className="formSuccess">{winner?"Marcha ganadora: "+winner.title:win.reason}</p>}
    {closed&&winner&&!c.published_at&&<div className="marchContestPublish">
     {manager?<><h4>Completar y publicar consulta de aportación</h4><p className="muted small">Hasta que pulses Publicar, los músicos no podrán indicar si pagan por esta marcha.</p>
      <label>Autor o compositor<input value={input.composer} maxLength={160} onChange={e=>setDetails(old=>({...old,[c.id]:{...input,composer:e.target.value}}))} placeholder="Autor de la marcha"/></label>
      <label>Importe total estimado (€)<input type="number" min="0" step="0.01" value={input.cost} onChange={e=>setDetails(old=>({...old,[c.id]:{...input,cost:e.target.value}}))} placeholder="Ej. 150,00"/></label>
      <button className="primaryButton" disabled={busy} onClick={()=>void publish(c.id)}>Publicar consulta de aportación</button>
     </>:<p className="muted">Pendiente de que la directiva introduzca el autor y el importe y publique la consulta.</p>}
    </div>}
    {c.published_at&&<div className="marchContestPublish"><h4>Consulta de aportación voluntaria</h4>
     <p><strong>Marcha:</strong> {opts.find(o=>o.id===c.winning_option_id)?.title??winner?.title}</p>
     <p><strong>Autor:</strong> {c.composer}</p>
     <p><strong>Coste estimado:</strong> {eur.format(Number(c.estimated_cost??0))}</p>
     <p className="muted small">Indica solamente si estarías dispuesto a aportar. No se cobra, no genera deudas ni compromisos de pago.</p>
     {myAnswer?<p className="voteOwn">Tu respuesta: <strong>{myAnswer.willing?"Sí, estaría dispuesto":"No participaría"}</strong></p>:
     <div className="voteActions"><button className="primaryButton" disabled={busy} onClick={()=>void answer(c.id,true)}>Sí, aportaría</button><button className="secondaryButton" disabled={busy} onClick={()=>void answer(c.id,false)}>No aportaría</button></div>}
     <p className="muted small">Respuestas: {Number(counts?.yes_count??0)} sí · {Number(counts?.no_count??0)} no</p>
    </div>}
    {manager&&<button type="button" className="voteClose" disabled={busy} onClick={()=>void remove(c.id)}>Eliminar votación</button>}
   </article>;
  })}</div>}
 </section>;
}

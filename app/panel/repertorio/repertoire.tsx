"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type March={id:string;title:string;composer:string;youtube_url:string;spotify_url:string;notes:string;from_proposal:string|null;created_at:string};
type Proposal={id:string;title:string;closed_at:string|null;closes_at:string;description:string};
type Score={title:string};
const blank={title:"",composer:"",youtube_url:"",spotify_url:"",notes:""};
type Form=typeof blank;
function validUrl(value:string,site:"youtube"|"spotify"){
 if(!value.trim())return true;
 try{
  const url=new URL(value.trim());
  if(url.protocol!=="https:"||url.username||url.password)return false;
  if(site==="youtube")return ["youtube.com","www.youtube.com","music.youtube.com","youtu.be"].includes(url.hostname);
  return url.hostname==="open.spotify.com"&&/^\/(track|album|episode|playlist)\//.test(url.pathname);
 }catch{return false;}
}
function canonical(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();}
function cleanTitle(title:string){
 return title.trim().replace(/\.(pdf|mp3|wav|m4a|png|jpg|jpeg|webp|docx|sib)$/i,"")
 .replace(/\s*[-–—_]\s*(trompeta|corneta|tromb[oó]n|bombardino|tuba|percusi[oó]n|guion|gui[oó]n|audio)(?:\s*\d+)?\s*$/i,"").trim();
}
export default function Repertoire({role,userId}:{role:string;userId:string}){
 const db=getSupabaseBrowser();
 const manager=role==="directiva"||role==="superadmin";
 const [marches,setMarches]=useState<March[]>([]);
 const [proposals,setProposals]=useState<Proposal[]>([]);
 const [suggestions,setSuggestions]=useState<string[]>([]);
 const [form,setForm]=useState<Form>({...blank});
 const [editing,setEditing]=useState<string|null>(null);
 const [source,setSource]=useState<string>("");
 const [query,setQuery]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const patch=<K extends keyof Form>(k:K,v:Form[K])=>setForm(old=>({...old,[k]:v}));
 async function reload(){
  setLoading(true);setError("");
  const {data,error:e}=await db.from("band_repertoire").select("id,title,composer,youtube_url,spotify_url,notes,from_proposal,created_at").order("title").limit(2000);
  if(e)setError(e.message);else setMarches((data??[]) as March[]);
  if(manager){
   const [p,s]=await Promise.all([
    db.from("march_proposals").select("id,title,closed_at,closes_at,description").order("created_at",{ascending:false}).limit(500),
    db.from("march_scores").select("title").limit(3000)
   ]);
   if(p.error)setError(old=>old||p.error!.message);else setProposals((p.data??[]) as Proposal[]);
   if(s.data){
    const names=[...new Set((s.data as Score[]).map(v=>cleanTitle(v.title)).filter(v=>v.length>=3))].sort((a,b)=>a.localeCompare(b,"es"));
    setSuggestions(names);
   }
  }
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const selected=useMemo(()=>marches.filter(m=>(m.title+" "+m.composer+" "+m.notes).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))),[marches,query]);
 const pending=proposals.filter(p=>(p.closed_at!==null||new Date(p.closes_at).getTime()<=Date.now())&&!marches.some(m=>m.from_proposal===p.id)&&!marches.some(m=>canonical(m.title)===canonical(p.title)));
 function reset(){setForm({...blank});setEditing(null);setSource("");}
 function edit(m:March){setForm({title:m.title,composer:m.composer,youtube_url:m.youtube_url,spotify_url:m.spotify_url,notes:m.notes});setEditing(m.id);setSource(m.from_proposal??"");setError("");setSuccess("");window.scrollTo({top:0,behavior:"smooth"});}
 function chooseProposal(id:string){
  setSource(id);setEditing(null);
  const p=proposals.find(x=>x.id===id);
  setForm({...blank,title:p?.title??"",notes:""});
  setError("");setSuccess("");
 }
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!manager||busy)return;
  setError("");setSuccess("");
  if(form.title.trim().length<3){setError("Escribe un título válido.");return;}
  if(!validUrl(form.youtube_url,"youtube")||!validUrl(form.spotify_url,"spotify")){setError("Comprueba que los enlaces sean de YouTube o Spotify, usando HTTPS.");return;}
  const payload={title:form.title.trim(),composer:form.composer.trim(),youtube_url:form.youtube_url.trim(),spotify_url:form.spotify_url.trim(),notes:form.notes.trim()};
  if(!window.confirm(editing?"¿Guardar cambios en esta marcha?":"¿Confirmas que esta marcha forma parte del repertorio oficial de La Pasión?"))return;
  setBusy(true);
  const result=editing?await db.from("band_repertoire").update(payload).eq("id",editing):await db.from("band_repertoire").insert({...payload,from_proposal:source||null,created_by:userId});
  setBusy(false);
  if(result.error){setError(result.error.code==="23505"?"Esta marcha ya figura en el repertorio o esta propuesta ya fue incorporada.":result.error.message);return;}
  reset();setSuccess(editing?"Marcha actualizada.":"Marcha incorporada al repertorio oficial.");await reload();
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN DE MAZARRÓN</small><h1>Repertorio oficial</h1></div></header>
  <p className="muted">Todas las marchas que forman parte de nuestro repertorio, con enlaces a grabaciones para escucharlas y estudiarlas. Solo se muestran enlaces añadidos y comprobados por la directiva.</p>
  <div className="repertoireStats"><div><strong>{marches.length}</strong><span>Marchas oficiales</span></div><div><strong>{marches.filter(m=>m.youtube_url).length}</strong><span>Con YouTube</span></div><div><strong>{marches.filter(m=>m.spotify_url).length}</strong><span>Con Spotify</span></div></div>
  {manager&&<section className="repertoireCard">
    <h2>{editing?"Editar marcha":"Incorporar marcha"}</h2>
    <p className="muted small">Puedes elegir una marcha ya presente en las partituras, añadir una nueva o incorporar una propuesta con su votación finalizada. La inclusión es una decisión de la directiva, no automática.</p>
    {!editing&&<label className="repertoireLabel">Propuesta de votación finalizada<select value={source} onChange={e=>chooseProposal(e.target.value)}><option value="">Ninguna · añadir directamente</option>{pending.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
    <form className="repertoireForm" onSubmit={e=>void save(e)}>
     <label className="repertoireLabel">Título de la marcha<input list="repertoire-titles" value={form.title} onChange={e=>patch("title",e.target.value)} required minLength={3} maxLength={160} placeholder="Nombre de la marcha"/><datalist id="repertoire-titles">{suggestions.map(n=><option key={n} value={n}/>)}</datalist></label>
     <label className="repertoireLabel">Compositor o autor<input value={form.composer} maxLength={160} onChange={e=>patch("composer",e.target.value)} placeholder="Opcional"/></label>
     <label className="repertoireLabel">Enlace de YouTube<input inputMode="url" type="url" maxLength={500} value={form.youtube_url} onChange={e=>patch("youtube_url",e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
     <label className="repertoireLabel">Enlace de Spotify<input inputMode="url" type="url" maxLength={500} value={form.spotify_url} onChange={e=>patch("spotify_url",e.target.value)} placeholder="https://open.spotify.com/track/…"/></label>
     <label className="repertoireLabel repertoireWide">Observaciones<textarea rows={3} maxLength={1500} value={form.notes} onChange={e=>patch("notes",e.target.value)} placeholder="Detalles del arreglo o interpretación…"/></label>
     <div className="repertoireActions"><button className="primaryButton" type="submit" disabled={busy}>{busy?"Guardando…":editing?"Guardar cambios":"Incorporar al repertorio"}</button>{(editing||source)&&<button type="button" className="secondaryButton" onClick={reset}>Cancelar</button>}</div>
    </form>
   </section>}
  <section className="repertoireCard">
   <div className="repertoireHeader"><h2>Marchas de La Pasión</h2><Link href="/panel/votaciones" className="repertoireVotingLink">Ver votaciones →</Link></div>
   <label className="repertoireLabel">Buscar en el repertorio<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Marcha, compositor…"/></label>
   {error&&<p className="formError" role="alert">{error}</p>}
   {success&&<p className="formSuccess" role="status">{success}</p>}
   {loading?<p className="muted">Cargando repertorio…</p>:selected.length===0?<p className="muted">{query?"No hay marchas que coincidan con la búsqueda.":"Todavía no se han incorporado marchas al repertorio oficial. La directiva puede añadir las actuales sin volver a subir partituras."}</p>:<div className="repertoireList">{selected.map(m=><article className="repertoireItem" key={m.id}>
     <div className="repertoireItemHead"><span className="repertoireMusicalIcon" aria-hidden="true">♫</span><div><h3>{m.title}</h3>{m.composer&&<p className="muted small">{m.composer}</p>}</div></div>
     {m.notes&&<p className="muted small">{m.notes}</p>}
     {m.from_proposal&&<p className="repertoireOrigin">✓ Incorporada tras votación</p>}
     <div className="repertoireActions">
      {m.youtube_url&&<a className="secondaryButton linkButton" href={m.youtube_url} target="_blank" rel="noopener noreferrer"> ▶ YouTube</a>}
      {m.spotify_url&&<a className="secondaryButton linkButton" href={m.spotify_url} target="_blank" rel="noopener noreferrer">♫ Spotify</a>}
      {!m.youtube_url&&!m.spotify_url&&<span className="muted small">Enlaces de escucha pendientes</span>}
      {manager&&<button type="button" className="secondaryButton" onClick={()=>edit(m)}>Editar</button>}
     </div>
    </article>)}</div>}
   </section>
 </main>;
}
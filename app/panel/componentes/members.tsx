"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "@/lib/app-data";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {MONTHS,socialUrl,type Network} from "@/lib/profile-utils";
import Avatar,{useAvatarUrls} from "../perfil/avatar";

type Member={id:string;first_name:string;last_name:string;part_name:string|null;role:string;avatar_path:string|null;favorite_march:string|null;bio:string|null;
 instagram:string|null;tiktok:string|null;facebook:string|null;birthday_day:number|null;birthday_month:number|null;member_since:string};
const roles:Record<string,string>={directiva:"Directiva",superadmin:"Directiva"};
const since=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"});
const networkNames:Record<Network,string>={instagram:"Instagram",tiktok:"TikTok",facebook:"Facebook"};

export default function Members({userId}:{userId:string}){
 const [members,setMembers]=useState<Member[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [open,setOpen]=useState<Member|null>(null);
 const avatars=useAvatarUrls(members.map(m=>m.avatar_path));
 useEffect(()=>{
  void getSupabaseBrowser().rpc("member_profiles").then(({data,error:err})=>{
   if(err)setError("No se han podido cargar los componentes.");else setMembers((data??[]) as Member[]);
   setLoading(false);
  });
 },[]);
 // Abrir una ficha concreta desde un enlace (#miembro-<id>).
 useEffect(()=>{
  const sync=()=>{const id=window.location.hash.replace("#miembro-","");const m=members.find(x=>x.id===id);if(m)setOpen(m);};
  sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);
 },[members]);
 useEffect(()=>{
  if(!open)return;
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};
  window.addEventListener("keydown",esc);return()=>window.removeEventListener("keydown",esc);
 },[open]);
 function close(){setOpen(null);if(window.location.hash.startsWith("#miembro-"))history.replaceState(null,"",window.location.pathname);}
 const groups=useMemo(()=>{
  const q=query.normalize("NFD").replace(/[̀-ͯ]/g,"").toLocaleLowerCase("es").trim();
  const map=new Map<string,Member[]>();
  for(const m of members){
   const text=[m.first_name,m.last_name,m.part_name,m.favorite_march].join(" ").normalize("NFD").replace(/[̀-ͯ]/g,"").toLocaleLowerCase("es");
   if(q&&!text.includes(q))continue;
   const key=m.part_name??"Sin hilo asignado";
   map.set(key,[...(map.get(key)??[]),m]);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"es"));
 },[members,query]);
 const me=members.find(m=>m.id===userId);
 const incomplete=me&&!me.avatar_path&&!me.favorite_march;
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Componentes</h1></div></header>
  <p className="muted">Toda la agrupación, por hilos. Toca a un compañero para ver su perfil.</p>
  {incomplete&&<section className="pushNudge"><span aria-hidden="true">📷</span><div><strong>Completa tu perfil</strong><p>Pon tu foto y tu marcha favorita para que te reconozcan.</p></div><Link href="/panel/perfil" className="primaryButton linkButton">Mi perfil</Link></section>}
  <label className="boardSearch">Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, hilo o marcha"/></label>
  {error&&<p role="alert" className="formError">{error}</p>}
  {loading?<p className="muted">Cargando componentes…</p>:groups.length===0?<p className="muted">No hay componentes con esa búsqueda.</p>:
   groups.map(([part,list])=><section key={part} className="memberGroup">
    <h2>{part} <span className="muted small">· {list.length}</span></h2>
    <div className="memberGrid">{list.map(m=><button type="button" key={m.id} className="memberCard" onClick={()=>{setOpen(m);history.replaceState(null,"","#miembro-"+m.id);}}>
     <Avatar src={m.avatar_path?avatars[m.avatar_path]:null} first={m.first_name} last={m.last_name} size={56}/>
     <span className="memberName">{m.first_name} {m.last_name}{m.id===userId?" (tú)":""}</span>
     {roles[m.role]&&<span className="memberRole">{roles[m.role]}</span>}
     {m.favorite_march&&<span className="memberMarch">♫ {m.favorite_march}</span>}
    </button>)}</div>
   </section>)}
  {open&&<div className="profileModal" role="dialog" aria-modal="true" aria-label={"Perfil de "+open.first_name} onClick={close}>
   <article className="profileCard" onClick={e=>e.stopPropagation()}>
    <button type="button" className="profileClose" onClick={close} aria-label="Cerrar">✕</button>
    <Avatar src={open.avatar_path?avatars[open.avatar_path]:null} first={open.first_name} last={open.last_name} size={120}/>
    <h2>{open.first_name} {open.last_name}</h2>
    <p className="muted">{[open.part_name,roles[open.role]].filter(Boolean).join(" · ")||"Músico"}</p>
    <dl className="profileFacts">
     {open.favorite_march&&<><dt>Marcha favorita</dt><dd>♫ {open.favorite_march}</dd></>}
     {open.birthday_day&&open.birthday_month&&<><dt>Cumpleaños</dt><dd>🎂 {open.birthday_day} de {MONTHS[open.birthday_month-1]}</dd></>}
     <dt>En la agrupación desde</dt><dd>{since.format(new Date(open.member_since))}</dd>
    </dl>
    {open.bio&&<p className="profileBio">{open.bio}</p>}
    {(open.instagram||open.tiktok||open.facebook)&&<div className="profileSocial">
     {(["instagram","tiktok","facebook"] as Network[]).map(n=>open[n]?<a key={n} href={socialUrl(n,open[n]!)} target="_blank" rel="noopener noreferrer" className="secondaryButton linkButton">{networkNames[n]}{n!=="facebook"?" · @"+open[n]:""}</a>:null)}
    </div>}
    {open.id===userId&&<Link href="/panel/perfil" className="primaryButton linkButton">Editar mi perfil</Link>}
   </article>
  </div>}
 </main>;
}

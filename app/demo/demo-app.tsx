"use client";
import {useEffect,useState,type ComponentProps} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {DemoDataProvider,demoHref} from "@/lib/app-data";
import {DEMO_USER,openDemoDatabase} from "@/lib/demo-local";
import MusicianDashboard from "../panel/musician-dashboard";
import BandCalendar from "../panel/calendario/band-calendar";
import ScoreLibrary from "../panel/partituras/score-library";
import RehearsalPlanner from "../panel/ensayos/rehearsal-planner";
import Repertoire from "../panel/repertorio/repertoire";
import MyAttendance from "../panel/mi-asistencia/my-attendance";
import BulletinBoard from "../panel/tablon/bulletin-board";
import Voting from "../panel/votaciones/voting";
import Notifications from "../panel/notificaciones/notifications";
import LogoutButton from "../panel/salir";
export default function DemoApp({initialSeconds,preview,section="inicio"}:{initialSeconds:number;preview:boolean;section?:string}){
 const [remaining,setRemaining]=useState(initialSeconds);

 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [verifying,setVerifying]=useState(false);
 useEffect(()=>{
  if(preview)return;
  let active=true,leaving=false,checking=false,wasAllowed=initialSeconds>0;
  let deadline=performance.now()+initialSeconds*1000;
  function leave(){
   if(!active||leaving)return;
   leaving=true;setRemaining(0);setVerifying(true);
   // Hide the demo before clearing credentials, even if sign-out is slow.
   const redirect=()=>window.location.replace("/acceso");
   const fallback=window.setTimeout(redirect,2000);
   void getSupabaseBrowser().auth.signOut({scope:"local"}).finally(()=>{clearTimeout(fallback);redirect();});
  }
  const tick=()=>{
   if(!active||leaving)return;
   const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));
   setRemaining(seconds);
   if(wasAllowed&&seconds<=0)leave();
  };
  async function check(){
   if(checking||leaving||!active||document.visibilityState==="hidden")return;
   checking=true;
   try{
    const response=await fetch("/api/demo-access",{cache:"no-store",signal:AbortSignal.timeout(5000)});
    const access=await response.json();
    if(!active||leaving)return;
    const seconds=response.ok&&access.allowed?Number(access.remainingSeconds)||0:0;
    if(seconds<=0&&wasAllowed){leave();return;}
    if(seconds>0)wasAllowed=true;
    deadline=performance.now()+seconds*1000;tick();setVerifying(false);
   }catch{
    if(active){if(wasAllowed)leave();else{setVerifying(false);setMessage("Conecta a Internet para verificar tu autorización.");}}
   }finally{checking=false;}
  }
  const resume=()=>{if(wasAllowed)setVerifying(true);void check();};
  const visibility=()=>{if(document.visibilityState==="hidden"){if(wasAllowed)setVerifying(true);}else resume();};
  void check();const clock=setInterval(tick,250),verify=setInterval(()=>void check(),1000);
  window.addEventListener("focus",resume);document.addEventListener("visibilitychange",visibility);
  window.addEventListener("pageshow",resume);
  return()=>{active=false;clearInterval(clock);clearInterval(verify);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pageshow",resume);};
 },[initialSeconds,preview]);
 async function request(){
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/demo-access",{method:"POST"});setMessage(r.ok?"Solicitud enviada. El superadmin debe autorizar otros 15 minutos.":"No se pudo enviar la solicitud. Vuelve a iniciar sesión.");}
  catch{setMessage("No hay conexión. Inténtalo de nuevo.");}
  finally{setBusy(false);}
 }
 const [local,setLocal]=useState<Awaited<ReturnType<typeof openDemoDatabase>>|null>(null);
 const allowed=preview||remaining>0;
 useEffect(()=>{
  if(!allowed)return;
  let active=true;void openDemoDatabase().then(db=>{if(active)setLocal(db);});
  return()=>{active=false;};
 },[allowed]);
 if(!preview&&verifying)return <main className="authShell"><section className="authCard"><p role="status">Comprobando acceso…</p></section></main>;
 if(!preview&&remaining<=0)return <main className="authShell"><section className="authCard">
  <span className="eyebrow">VIEWER · ACCESO TEMPORAL</span><h1>Esperando autorización</h1>
  <p>El superadmin debe autorizar cada visita. Dispondrás de 15 minutos desde su aprobación para explorar ejemplos ficticios.</p>
  <p className="muted">Si tu visita ha caducado, puedes usar las mismas credenciales, pero volver a iniciar sesión no renueva el tiempo.</p>
  <button type="button" className="primaryButton" disabled={busy} onClick={()=>void request()}>{busy?"Enviando…":"Solicitar 15 minutos"}</button>
  {message&&<p className="muted" role="status">{message}</p>}<LogoutButton/>
 </section></main>;

 if(!local)return <main className="authShell"><p role="status">Preparando los ejemplos locales…</p></main>;
 const {dataset,client}=local;
 const home={profile:{first_name:"Músico de ejemplo"},events:dataset.tables.band_events,posts:dataset.tables.board_posts,responseItems:dataset.tables.event_responses,openVotes:1,unread:2,eventsError:false,postsError:false,issues:false} as ComponentProps<typeof MusicianDashboard>;
 const screen=section==="inicio"?<MusicianDashboard {...home}/>
 :section==="calendario"?<BandCalendar role="musico"/>
 :section==="partituras"?<ScoreLibrary role="musico" partId={1}/>
 :section==="ensayos"?<RehearsalPlanner role="musico" userId={DEMO_USER}/>
 :section==="repertorio"?<Repertoire role="musico" userId={DEMO_USER}/>
 :section==="mi-asistencia"?<MyAttendance/>
 :section==="tablon"?<BulletinBoard role="musico" userId={DEMO_USER}/>
 :section==="votaciones"?<Voting role="musico" userId={DEMO_USER}/>
 :<Notifications userId={DEMO_USER}/>;
 return <DemoDataProvider db={client as unknown as ReturnType<typeof getSupabaseBrowser>}>
  <aside className="container notice" aria-label="Aviso de demostración">
   <strong>Demostración · Vista de músico · Solo lectura</strong>
   <p>Todos los nombres, eventos, partituras y cifras son ficticios. Los datos de ejemplo están en este dispositivo.</p>
   <p role="timer">{preview?"Vista previa del superadmin":"Acceso restante: "+String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0")}</p>
   {preview&&<Link href="/panel/miembros" className="backLink">← Volver a Gestión de miembros</Link>}
  </aside>
  {screen}
  <nav className="mobilePanelNav" aria-label="Navegación principal">
   <Link href={demoHref("/panel")}><span aria-hidden="true">⌂</span><span>Inicio</span></Link>
   <Link href={demoHref("/panel/calendario")}><span aria-hidden="true">▦</span><span>Calendario</span></Link>
   <Link href={demoHref("/panel/partituras")}><span aria-hidden="true">♫</span><span>Partituras</span></Link>
   <Link href={demoHref("/panel/notificaciones")}><span aria-hidden="true">♧</span><span>Avisos</span></Link>
  </nav>
 </DemoDataProvider>;
}

"use client";
import {useEffect,useState,type ComponentProps} from "react";
import Link from "next/link";
import type {getSupabaseBrowser} from "@/lib/supabase/client";
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
export default function DemoApp({section="inicio"}:{section?:string}){
 const [local,setLocal]=useState<Awaited<ReturnType<typeof openDemoDatabase>>|null>(null);
 useEffect(()=>{
  let active=true;void openDemoDatabase().then(db=>{if(active)setLocal(db);});
  return()=>{active=false;};
 },[]);
 if(!local)return <main className="authShell"><p role="status">Preparando la demostración…</p></main>;
 const {dataset,client}=local;
 const home={profile:{first_name:"Visitante"},events:dataset.tables.band_events,posts:dataset.tables.board_posts,responseItems:dataset.tables.event_responses,openVotes:1,unread:2,eventsError:false,postsError:false,issues:false} as ComponentProps<typeof MusicianDashboard>;
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
   <strong>Prueba PASIÓN APP · Acceso libre · Solo lectura</strong>
   <p>Entra sin registro, aprobación ni permisos de notificaciones. Explora las mismas pantallas que utiliza un músico.</p>
   <p>Las obras musicales son reales. La agenda, los mensajes y las cifras son simulaciones: no muestran datos ni actividad de La Pasión de Mazarrón.</p>
   <details><summary>Fuentes de las obras de muestra</summary><ul>
    <li><a href="https://www.amargura.org/musica/" target="_blank" rel="noopener noreferrer">Amarguras · Manuel Font de Anta · Hermandad de la Amargura</a></li>
    <li><a href="https://archivo.sgae.es/heritageobject/solea-dame-la-mano--impresion-en-forma-de-marcha-funebre--maestro-font-y-de-anta/" target="_blank" rel="noopener noreferrer">Soleá, dame la mano · Manuel Font de Anta · Archivo SGAE</a></li>
    <li><a href="https://www.beethoven.de/en/work/view/5556714292117504/" target="_blank" rel="noopener noreferrer">Himno a la alegría · Ludwig van Beethoven · Beethoven-Haus</a></li>
   </ul></details>
   <Link href="/" className="backLink">← Salir de la demostración</Link>
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

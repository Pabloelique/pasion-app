"use client";
import Link from "@/lib/app-data";
import LogoutButton from "./salir";
type EventItem={id:string;title:string;event_type:string;location:string;starts_at:string};
type PostItem={id:string;title:string;content:string;priority:string;created_at:string};
type ResponseItem={event_id:string;response:string};


const dateTime=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"});
const dateOnly=new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",timeZone:"Europe/Madrid"});
const eventNames:Record<string,string>={ensayo:"Ensayo",actuacion:"Actuación",reunion:"Reunión",otro:"Actividad"};
const shortcuts=[
 {href:"/panel/calendario",icon:"▦",name:"Calendario",detail:"Ensayos, actuaciones y disponibilidad"},
 {href:"/panel/partituras",icon:"♫",name:"Partituras",detail:"Tu repertorio e instrumentos"},
 {href:"/panel/ensayos",icon:"♬",name:"Plan de ensayos",detail:"Marchas y objetivos de trabajo"},
 {href:"/panel/repertorio",icon:"♫",name:"Repertorio oficial",detail:"Marchas con YouTube y Spotify"},
 {href:"/panel/mi-asistencia",icon:"✓",name:"Mi asistencia",detail:"Presencias y faltas registradas"},
 {href:"/panel/tablon",icon:"☷",name:"Tablón",detail:"Comunicados y conversación"},
 {href:"/panel/votaciones",icon:"◉",name:"Votación de nuevas marchas",detail:"Propuestas de nuevas marchas"},
 {href:"/panel/notificaciones",icon:"♧",name:"Notificaciones",detail:"Avisos internos y novedades"}
];

type Props={profile:{first_name:string};events:EventItem[];posts:PostItem[];responseItems:ResponseItem[];openVotes:number|null;unread:number|null;eventsError:boolean;postsError:boolean;issues:boolean;canReviewAbsences?:boolean};
export default function MusicianDashboard({profile,events,posts,responseItems,openVotes,unread,eventsError,postsError,issues,canReviewAbsences=false}:Props){
 const responses=new Map(responseItems.map(x=>[x.event_id,x.response]));
 const important=posts.filter(p=>p.priority==="importante");
 return <main className="container dashboard">
  <header className="header dashboardHeader">
   <span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN DE MAZARRÓN</small><h1>PASIÓN APP</h1></div>
   <div className="dashboardHeaderActions"><Link href="/panel/notificaciones" className="dashboardBell" aria-label={unread===null?"Abrir notificaciones":unread+" notificaciones sin leer"}><span aria-hidden="true">♧</span>{unread!==null&&unread>0&&<span className="dashboardBellCount">{unread>99?"99+":unread}</span>}</Link><span className="dashboardRole">Músico</span></div>
  </header>
  <section className="dashboardWelcome">
   <span className="eyebrow">TU CENTRO DE CONTROL</span>
   <h2>¡Hola, {profile.first_name||"músico"}!</h2>
   <p>Todo lo importante de la agrupación, en un mismo lugar.</p>
   <div className="dashboardWelcomeActions">
    <Link className="primaryButton linkButton" href="/panel/calendario">Ver calendario</Link>
    <Link className="secondaryButton linkButton" href="/panel/partituras">Mis partituras</Link>
   </div>
  </section>
  {issues&&<p className="muted dashboardNotice">Algunos datos no se han podido actualizar. Puedes acceder a cada apartado desde los enlaces inferiores.</p>}
  <section className="dashboardStats" aria-label="Resumen de actividad">
   <div><span>Notificaciones sin leer</span><strong>{unread??"—"}</strong><small><Link href="/panel/notificaciones" className="dashboardStatLink">Ver bandeja</Link></small></div>
   <div><span>Próximas actividades</span><strong>{eventsError?"—":events.length}</strong><small>Eventos visibles</small></div>
   <div><span>Comunicados importantes</span><strong>{postsError?"—":important.length}</strong><small>Entre los cinco últimos</small></div>
   <div><span>Votaciones abiertas</span><strong>{openVotes??"—"}</strong><small>Propuestas activas</small></div>
   
  </section>
  <div className="dashboardColumns">
   <section className="dashboardSection">
    <div className="dashboardSectionHead"><h2>Próximos ensayos y actuaciones</h2><Link href="/panel/calendario">Ver calendario →</Link></div>
    {eventsError?<p className="muted">No se pudo consultar el calendario.</p>:events.length===0?<p className="dashboardEmpty">No hay actividades próximas programadas.</p>:
    <div className="dashboardEventList">{events.map(ev=><article key={ev.id} className="dashboardEvent">
     <span className="dashboardEventDate">{dateOnly.format(new Date(ev.starts_at))}</span>
     <div><span className="dashboardEventType">{eventNames[ev.event_type]??"Actividad"}</span><h3>{ev.title}</h3><p>{dateTime.format(new Date(ev.starts_at))}{ev.location?" · "+ev.location:""}</p></div>
     <span className="dashboardResponse">{responses.get(ev.id)==="asistire"?"Asistiré":responses.get(ev.id)==="no_asistire"?"No asistiré":"Sin confirmar"}</span>
    </article>)}</div>}
   </section>
   <section className="dashboardSection">
    <div className="dashboardSectionHead"><h2>Últimos comunicados</h2><Link href="/panel/tablon">Ver tablón →</Link></div>
    {postsError?<p className="muted">No se pudo consultar el tablón.</p>:posts.length===0?<p className="dashboardEmpty">Todavía no hay comunicados publicados.</p>:
    <div className="dashboardPostList">{posts.map(post=><article key={post.id} className="dashboardPost">
     <div className="dashboardPostHead">{post.priority==="importante"&&<span className="dashboardImportant">Importante</span>}<small>{dateOnly.format(new Date(post.created_at))}</small></div>
     <h3>{post.title}</h3><p>{post.content.length>165?post.content.slice(0,165)+"…":post.content}</p>
    </article>)}</div>}
   </section>
  </div>
  
  <section className="dashboardLinks">
   <div className="dashboardSectionHead"><h2>Tu espacio</h2></div>
   <div className="dashboardLinkGrid">{[...shortcuts,...(canReviewAbsences?[{href:"/panel/justificaciones",icon:"✓",name:"Justificaciones",detail:"Avisos privados de ausencia"}]:[])].map(item=><Link key={item.href} href={item.href} className="dashboardLink">
    <span className="dashboardLinkIcon">{item.icon}</span><strong>{item.name}</strong><small>{item.detail}</small>
   </Link>)}</div>
  </section>
  
  <div className="logoutArea"><LogoutButton/></div>
 </main>;
}

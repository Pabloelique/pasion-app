import {redirect} from "next/navigation";
import Link from "next/link";
import {getSupabaseServer} from "@/lib/supabase/server";
import LogoutButton from "./salir";
import MusicianDashboard from "./musician-dashboard";

export const dynamic="force-dynamic";

type EventItem={id:string;title:string;event_type:string;location:string;starts_at:string};
type PostItem={id:string;title:string;content:string;priority:string;created_at:string};
type ResponseItem={event_id:string;response:string};
type AttendanceTotal={member_id:string;attended:number;absent:number;justified:number};

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
const management=[
 {href:"/panel/solicitudes",icon:"◎",name:"Solicitudes",detail:"Aprobaciones de acceso"},
 {href:"/panel/miembros",icon:"♙",name:"Miembros",detail:"Integrantes y permisos"},
 {href:"/panel/asistencia",icon:"✓",name:"Pasar lista",detail:"Control de ensayos"},
 {href:"/panel/actuaciones",icon:"♬",name:"Contrataciones",detail:"Cachés y actuaciones"},
 {href:"/panel/tesoreria",icon:"€",name:"Tesorería",detail:"Ingresos y gastos"},
 {href:"/panel/inventario",icon:"▣",name:"Inventario",detail:"Instrumentos y material"}
];

export default async function PanelPage(){
 const db=await getSupabaseServer();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect("/acceso");
 const {data:profile}=await db.from("profiles").select("first_name,last_name,role,requested_role,approval_status,musical_part_id").eq("id",user.id).single();
 if(!profile)return <main className="authShell"><section className="authCard"><h1>Perfil no disponible</h1><p>Tu cuenta existe, pero no hemos podido cargar tu perfil. Contacta con la directiva.</p><LogoutButton/></section></main>;
 if(profile.role==="viewer")redirect("/demo");
 if(profile.approval_status!=="approved")return <main className="authShell"><section className="authCard">
  <span className="eyebrow">SOLICITUD DE ACCESO</span>
  <h1>{profile.approval_status==="rejected"?"Solicitud no aprobada":"Pendiente de aprobación"}</h1>
  <p>Hola, {profile.first_name||"músico"}. {profile.approval_status==="rejected"?"La directiva no ha aprobado la solicitud. Contacta con la agrupación.":profile.requested_role==="directiva"?"Tu solicitud de directiva debe ser revisada por el superadmin.":"Un miembro de la directiva debe aprobar tu acceso."}</p>
  <p className="muted">Mientras tanto, la información interna permanece bloqueada.</p><LogoutButton/>
 </section></main>;

 const {data:canReviewAbsences}=await db.rpc("can_review_absences");
 const manager=profile.role==="directiva"||profile.role==="superadmin";
 const now=new Date().toISOString();
 const [eventsResult,postsResult,responsesResult,proposalsResult,notificationsResult]=await Promise.all([
  db.from("band_events").select("id,title,event_type,location,starts_at").gte("starts_at",now).order("starts_at",{ascending:true}).limit(5),
  db.from("board_posts").select("id,title,content,priority,created_at").order("created_at",{ascending:false}).limit(5),
  db.from("event_responses").select("event_id,response").eq("user_id",user.id).limit(50),
  db.from("march_proposals").select("id,closes_at,closed_at").is("closed_at",null).gt("closes_at",now).limit(100),
  db.from("app_notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null)
 ]);
 const events=(eventsResult.data??[]) as EventItem[];
 const posts=(postsResult.data??[]) as PostItem[];
 const responses=new Map(((responsesResult.data??[]) as ResponseItem[]).map(x=>[x.event_id,x.response]));
 const openVotes=proposalsResult.error?null:(proposalsResult.data??[]).length;
 const important=posts.filter(p=>p.priority==="importante");
 const unread=notificationsResult.error?null:(notificationsResult.count??0);
 const issues=[eventsResult.error,postsResult.error,responsesResult.error].some(Boolean);
 const [pendingResult,attendanceResult]=manager?await Promise.all([
  db.from("profiles").select("id",{count:"exact",head:true}).eq("approval_status","pending"),
  db.rpc("attendance_summary")
 ]):[null,null];
 const attendance=(attendanceResult?.data??[]) as AttendanceTotal[];
 const totalMissing=attendance.reduce((sum,row)=>sum+Number(row.absent||0),0);
 const totalPresent=attendance.reduce((sum,row)=>sum+Number(row.attended||0),0);
 if(!manager)return <MusicianDashboard profile={{first_name:profile.first_name}} events={events} posts={posts} responseItems={(responsesResult.data??[]) as ResponseItem[]} openVotes={openVotes} unread={unread} eventsError={!!eventsResult.error} postsError={!!postsResult.error} issues={issues} canReviewAbsences={canReviewAbsences===true}/>;
 return <main className="container dashboard">
  <header className="header dashboardHeader">
   <span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN DE MAZARRÓN</small><h1>PASIÓN APP</h1></div>
   <div className="dashboardHeaderActions"><Link href="/panel/notificaciones" className="dashboardBell" aria-label={unread===null?"Abrir notificaciones":unread+" notificaciones sin leer"}><span aria-hidden="true">♧</span>{unread!==null&&unread>0&&<span className="dashboardBellCount">{unread>99?"99+":unread}</span>}</Link><span className="dashboardRole">{profile.role==="superadmin"?"Superadmin":manager?"Directiva":"Músico"}</span></div>
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
   <div><span>Próximas actividades</span><strong>{eventsResult.error?"—":events.length}</strong><small>Eventos visibles</small></div>
   <div><span>Comunicados importantes</span><strong>{postsResult.error?"—":important.length}</strong><small>Entre los cinco últimos</small></div>
   <div><span>Votaciones abiertas</span><strong>{openVotes??"—"}</strong><small>Propuestas activas</small></div>
   {manager&&<div><span>Solicitudes pendientes</span><strong>{pendingResult?.error?"—":pendingResult?.count??0}</strong><small>Accesos por revisar</small></div>}
  </section>
  <div className="dashboardColumns">
   <section className="dashboardSection">
    <div className="dashboardSectionHead"><h2>Próximos ensayos y actuaciones</h2><Link href="/panel/calendario">Ver calendario →</Link></div>
    {eventsResult.error?<p className="muted">No se pudo consultar el calendario.</p>:events.length===0?<p className="dashboardEmpty">No hay actividades próximas programadas.</p>:
    <div className="dashboardEventList">{events.map(ev=><article key={ev.id} className="dashboardEvent">
     <span className="dashboardEventDate">{dateOnly.format(new Date(ev.starts_at))}</span>
     <div><span className="dashboardEventType">{eventNames[ev.event_type]??"Actividad"}</span><h3>{ev.title}</h3><p>{dateTime.format(new Date(ev.starts_at))}{ev.location?" · "+ev.location:""}</p></div>
     <span className="dashboardResponse">{responses.get(ev.id)==="asistire"?"Asistiré":responses.get(ev.id)==="no_asistire"?"No asistiré":"Sin confirmar"}</span>
    </article>)}</div>}
   </section>
   <section className="dashboardSection">
    <div className="dashboardSectionHead"><h2>Últimos comunicados</h2><Link href="/panel/tablon">Ver tablón →</Link></div>
    {postsResult.error?<p className="muted">No se pudo consultar el tablón.</p>:posts.length===0?<p className="dashboardEmpty">Todavía no hay comunicados publicados.</p>:
    <div className="dashboardPostList">{posts.map(post=><article key={post.id} className="dashboardPost">
     <div className="dashboardPostHead">{post.priority==="importante"&&<span className="dashboardImportant">Importante</span>}<small>{dateOnly.format(new Date(post.created_at))}</small></div>
     <h3>{post.title}</h3><p>{post.content.length>165?post.content.slice(0,165)+"…":post.content}</p>
    </article>)}</div>}
   </section>
  </div>
  {manager&&<section className="dashboardManagerHighlight">
   <div><span className="eyebrow">GESTIÓN DE LA AGRUPACIÓN</span><h2>Resumen para la directiva</h2><p>Asistencias registradas: <strong>{attendanceResult?.error?"No disponibles":totalPresent+" presentes · "+totalMissing+" ausencias"}</strong></p></div>
   <Link href="/panel/asistencia" className="secondaryButton linkButton">Gestionar asistencia</Link>
  </section>}
  <section className="dashboardLinks">
   <div className="dashboardSectionHead"><h2>Tu espacio</h2></div>
   <div className="dashboardLinkGrid">{[...shortcuts,...(canReviewAbsences?[{href:"/panel/justificaciones",icon:"✓",name:"Justificaciones",detail:"Avisos privados de ausencia"}]:[])].map(item=><Link key={item.href} href={item.href} className="dashboardLink">
    <span className="dashboardLinkIcon">{item.icon}</span><strong>{item.name}</strong><small>{item.detail}</small>
   </Link>)}</div>
  </section>
  {manager&&<section className="dashboardLinks"><div className="dashboardSectionHead"><h2>Herramientas de directiva</h2></div>
   <div className="dashboardLinkGrid">{management.map(item=><Link key={item.href} href={item.href} className="dashboardLink">
    <span className="dashboardLinkIcon">{item.icon}</span><strong>{item.name}</strong><small>{item.detail}</small>
   </Link>)}</div>
  </section>}
  <div className="logoutArea"><LogoutButton/></div>
 </main>;
}

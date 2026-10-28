"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import LogoutButton from "../panel/salir";
const sections=[
 ["inicio","Inicio"],["calendario","Calendario"],["partituras","Partituras"],["ensayos","Plan de ensayos"],["repertorio","Repertorio"],
 ["asistencia","Mi asistencia"],["tablon","Tablón"],["votaciones","Votación de nuevas marchas"],
 ["miembros","Miembros"],["actuaciones","Contrataciones"],["tesoreria","Tesorería"],["inventario","Inventario"],["solicitudes","Solicitudes"]
];
const samples:Record<string,{title:string;text:string}[]>={
 calendario:[{title:"Ensayo de ejemplo",text:"Lunes · 19:30–21:00 · Sala ficticia · Convocatoria general"},{title:"Actuación de demostración",text:"Sábado · 18:00 · Plaza de ejemplo"}],
 ensayos:[{title:"Marcha de muestra A",text:"Objetivo de ejemplo: trabajar la entrada y el ritmo."},{title:"Marcha de muestra B",text:"Objetivo de ejemplo: repasar el final."}],
 repertorio:[{title:"Marcha ficticia A",text:"Autor de ejemplo · Estado: en preparación"},{title:"Marcha ficticia B",text:"Autor de ejemplo · Estado: en repertorio"}],
 asistencia:[{title:"Resumen de ejemplo",text:"8 asistencias · 1 ausencia justificada · Son cifras inventadas."}],
 tablon:[{title:"Bienvenida a la demostración",text:"Este es un comunicado ficticio. Aquí se mostrarían los anuncios internos, con sus mensajes completos y botones de acceso."}],
 miembros:[{title:"Persona de ejemplo 01",text:"Músico ficticio · Instrumento de ejemplo A"},{title:"Persona de ejemplo 02",text:"Directiva ficticia · Instrumento de ejemplo B"}],
 actuaciones:[{title:"Contrato de ejemplo",text:"Actuación ficticia · Importe de muestra: 500 € · Estado: pendiente"}],
 tesoreria:[{title:"Saldo de ejemplo: 1.000 €",text:"Ingreso ficticio: 1.200 € · Gasto ficticio: 200 € · No son las cuentas de la agrupación."}],
 inventario:[{title:"Instrumento de ejemplo A",text:"Referencia ficticia DEMO-01 · Estado: disponible"},{title:"Uniforme de ejemplo",text:"Referencia ficticia DEMO-02 · Estado: asignado a una persona inventada"}],
 solicitudes:[{title:"Solicitud de ejemplo",text:"Persona ficticia · Rol solicitado: músico · Las acciones están deshabilitadas."}]
};
export default function DemoApp({initialSeconds,preview}:{initialSeconds:number;preview:boolean}){
 const [remaining,setRemaining]=useState(initialSeconds);
 const [section,setSection]=useState("inicio");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(preview)return;
  let active=true;let deadline=performance.now()+initialSeconds*1000;
  const tick=()=>{if(active)setRemaining(Math.max(0,Math.ceil((deadline-performance.now())/1000)));};
  async function check(){
   try{
    const response=await fetch("/api/demo-access",{cache:"no-store"});
    const access=await response.json();
    if(!active)return;
    deadline=performance.now()+(response.ok&&access.allowed?Number(access.remainingSeconds)||0:0)*1000;tick();
   }catch{if(active){deadline=0;tick();setMessage("Conecta a Internet para verificar tu autorización.");}}
  }
  void check();const clock=setInterval(tick,1000),verify=setInterval(()=>void check(),15000);
  window.addEventListener("focus",check);
  return()=>{active=false;clearInterval(clock);clearInterval(verify);window.removeEventListener("focus",check);};
 },[initialSeconds,preview]);
 async function request(){
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/demo-access",{method:"POST"});setMessage(r.ok?"Solicitud enviada. El superadmin debe autorizar otros 15 minutos.":"No se pudo enviar la solicitud. Vuelve a iniciar sesión.");}
  catch{setMessage("No hay conexión. Inténtalo de nuevo.");}
  finally{setBusy(false);}
 }
 if(!preview&&remaining<=0)return <main className="authShell"><section className="authCard">
  <span className="eyebrow">VIEWER · ACCESO TEMPORAL</span><h1>Esperando autorización</h1>
  <p>El superadmin debe autorizar cada visita. Dispondrás de 15 minutos desde su aprobación para explorar ejemplos ficticios.</p>
  <p className="muted">Si tu visita ha caducado, puedes usar las mismas credenciales, pero volver a iniciar sesión no renueva el tiempo.</p>
  <button type="button" className="primaryButton" disabled={busy} onClick={()=>void request()}>{busy?"Enviando…":"Solicitar 15 minutos"}</button>
  {message&&<p className="muted" role="status">{message}</p>}<LogoutButton/>
 </section></main>;
 return <main className="container">
  <header className="header"><span className="brandIcon">♫</span><div><small>PASIÓN APP · DEMOSTRACIÓN</small><h1>Vista de ejemplo</h1></div></header>
  <aside className="notice" aria-label="Aviso de demostración"><strong>Datos ficticios · Solo lectura</strong><p>Esta demostración no contiene información real de la agrupación ni de sus miembros.</p>
   <p role="timer">{preview?"Vista previa del superadmin": "Acceso restante: "+String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0")}</p>
  </aside>
  <nav className="demoNavigation" aria-label="Secciones de demostración">{sections.map(([id,title])=><button key={id} type="button" className={section===id?"primaryButton":"secondaryButton"} aria-current={section===id?"page":undefined} onClick={()=>setSection(id)}>{title}</button>)}</nav>
  <h2>{sections.find(([id])=>id===section)?.[1]}</h2>
  {section==="inicio"?<>
   <section className="hero"><h2>Bienvenido a la vista de ejemplo</h2><p>Explora cómo se organizan los ensayos, las partituras, los comunicados y la gestión. Todos los nombres, eventos y cifras de estas pantallas son inventados.</p></section>
   <div className="dashboardLinkGrid">{sections.slice(1).map(([id,title])=><button key={id} type="button" className="dashboardLink" onClick={()=>setSection(id)}><strong>{title}</strong><small>Ver ejemplos ficticios</small></button>)}</div>
  </>:section==="votaciones"?<article className="voteCard"><span className="votePill">Votación de ejemplo</span><h3>Elegir una marcha ficticia</h3><p className="muted">Recuento inventado: 12 votos.</p>
   {["Marcha de muestra A · 7 votos","Marcha de muestra B · 5 votos"].map(t=><div className="marchContestOption" key={t}><strong>{t}</strong><button className="secondaryButton" type="button" disabled>Solo lectura</button></div>)}
  </article>:section==="partituras"?<article className="scoreUpload"><h3>Partitura ficticia</h3><p className="muted">Pentagrama creado para esta demostración. No se cargan documentos, audios ni archivos reales.</p><svg viewBox="0 0 500 150" role="img" aria-label="Pentagrama con notas de ejemplo" style={{background:"var(--paper)",color:"var(--button-text)",width:"100%",borderRadius:12}}>
   {[40,55,70,85,100].map(y=><line key={y} x1="20" y1={y} x2="480" y2={y} stroke="currentColor"/>)}
   {[80,160,240,320,400].map((x,i)=><g key={x}><ellipse cx={x} cy={85-i%3*15} rx="8" ry="6" fill="currentColor"/><line x1={x+7} y1={85-i%3*15} x2={x+7} y2={40-i%3*15} stroke="currentColor" strokeWidth="2"/></g>)}
  </svg></article>:<div className="requestGrid">{(samples[section]??[]).map(item=><article className="requestCard" key={item.title}><span className="eyebrow">EJEMPLO FICTICIO</span><h3>{item.title}</h3><p className="muted">{item.text}</p>{section==="solicitudes"&&<button type="button" disabled className="secondaryButton">Solo lectura</button>}</article>)}</div>}
  <p className="muted small">Las publicaciones, votos, cambios de miembros, pagos y descargas no están disponibles en el modo viewer.</p>
  {preview&&<Link className="backLink" href="/panel/miembros">← Volver a Gestión de miembros</Link>}<LogoutButton/>
 </main>;
}

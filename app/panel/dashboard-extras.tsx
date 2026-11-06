"use client";
import {useEffect,useState} from "react";
import Link from "@/lib/app-data";
import {useAppDatabase,useDemoMode} from "@/lib/app-data";
import {semanaSantaCountdown} from "@/lib/semana-santa";

type Birthday={user_id:string;display_name:string;part_name:string|null;day:number;month:number;days_until:number};
const longDate=new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long",timeZone:"Europe/Madrid"});
const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function SemanaSanta(){
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const t=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(t);},[]);
 if(!now)return <section className="countdownCard" aria-busy="true"><span className="eyebrow">CUENTA ATRÁS</span><h2>Semana Santa</h2></section>;
 const c=semanaSantaCountdown(now);
 if(c.state==="during")return <section className="countdownCard during"><span className="eyebrow">SEMANA SANTA {c.year}</span><h2>¡Ya es Semana Santa! 🎺</h2><p>Mucha suerte en cada salida. Revisa el calendario para tus horarios.</p></section>;
 const ms=c.target.getTime()-now.getTime();
 const days=Math.floor(ms/86400000),hours=Math.floor(ms/3600000)%24,minutes=Math.floor(ms/60000)%60,seconds=Math.floor(ms/1000)%60;
 return <section className="countdownCard" aria-label={"Faltan "+days+" días para el Viernes de Dolores"}>
  <span className="eyebrow">CUENTA ATRÁS · SEMANA SANTA {c.year}</span>
  <div className="countdownNumbers">
   <div><strong>{days}</strong><small>días</small></div>
   <div><strong>{String(hours).padStart(2,"0")}</strong><small>horas</small></div>
   <div><strong>{String(minutes).padStart(2,"0")}</strong><small>min</small></div>
   <div><strong>{String(seconds).padStart(2,"0")}</strong><small>seg</small></div>
  </div>
  <p>Viernes de Dolores: <strong>{longDate.format(c.dolores)}</strong> · Domingo de Ramos: <strong>{longDate.format(c.ramos)}</strong></p>
 </section>;
}

function Birthdays(){
 const db=useAppDatabase();
 const [list,setList]=useState<Birthday[]|null>(null);
 useEffect(()=>{void db.rpc("upcoming_birthdays",{p_days:30}).then(({data,error})=>setList(error?[]:(data??[]) as Birthday[]));},[db]);
 if(!list||list.length===0)return null;
 const today=list.filter(b=>b.days_until===0);
 const soon=list.filter(b=>b.days_until>0).slice(0,5);
 return <section className="birthdayCard">
  <span className="eyebrow">CUMPLEAÑOS</span>
  {today.length>0&&<div className="birthdayToday">
   <h2>🎂 Hoy cumple{today.length>1?"n":""} {today.map(b=>b.display_name).join(" y ")}</h2>
   <Link href="/panel/tablon" className="primaryButton linkButton">Felicitar en el tablón 🎉</Link>
  </div>}
  {soon.length>0&&<ul className="birthdayList">{soon.map(b=><li key={b.user_id}>
   <strong>{b.display_name}</strong>{b.part_name?<span className="muted"> · {b.part_name}</span>:null}
   <span className="birthdayWhen">{b.days_until===1?"mañana":b.day+" de "+months[b.month-1]}</span>
  </li>)}</ul>}
 </section>;
}

/** Recordatorio para quien todavía no recibe avisos en este móvil. */
function PushNudge(){
 const [show,setShow]=useState(false);
 useEffect(()=>{
  let active=true;
  (async()=>{
   if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))return;
   if(Notification.permission!=="granted"){if(active)setShow(true);return;}
   try{const reg=await navigator.serviceWorker.getRegistration("/");const sub=await reg?.pushManager.getSubscription();if(active)setShow(!sub);}catch{}
  })();
  return()=>{active=false;};
 },[]);
 if(!show)return null;
 return <section className="pushNudge" role="status">
  <span aria-hidden="true">🔔</span>
  <div><strong>Activa los avisos en este móvil</strong><p>Así te llegan los recordatorios de ensayo y podrás confirmar tu asistencia desde la propia notificación.</p></div>
  <Link href="/panel/notificaciones" className="primaryButton linkButton">Activar</Link>
 </section>;
}

export default function DashboardExtras(){
 const demo=useDemoMode();
 return <>
  {!demo&&<PushNudge/>}
  <div className="dashboardExtras">
   <SemanaSanta/>
   {!demo&&<Birthdays/>}
  </div>
 </>;
}

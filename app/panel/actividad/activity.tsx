"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Activity={user_id:string;member_name:string;online:boolean;sections:string|null;last_access:string|null};
const date=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"});
export default function Activity(){
 const [people,setPeople]=useState<Activity[]>([]);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true,inFlight=false;
  async function load(){
   if(inFlight||document.visibilityState!=="visible")return;
   inFlight=true;
   try{
    const {data,error:err}=await getSupabaseBrowser().rpc("superadmin_app_activity");
    if(!active)return;
    if(err){setPeople([]);setError("No se ha podido consultar la actividad.");}
    else{setPeople((data??[]) as Activity[]);setError("");}
   }catch{if(active){setPeople([]);setError("No se ha podido actualizar la actividad.");}}
   finally{inFlight=false;if(active)setLoading(false);}
  }
  void load();const timer=window.setInterval(()=>void load(),15000);
  const resume=()=>void load();document.addEventListener("visibilitychange",resume);window.addEventListener("focus",resume);
  return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",resume);window.removeEventListener("focus",resume);};
 },[]);
 return <main className="container"><Link className="backLink" href="/panel">← Volver al panel</Link>
  <h1>Actividad de usuarios</h1><p className="muted">Solo superadmin. Conectado significa que tiene la app visible y ha enviado una señal en los últimos 90 segundos. La lista se actualiza cada 15 segundos.</p>
  <p className="muted">El último acceso muestra la fecha más reciente entre la actividad detectada por la app y el último inicio de sesión recuperado desde el 27 de octubre de 2026. Los inicios de sesión históricos no indican la sección visitada ni el tiempo conectado. No se registra el contenido que leen ni lo que escriben.</p>
  {loading&&<p role="status">Cargando actividad…</p>}{error&&<p className="formError" role="alert">{error}</p>}
  {!loading&&!error&&<><p><strong>{people.filter(p=>p.online).length} conectados</strong> · {people.length} miembros</p>
  <div className="requestGrid">{people.map(p=><article key={p.user_id} className="requestCard"><h2>{p.member_name||"Miembro"}</h2>
   <p className={p.online?"formSuccess":"muted"}>{p.online?"Conectado":"Desconectado"}</p>
   {p.online&&<p><strong>Sección:</strong> {p.sections||"—"}</p>}
   <p className="muted">Último acceso: {p.last_access?date.format(new Date(p.last_access)):"Sin acceso registrado"}</p>
  </article>)}</div></>}
 </main>;
}

"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {getSupabaseBrowser} from "@/lib/supabase/client";

const sections:Record<string,string>={"":"Inicio",calendario:"Calendario",partituras:"Partituras",ensayos:"Plan de ensayos",repertorio:"Repertorio","mi-asistencia":"Mi asistencia",tablon:"Tablón",votaciones:"Votaciones",notificaciones:"Notificaciones",solicitudes:"Solicitudes",miembros:"Miembros",asistencia:"Asistencia",actuaciones:"Actuaciones",tesoreria:"Tesorería",inventario:"Inventario",justificaciones:"Justificaciones",viewers:"Accesos demo",actividad:"Actividad de usuarios"};
export default function PresenceTracker(){
 const pathname=usePathname();
 useEffect(()=>{
  const session=crypto.randomUUID();
  const section=sections[pathname.split("/")[2]??""]??"Otra sección";
  let stopped=false;
  let inFlight=false;
  const db=getSupabaseBrowser();
  async function report(visible:boolean){
   if(stopped||inFlight)return;
   inFlight=true;
   try{await db.rpc("touch_app_presence",{target_session:session,current_section:section,is_visible:visible});}catch{}finally{inFlight=false;}
  }
  const update=()=>void report(document.visibilityState==="visible");
  update();
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")update();},30000);
  document.addEventListener("visibilitychange",update);
  const leave=()=>void report(false);
  window.addEventListener("pagehide",leave);
  return()=>{leave();stopped=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",update);window.removeEventListener("pagehide",leave);};
 },[pathname]);
 return null;
}

"use client";
import {useEffect,useState} from "react";
import {useAppDatabase} from "@/lib/app-data";
type Person={user_id:string;member_name:string;willing:boolean;answered_at:string};
export default function ContributionPeople({contestId}:{contestId:string}){
 const db=useAppDatabase();
 const [people,setPeople]=useState<Person[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  let active=true,inFlight=false;
  async function update(){
   if(!active||inFlight||document.visibilityState==="hidden")return;
   inFlight=true;
   try{
    const result=await db.rpc("march_contribution_people",{target_contest:contestId});
    if(!active)return;
    if(result.error){setPeople([]);setError("No se pueden consultar las respuestas o ya no tienes permiso.");}
    else{setPeople((result.data??[]) as Person[]);setError("");}
   }catch{if(active){setPeople([]);setError("No se pudieron actualizar las respuestas.");}}
   finally{inFlight=false;if(active)setLoading(false);}
  }
  void update();
  const timer=setInterval(()=>void update(),5000);
  window.addEventListener("focus",update);document.addEventListener("visibilitychange",update);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update);};
 },[contestId,db]);
 return <section className="notice" aria-label="Respuestas privadas de aportación">
  <h4>Quién ha respondido · Solo superadmin</h4>
  {error?<p className="formError" role="alert">{error}</p>:loading?<p className="muted">Cargando respuestas…</p>:people.length===0?<p className="muted">Todavía no hay respuestas.</p>:<ul>{people.map(person=><li key={person.user_id}><strong>{person.member_name||"Miembro"}</strong>: {person.willing?"Sí, aportaría":"No participaría"}</li>)}</ul>}
 </section>;
}

"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowser} from "@/lib/supabase/client";

const SNOOZE_DAYS=3;
/** Pide la fecha de cumpleaños la próxima vez que entra cada músico (si aún no la tiene registrada). */
export default function BirthdayPrompt({userId}:{userId:string}){
 const key="pasion-birthday-snooze-v1:"+userId;
 const [open,setOpen]=useState(false);
 const [value,setValue]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [done,setDone]=useState(false);
 useEffect(()=>{
  let active=true;
  try{const until=Number(localStorage.getItem(key)??0);if(until>Date.now())return;}catch{}
  void getSupabaseBrowser().rpc("my_birthday").then(({data,error:err})=>{if(active&&!err&&!data)setOpen(true);});
  return()=>{active=false;};
 },[key]);
 if(!open)return null;
 function later(){try{localStorage.setItem(key,String(Date.now()+SNOOZE_DAYS*86400000));}catch{}setOpen(false);}
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!value||busy)return;
  setBusy(true);setError("");
  const {error:err}=await getSupabaseBrowser().rpc("set_my_birthday",{p_birth_date:value});
  setBusy(false);
  if(err){setError(err.message.includes("válida")?"Introduce una fecha de nacimiento válida.":"No se ha podido guardar. Inténtalo de nuevo.");return;}
  setDone(true);window.setTimeout(()=>setOpen(false),1800);
 }
 const max=new Date(Date.now()-5*365*86400000).toISOString().slice(0,10);
 return <div className="birthdayPrompt" role="dialog" aria-modal="true" aria-labelledby="birthday-title">
  <form className="birthdayPromptCard" onSubmit={e=>void save(e)}>
   {done?<><h2 id="birthday-title">🎉 ¡Apuntado!</h2><p>El día de tu cumpleaños lo anunciaremos en el tablón para que toda la agrupación te felicite.</p></>:<>
   <span className="eyebrow">NUEVO EN PASIÓN APP</span>
   <h2 id="birthday-title">🎂 ¿Cuándo es tu cumpleaños?</h2>
   <p>Ese día lo publicaremos en el tablón para que tus compañeros te feliciten. Los demás solo verán el día y el mes, nunca tu edad.</p>
   <label>Fecha de nacimiento<input type="date" required min="1920-01-01" max={max} value={value} onChange={e=>setValue(e.target.value)}/></label>
   {error&&<p role="alert" className="formError">{error}</p>}
   <div className="attendanceActions">
    <button type="submit" className="primaryButton" disabled={busy||!value}>{busy?"Guardando…":"Guardar"}</button>
    <button type="button" className="secondaryButton" onClick={later}>Ahora no</button>
   </div></>}
  </form>
 </div>;
}

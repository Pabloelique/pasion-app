"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
export default function ResetPassword(){
 const [password,setPassword]=useState("");
 const [repeat,setRepeat]=useState("");
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  void getSupabaseBrowser().auth.getUser().then(({data})=>{
   if(active)setReady(Boolean(data.user));
  }).catch(()=>{if(active)setReady(false);});
  return()=>{active=false};
 },[]);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(password.length<12||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)){
   setError("La contraseña debe tener 12 caracteres como mínimo, letras y números.");return;
  }
  if(password!==repeat){setError("Las dos contraseñas no coinciden.");return;}
  setBusy(true);setError("");
  const {error:err}=await getSupabaseBrowser().auth.updateUser({password});
  setBusy(false);
  if(err){setError(err.message);return;}
  setDone(true);setPassword("");setRepeat("");
  await getSupabaseBrowser().auth.signOut();
 }
 return <main className="authShell"><section className="authCard">
  <div className="authHeading"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><span className="eyebrow">LA PASIÓN DE MAZARRÓN</span><h1>Nueva contraseña</h1></div></div>
  {done?<><h2>Contraseña actualizada</h2><p className="muted">Ya puedes entrar en PASIÓN APP con tu Gmail y la contraseña nueva. Tu cuenta, instrumento y permisos siguen siendo los mismos.</p><Link href="/acceso" className="primaryButton linkButton">Iniciar sesión</Link></>:!ready?<><p className="muted">No hemos podido comprobar un enlace de recuperación válido. Abre el enlace de tu correo o solicita otro.</p><Link href="/recuperar-contrasena" className="secondaryButton linkButton">Solicitar otro enlace</Link></>:<>
   <p className="muted">Elige una contraseña nueva de 12 caracteres o más, con letras y números.</p>
   <form className="authForm" onSubmit={e=>void save(e)}>
    <label>Contraseña nueva<input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Repite la contraseña nueva<input required type="password" autoComplete="new-password" minLength={12} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
    {error&&<p className="formError" role="alert">{error}</p>}
    <button className="primaryButton" type="submit" disabled={busy}>{busy?"Guardando…":"Cambiar contraseña"}</button>
   </form>
  </>}
 </section></main>;
}

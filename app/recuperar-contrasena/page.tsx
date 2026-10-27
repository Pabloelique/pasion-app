"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
export default function ForgotPassword(){
 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [sent,setSent]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError("");
  try{
   const {error:err}=await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(),{
    redirectTo:window.location.origin+"/auth/callback?next=/restablecer-contrasena"
   });
   if(err)throw err;
   setSent(true);
  }catch(err){
   const message=err instanceof Error?err.message:"No se pudo solicitar el enlace.";
   setError(/rate limit|too many requests|429/i.test(message)?"Se han solicitado demasiados correos. Espera un poco antes de volver a intentarlo.":message);
  }finally{setBusy(false);}
 }
 return <main className="authShell">
  <Link className="backLink" href="/acceso">← Volver a iniciar sesión</Link>
  <section className="authCard">
   <div className="authHeading"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><span className="eyebrow">LA PASIÓN DE MAZARRÓN</span><h1>Recuperar contraseña</h1></div></div>
   {sent?<><h2>Revisa tu Gmail</h2><p className="muted">Si existe una cuenta con ese correo, recibirás un enlace para crear otra contraseña. Comprueba también la carpeta Spam o Correo no deseado.</p><p className="muted small">El enlace es personal y tiene un tiempo limitado. No lo compartas con nadie.</p><button className="secondaryButton" type="button" onClick={()=>setSent(false)}>Solicitar otro enlace</button></>:<>
    <p className="muted">Escribe el mismo Gmail que usaste para registrarte. Te enviaremos un enlace para elegir una contraseña nueva, sin borrar tu cuenta.</p>
    <form className="authForm" onSubmit={e=>void submit(e)}>
     <label>Tu correo Gmail<input required type="email" autoComplete="email" placeholder="ejemplo@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
     {error&&<p className="formError" role="alert">{error}</p>}
     <button className="primaryButton" type="submit" disabled={busy}>{busy?"Enviando…":"Enviar enlace de recuperación"}</button>
    </form>
   </>}
  </section>
 </main>;
}

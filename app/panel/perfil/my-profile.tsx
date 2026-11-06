"use client";
import {useEffect,useState} from "react";
import Link from "@/lib/app-data";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {cleanHandle,type Network} from "@/lib/profile-utils";
import Avatar,{prepareAvatar,useAvatarUrls} from "./avatar";

type Profile={first_name:string;last_name:string;avatar_url:string|null;favorite_march:string|null;bio:string|null;instagram:string|null;tiktok:string|null;facebook:string|null};
const networks:{id:Network;label:string;placeholder:string}[]=[
 {id:"instagram",label:"Instagram",placeholder:"@tu_usuario"},
 {id:"tiktok",label:"TikTok",placeholder:"@tu_usuario"},
 {id:"facebook",label:"Facebook",placeholder:"tu.usuario o enlace"},
];

export default function MyProfile({userId,partName,roleLabel}:{userId:string;partName:string|null;roleLabel:string}){
 const db=getSupabaseBrowser();
 const [loading,setLoading]=useState(true);
 const [form,setForm]=useState({first_name:"",last_name:"",favorite_march:"",bio:"",instagram:"",tiktok:"",facebook:""});
 const [avatarPath,setAvatarPath]=useState<string|null>(null);
 const [newPhoto,setNewPhoto]=useState<{blob:Blob;preview:string}|null>(null);
 const [removePhoto,setRemovePhoto]=useState(false);
 const [birthday,setBirthday]=useState("");
 const [savedBirthday,setSavedBirthday]=useState("");
 const [marches,setMarches]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const signed=useAvatarUrls([avatarPath]);

 useEffect(()=>{
  let active=true;
  void Promise.all([
   db.from("profiles").select("first_name,last_name,avatar_url,favorite_march,bio,instagram,tiktok,facebook").eq("id",userId).single(),
   db.rpc("my_birthday"),
   db.from("band_repertoire").select("title").order("title"),
  ]).then(([p,b,r])=>{
   if(!active)return;
   if(p.error){setError("No se ha podido cargar tu perfil.");setLoading(false);return;}
   const data=p.data as Profile;
   setForm({first_name:data.first_name??"",last_name:data.last_name??"",favorite_march:data.favorite_march??"",bio:data.bio??"",
    instagram:data.instagram?"@"+data.instagram:"",tiktok:data.tiktok?"@"+data.tiktok:"",facebook:data.facebook??""});
   setAvatarPath(data.avatar_url);
   if(typeof b.data==="string"){setBirthday(b.data);setSavedBirthday(b.data);}
   setMarches(((r.data??[]) as {title:string}[]).map(x=>x.title));
   setLoading(false);
  });
  return()=>{active=false;};
 },[db,userId]);
 useEffect(()=>()=>{if(newPhoto)URL.revokeObjectURL(newPhoto.preview);},[newPhoto]);

 const set=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm(old=>({...old,[key]:e.target.value}));
 async function pickPhoto(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  if(!file.type.startsWith("image/")){setError("Elige una imagen (JPG, PNG o WebP).");return;}
  if(file.size>15*1024*1024){setError("La foto es demasiado grande.");return;}
  try{const blob=await prepareAvatar(file);setNewPhoto({blob,preview:URL.createObjectURL(blob)});setRemovePhoto(false);setError("");}
  catch{setError("No se ha podido leer esa foto. Prueba con otra.");}
 }
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setError("");setMessage("");
  const handles:Record<Network,string>={instagram:"",tiktok:"",facebook:""};
  for(const n of networks){
   const v=cleanHandle(n.id,form[n.id]);
   if(v===null){setError(`El usuario de ${n.label} no es válido. Escribe solo tu usuario, por ejemplo @tu_usuario.`);return;}
   handles[n.id]=v;
  }
  setBusy(true);
  let path=removePhoto?null:avatarPath;
  let uploaded:string|null=null;
  try{
   if(newPhoto){
    uploaded=`${userId}/${crypto.randomUUID()}.jpg`;
    const {error:up}=await db.storage.from("avatars").upload(uploaded,newPhoto.blob,{contentType:"image/jpeg",upsert:false});
    if(up)throw new Error("No se ha podido subir la foto.");
    path=uploaded;
   }
   const {error:err}=await db.rpc("update_my_profile",{
    p_first_name:form.first_name.trim(),p_last_name:form.last_name.trim(),
    p_favorite_march:form.favorite_march.trim()||null,p_bio:form.bio.trim()||null,
    p_instagram:handles.instagram||null,p_tiktok:handles.tiktok||null,p_facebook:handles.facebook||null,
    p_avatar_path:path});
   if(err)throw new Error(err.message.includes("nombre")?"Escribe tu nombre y apellidos.":"No se ha podido guardar el perfil.");
   if(birthday&&birthday!==savedBirthday){
    const {error:bErr}=await db.rpc("set_my_birthday",{p_birth_date:birthday});
    if(bErr)throw new Error("El perfil se ha guardado, pero la fecha de cumpleaños no es válida.");
    setSavedBirthday(birthday);
   }
   // Borra la foto anterior para no acumular archivos.
   if(avatarPath&&avatarPath!==path)void db.storage.from("avatars").remove([avatarPath]);
   setAvatarPath(path);setNewPhoto(null);setRemovePhoto(false);
   setForm(old=>({...old,instagram:handles.instagram?"@"+handles.instagram:"",tiktok:handles.tiktok?"@"+handles.tiktok:"",facebook:handles.facebook}));
   setMessage("¡Perfil guardado! Tus compañeros ya lo pueden ver en Componentes.");
  }catch(err){
   if(uploaded)void db.storage.from("avatars").remove([uploaded]);
   setError(err instanceof Error?err.message:"No se ha podido guardar el perfil.");
  }finally{setBusy(false);}
 }
 const photo=newPhoto?.preview??(removePhoto?null:avatarPath?signed[avatarPath]:null);
 const max=new Date(Date.now()-5*365*86400000).toISOString().slice(0,10);
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Mi perfil</h1></div></header>
  {loading?<p className="muted">Cargando tu perfil…</p>:
  <form className="profileForm" onSubmit={e=>void save(e)}>
   <section className="profilePhoto">
    <Avatar src={photo} first={form.first_name} last={form.last_name} size={112}/>
    <div>
     <strong>{form.first_name} {form.last_name}</strong>
     <p className="muted small">{[partName,roleLabel].filter(Boolean).join(" · ")}</p>
     <div className="attendanceActions">
      <label className="secondaryButton linkButton profileUpload">📷 {photo?"Cambiar foto":"Subir foto"}<input type="file" accept="image/*" onChange={e=>void pickPhoto(e)}/></label>
      {photo&&<button type="button" className="secondaryButton" onClick={()=>{setNewPhoto(null);setRemovePhoto(true);}}>Quitar foto</button>}
     </div>
     <p className="muted small">Solo la ven los miembros de la agrupación.</p>
    </div>
   </section>
   <fieldset className="profileFields"><legend>Datos</legend>
    <label>Nombre<input required maxLength={60} value={form.first_name} onChange={set("first_name")} autoComplete="given-name"/></label>
    <label>Apellidos<input required maxLength={80} value={form.last_name} onChange={set("last_name")} autoComplete="family-name"/></label>
    <label>Cumpleaños<input type="date" min="1920-01-01" max={max} value={birthday} onChange={e=>setBirthday(e.target.value)}/>
     <small className="muted">Tus compañeros solo verán el día y el mes, y ese día se publicará en el tablón para que te feliciten.</small></label>
    <label>Hilo musical<input value={partName??"Sin asignar"} disabled/><small className="muted">Lo asigna la directiva.</small></label>
   </fieldset>
   <fieldset className="profileFields"><legend>Música</legend>
    <label>Marcha favorita<input list="profile-marches" maxLength={120} value={form.favorite_march} onChange={set("favorite_march")} placeholder="Ej. Amarguras"/>
     <datalist id="profile-marches">{marches.map(m=><option key={m} value={m}/>)}</datalist></label>
    <label>Sobre mí<textarea rows={3} maxLength={280} value={form.bio} onChange={set("bio")} placeholder="Cuéntales algo a tus compañeros: desde cuándo tocas, tu marcha de la infancia…"/>
     <small className="muted">{form.bio.length}/280</small></label>
   </fieldset>
   <fieldset className="profileFields"><legend>Redes sociales</legend>
    {networks.map(n=><label key={n.id}>{n.label}<input value={form[n.id]} onChange={set(n.id)} placeholder={n.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></label>)}
    <small className="muted">Opcional. Puedes pegar el enlace de tu perfil o escribir tu usuario.</small>
   </fieldset>
   {error&&<p role="alert" className="formError">{error}</p>}
   {message&&<p role="status" className="formSuccess">{message}</p>}
   <div className="attendanceActions">
    <button type="submit" className="primaryButton" disabled={busy}>{busy?"Guardando…":"Guardar perfil"}</button>
    <Link href="/panel/componentes" className="secondaryButton linkButton">Ver componentes →</Link>
   </div>
  </form>}
 </main>;
}

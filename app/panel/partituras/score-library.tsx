"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Score={id:string;title:string;musical_part_id:number;storage_path:string;mime_type:string;created_at:string};
type Part={id:number;name:string};
const types:Record<string,string>={"application/pdf":"PDF","image/jpeg":"Imagen JPEG","image/png":"Imagen PNG","image/webp":"Imagen WebP","audio/mpeg":"Audio MP3","audio/wav":"Audio WAV","audio/x-wav":"Audio WAV","audio/mp4":"Audio M4A","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"Word DOCX"};
const extensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp","audio/mpeg":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/mp4":"m4a","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx"};
export default function ScoreLibrary({role,partId}:{role:string;partId:number|null}){
 const db=getSupabaseBrowser();
 const canUpload=role==="superadmin"||role==="directiva";
 const [parts,setParts]=useState<Part[]>([]);
 const [scores,setScores]=useState<Score[]>([]);
 const [fullScores,setFullScores]=useState<Score[]>([]);
 const [fullName,setFullName]=useState("");
 const [fullFile,setFullFile]=useState<File|null>(null);
 const [query,setQuery]=useState("");
 const [selectedPart,setSelectedPart]=useState<string>(canUpload?"all":String(partId??""));
 const [name,setName]=useState("");
 const [uploadPart,setUploadPart]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [view,setView]=useState<{title:string;url:string;mime:string}|null>(null);
 async function reload(){
  setLoading(true);setError("");
  const [s,p]=await Promise.all([db.from("march_scores").select("id,title,musical_part_id,storage_path,mime_type,created_at").order("title"),db.from("musical_parts").select("id,name").order("id")]);
  if(s.error)setError(s.error.message);else setScores((s.data??[]) as Score[]);
  if(p.error)setError(p.error.message);else {const arr=(p.data??[]) as Part[];setParts(arr);setUploadPart(old=>old||String(arr[0]?.id??""));}
  if(canUpload){const {data:all,error:fullError}=await db.from("full_scores").select("id,title,storage_path,mime_type,created_at").order("title");if(!fullError)setFullScores((all??[]) as Score[]);}
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const filtered=useMemo(()=>scores.filter(s=>(selectedPart==="all"||String(s.musical_part_id)===selectedPart)&&s.title.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))),[scores,selectedPart,query]);
 async function openScore(s:Score){
  setError("");
  const {data,error}=await db.storage.from("partituras").createSignedUrl(s.storage_path,300,{download:false});
  if(error||!data?.signedUrl){setError(error?.message??"No se pudo abrir el archivo.");return;}
  setView({title:s.title,url:data.signedUrl,mime:s.mime_type});
 }
 async function uploadFull(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!fullFile||!fullName.trim())return;
  const ext=fullFile.name.toLowerCase().split(".").pop()??"";
  const allowed=["pdf","mp3","wav","m4a","sib"];
  if(!allowed.includes(ext)){setError("Formato de guion no admitido.");return;}
  if(fullFile.size>20*1024*1024){setError("El archivo supera los 20 MB.");return;}
  if(!window.confirm(`¿Guardar «${fullName}» como guion completo exclusivo de directiva?`))return;
  setBusy(true);setError("");setMessage("");
  const path=`guiones/${crypto.randomUUID()}.${ext}`;
  try {
    const {error:uploaded}=await db.storage.from("partituras").upload(path,fullFile,{contentType:ext==="sib"?"application/octet-stream":fullFile.type||"application/octet-stream",upsert:false});
    if(uploaded)throw uploaded;
    const mime=ext==="sib"?"application/octet-stream":fullFile.type||"application/octet-stream";
    const {error:saved}=await db.from("full_scores").insert({title:fullName.trim(),storage_path:path,mime_type:mime});
    if(saved)throw saved;
    setFullName("");setFullFile(null);setMessage("Guion añadido al apartado exclusivo de directiva.");await reload();
  }catch(e){setError(e instanceof Error?e.message:"Error al subir el guion.");}
  finally{setBusy(false);}
 }
 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!file||!name.trim()||!uploadPart)return;
  const ext=extensions[file.type];
  if(!ext){setError("Formato no permitido. Sube PDF, PNG, JPG, WebP, MP3, WAV, M4A o DOCX.");return;}
  if(file.size>20*1024*1024){setError("Máximo 20 MB por archivo.");return;}
  if(!window.confirm(`¿Subir «${name.trim()}» para ${parts.find(p=>String(p.id)===uploadPart)?.name}?`))return;
  setBusy(true);setError("");setMessage("");
  const path=`${uploadPart}/${crypto.randomUUID()}.${ext}`;
  try{
   const {error:storageError}=await db.storage.from("partituras").upload(path,file,{contentType:file.type,upsert:false});
   if(storageError)throw storageError;
   const {error:recordError}=await db.from("march_scores").insert({title:name.trim(),musical_part_id:Number(uploadPart),storage_path:path,mime_type:file.type});
   if(recordError)throw recordError;
   setName("");setFile(null);setMessage("Archivo subido y publicado para el instrumento seleccionado.");await reload();
  }catch(err){setError(err instanceof Error?err.message:"No se pudo subir el archivo. Comprueba la migración SQL.");}
  finally{setBusy(false);}
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon">♫</span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Biblioteca de partituras</h1></div></header>
  <p className="muted">{canUpload?"Consulta todos los hilos y sube nuevos materiales musicales.":"Consulta los materiales de tu hilo musical. Los archivos son privados."}</p>
  {canUpload&&<section className="scoreUpload"><h2>Añadir material</h2><form onSubmit={e=>void upload(e)} className="scoreForm">
   <label>Título de la marcha o material<input value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="Ej. La Pasión — Corneta 1" required/></label>
   <label>Hilo musical<select value={uploadPart} onChange={e=>setUploadPart(e.target.value)} required>{parts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>Archivo<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.docx" onChange={e=>setFile(e.target.files?.[0]??null)} required/></label>
   <p className="muted small">Formatos admitidos en la app: PDF, imágenes, audio y DOCX. Límite: 20 MB por archivo.</p>
   <button className="primaryButton" type="submit" disabled={busy||!parts.length}>{busy?"Subiendo…":"Subir material"}</button>
  </form></section>}
  {canUpload&&<section className="scoreUpload"><h2>Guiones completos · Solo directiva</h2>
   <p className="muted">Esta sección está protegida también en Supabase y no es accesible para músicos.</p>
   <form className="scoreForm" onSubmit={e=>void uploadFull(e)}>
    <label>Marcha<input required maxLength={160} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nombre de la marcha"/></label>
    <label>Guion completo (PDF, MP3, WAV, M4A o Sibelius)<input required type="file" accept=".pdf,.mp3,.wav,.m4a,.sib" onChange={e=>setFullFile(e.target.files?.[0]??null)}/></label>
    <button type="submit" className="primaryButton" disabled={busy}>{busy?"Subiendo…":"Guardar guion para directiva"}</button>
   </form><div className="scoreGrid">{fullScores.map(s=><article className="requestCard" key={s.id}>
    <strong>{s.title}</strong><p className="muted small">{s.mime_type==="application/pdf"?"PDF":s.mime_type==="application/octet-stream"?"Sibelius":"Audio"}</p>
    <button className="secondaryButton" onClick={()=>void openScore(s)}>Consultar guion</button>
   </article>)}</div>
  </section>}
  <section className="scoreCatalog"><h2>Material disponible</h2><div className="memberFilters">
    <label>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar marcha…"/></label>
    {canUpload&&<label>Hilo musical<select value={selectedPart} onChange={e=>setSelectedPart(e.target.value)}><option value="all">Todos los hilos</option>{parts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
  </div>
  {error&&<p role="alert" className="formError">{error}</p>}
  {message&&<p role="status" className="formSuccess">{message}</p>}
  {loading?<p className="muted">Cargando biblioteca…</p>:filtered.length===0?<p className="muted">Todavía no hay materiales para este hilo.</p>:<div className="scoreGrid">{filtered.map(s=><article key={s.id} className="requestCard"><div className="memberHeader"><strong>{s.title}</strong><span className="memberTag">{types[s.mime_type]??"Archivo"}</span></div><p className="muted small">{parts.find(p=>p.id===s.musical_part_id)?.name??"Hilo musical"}</p><button className="primaryButton" onClick={()=>void openScore(s)}>Abrir material</button></article>)}</div>}
  </section>
  {view&&<section className="scoreViewer" role="dialog" aria-label={view.title}><div className="scoreViewTop"><strong>{view.title}</strong><button className="secondaryButton" onClick={()=>setView(null)}>Cerrar</button></div>
   {view.mime==="application/pdf"||view.mime.startsWith("image/")?<iframe className="scoreFrame" src={view.url} title={view.title} referrerPolicy="no-referrer"/>:view.mime.startsWith("audio/")?<audio controls src={view.url}/>:<p className="muted">Este documento no tiene visor integrado. La directiva puede facilitar una versión PDF para su consulta.</p>}
   <p className="muted small">Acceso temporal y personal. No compartas materiales de la agrupación. No es posible impedir todas las capturas o descargas mediante el navegador.</p>
  </section>}
 </main>;
}

"use client";
import {useEffect,useMemo,useState} from "react";
import PartPicker from "@/components/part-picker";
import Link from "@/lib/app-data";
import ScoreStand from "./score-stand";
import {useAppDatabase,useDemoMode} from "@/lib/app-data";
type Score={id:string;title:string;musical_part_id:number;storage_path:string;mime_type:string;created_at:string;outside_repertoire?:boolean};
type Part={id:number;name:string};
const types:Record<string,string>={"application/pdf":"PDF","image/jpeg":"Imagen JPEG","image/png":"Imagen PNG","image/webp":"Imagen WebP","audio/mpeg":"Audio MP3","audio/wav":"Audio WAV","audio/x-wav":"Audio WAV","audio/mp4":"Audio M4A","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"Word DOCX"};
type Folder={key:string;name:string;files:Score[];outside:boolean};
function marchName(title:string,parts:Part[]){
 let result=title.trim().replace(/\.(pdf|mp3|wav|m4a|jpg|jpeg|png|webp|docx|sib)$/i,"").trim();
 const names=[...parts.map(p=>p.name),"guion completo","partitura general","audio","mp3","pdf"].sort((a,b)=>b.length-a.length);
 for(const name of names){
  const escaped=name.replace(/[^a-zA-Z0-9À-ÿ ]/g,"\\$&");
  const pattern=new RegExp("(?:\\s*[-–—_|:]\\s*|\\s*\\(\\s*)"+escaped+"(?:\\s*\\))?\\s*$","i");
  const next=result.replace(pattern,"").trim();
  if(next&&next!==result){result=next;break;}
 }
 result=result.replace(/\s*\((?:alta|baja|1ª\s*[ab]|2ª\s*[ab]|[ab]|versi[oó]n[^)]*)\)\s*$/i,"").trim();
 return result||title.trim();
}
/** Etiqueta de la versión dentro de la carpeta: «Alta», «1ª A»… o el tipo de archivo. */
function variantLabel(title:string){
 const m=title.match(/\(([^)]+)\)\s*$/);
 return m?m[1].trim():"";
}
type Kind="score"|"audio"|"sibelius"|"other";
function kindOf(mime:string):Kind{
 if(mime==="application/pdf"||mime.startsWith("image/"))return "score";
 if(mime.startsWith("audio/"))return "audio";
 if(mime==="application/octet-stream")return "sibelius";
 return "other";
}
const kindOrder:Record<Kind,number>={score:0,audio:1,sibelius:2,other:3};
const kindInfo:Record<Kind,{icon:string;label:string}>={score:{icon:"♫",label:"Partitura"},audio:{icon:"♪",label:"Audio"},sibelius:{icon:"✎",label:"Sibelius"},other:{icon:"▤",label:"Documento"}};
/** Orden alfabético natural en español, sin que «¡», «¿» o comillas manden al final. */
const sortKey=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^[^a-zA-Z0-9]+/,"").toLocaleLowerCase("es");
function folderKey(name:string){
 return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g," ").trim();
}
const extensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp","audio/mpeg":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/mp4":"m4a","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx"};
export default function ScoreLibrary({role,partId}:{role:string;partId:number|null}){
 const db=useAppDatabase();
 const isDemo=useDemoMode();
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
 const [outsideUpload,setOutsideUpload]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [view,setView]=useState<{title:string;url:string;mime:string}|null>(null);
 const [expanded,setExpanded]=useState<string|null>(null);
 async function reload(){
  setLoading(true);setError("");
  const [s,p]=await Promise.all([db.from("march_scores").select("id,title,musical_part_id,storage_path,mime_type,created_at,outside_repertoire").order("title"),db.from("musical_parts").select("id,name").order("id")]);
  if(s.error)setError(s.error.message);else setScores((s.data??[]) as Score[]);
  if(p.error)setError(p.error.message);else {const arr=(p.data??[]) as Part[];setParts(arr);setUploadPart(old=>old||String(arr[0]?.id??""));}
  if(canUpload){const {data:all,error:fullError}=await db.from("full_scores").select("id,title,storage_path,mime_type,created_at").order("title");if(!fullError)setFullScores((all??[]) as Score[]);}
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const folders=useMemo(()=>{
  const visible=scores.filter(s=>selectedPart==="all"||String(s.musical_part_id)===selectedPart);
  const map=new Map<string,Folder>();
  for(const item of visible){
   const name=marchName(item.title,parts);
   const outside=Boolean(item.outside_repertoire);
   const key=(outside?"fuera:":"")+folderKey(name);
   const folder=map.get(key);
   if(folder)folder.files.push(item);
   else map.set(key,{key,name,files:[item],outside});
  }
  return [...map.values()].filter(g=>(g.name+" "+g.files.map(x=>x.title).join(" ")).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))
   .map(f=>({...f,files:[...f.files].sort((a,b)=>kindOrder[kindOf(a.mime_type)]-kindOrder[kindOf(b.mime_type)]||a.title.localeCompare(b.title,"es"))}))
   .sort((a,b)=>sortKey(a.name).localeCompare(sortKey(b.name),"es"));
 },[scores,parts,selectedPart,query]);
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
   const {error:recordError}=await db.from("march_scores").insert({title:name.trim(),musical_part_id:Number(uploadPart),storage_path:path,mime_type:file.type,outside_repertoire:outsideUpload});
   if(recordError)throw recordError;
   setName("");setFile(null);setMessage(outsideUpload?"Archivo subido en «Fuera de repertorio».":"Archivo subido y publicado para el instrumento seleccionado.");setOutsideUpload(false);await reload();
  }catch(err){setError(err instanceof Error?err.message:"No se pudo subir el archivo. Comprueba la migración SQL.");}
  finally{setBusy(false);}
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Biblioteca de partituras</h1></div></header>
  <p className="muted">{isDemo?"Prueba el modo atril con una versión didáctica de una melodía real de Beethoven. No contiene partituras de la agrupación.":canUpload?"Consulta todos los hilos y sube nuevos materiales musicales.":"Consulta los materiales de tu hilo musical. Los archivos son privados."}</p>
  {role==="superadmin"&&<p className="notice"><strong>Importación masiva desde Drive</strong><p>Importa todas las marchas de una carpeta, con control de duplicados y guiones restringidos a directiva.</p><Link href="/panel/partituras/importar" className="primaryButton linkButton">Abrir importador masivo →</Link></p>}{canUpload&&<section className="scoreUpload"><h2>Añadir material</h2><form onSubmit={e=>void upload(e)} className="scoreForm">
   <label>Título de la marcha o material<input value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="Ej. La Pasión — Corneta 1" required/></label>
   <div className="fieldLabel">Hilo musical<PartPicker parts={parts} value={uploadPart} onChange={setUploadPart} required ariaLabel="Hilo musical"/></div>
   <label>Archivo<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.docx" onChange={e=>setFile(e.target.files?.[0]??null)} required/></label>
   <label className="checkLabel"><input type="checkbox" checked={outsideUpload} onChange={e=>setOutsideUpload(e.target.checked)}/> Fuera de repertorio (marcha que no tocamos; aparece al final, en su propio apartado)</label>
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
    {canUpload&&<div className="fieldLabel">Hilo musical<PartPicker parts={parts} value={selectedPart} onChange={setSelectedPart} extras={[{value:"all",label:"Todos los hilos"}]} ariaLabel="Ver hilo"/></div>}
  </div>
  {error&&<p role="alert" className="formError">{error}</p>}
  {message&&<p role="status" className="formSuccess">{message}</p>}
  {loading?<p className="muted">Cargando biblioteca…</p>:folders.length===0?<p className="muted">No hay marchas para estos filtros.</p>:[false,true].map(outside=>{
   const list=folders.filter(f=>f.outside===outside);if(!list.length)return null;
   return <div key={String(outside)} className="folderSection">
    <div className={"folderSectionHead"+(outside?" outside":"")}>
     <h2>{outside?"Fuera de repertorio":"Nuestro repertorio"}</h2>
     <span className="folderCount">{list.length} {list.length===1?"marcha":"marchas"}</span>
     {outside&&<p className="muted small">Marchas que no tocamos en la agrupación, para estudiar o conocer.</p>}
    </div>
    <div className="marchFolderGrid">{list.map(folder=>{
     const open=expanded===folder.key;
     const kinds=(["score","audio","sibelius","other"] as Kind[]).map(k=>({k,n:folder.files.filter(f=>kindOf(f.mime_type)===k).length})).filter(x=>x.n>0);
     return <article key={folder.key} className={"marchFolder"+(folder.outside?" outside":"")+(open?" open":"")}>
      <button type="button" className="marchFolderHeader" aria-expanded={open} onClick={()=>setExpanded(old=>old===folder.key?null:folder.key)}>
       <span className="marchFolderIcon" aria-hidden="true">{sortKey(folder.name).charAt(0).toLocaleUpperCase("es")||"♫"}</span>
       <span className="marchFolderText"><strong>{folder.name}</strong>
        <span className="marchChips">{kinds.map(({k,n})=><span key={k} className={"marchChip "+k}>{kindInfo[k].icon} {kindInfo[k].label}{n>1?" ×"+n:""}</span>)}</span>
       </span>
       <span className="marchChevron" aria-hidden="true">›</span>
      </button>
      <div className="marchFolderBody"><div className="marchFolderContents">{folder.files.map(item=>{
       const kind=kindOf(item.mime_type);const variant=variantLabel(item.title);
       return <div className={"marchFile "+kind} key={item.id}>
        <span className="marchFileIcon" aria-hidden="true">{kindInfo[kind].icon}</span>
        <div><strong>{variant?kindInfo[kind].label+" · "+variant:kindInfo[kind].label}</strong><small>{types[item.mime_type]??"Archivo"}{canUpload?" · "+(parts.find(p=>p.id===item.musical_part_id)?.name??"Hilo musical"):""}</small></div>
        <button className={kind==="score"?"primaryButton":"secondaryButton"} type="button" tabIndex={open?0:-1} onClick={()=>void openScore(item)}>{kind==="score"?"Modo atril":kind==="audio"?"Escuchar":"Abrir"}</button>
       </div>;})}</div></div>
     </article>;})}</div>
   </div>;})}
  </section>
  {view&&(view.mime==="application/pdf"||view.mime.startsWith("image/")?<ScoreStand url={view.url} title={view.title} mime={view.mime} onClose={()=>setView(null)}/>:<section className="scoreViewer" role="dialog" aria-label={view.title}><div className="scoreViewTop"><strong>{view.title}</strong><button className="secondaryButton" onClick={()=>setView(null)}>Cerrar</button></div>
    {view.mime.startsWith("audio/")?<audio controls autoPlay src={view.url}/>:<p className="muted">Este formato no tiene visor integrado. Solicita una versión PDF para utilizar el modo atril.</p>}
   </section>)}
 </main>;
}

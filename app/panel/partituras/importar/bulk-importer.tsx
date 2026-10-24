"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";

type Part={id:number;name:string};
type Entry={file:File;path:string;title:string;partId:number|null;full:boolean;issue:string;done:boolean};
const types:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",sib:"application/octet-stream",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function partName(str:string){
 const x=norm(str);
 if(x.includes("trompeta 3"))return "Trompeta 3";
 if(x.includes("trompeta 2"))return "Trompeta 2";
 if(x.includes("trompeta 1"))return "Trompeta 1";
 if(x.includes("trombon 2"))return "Trombón 2";
 if(x.includes("trombon"))return "Trombón de varas";
 if(x.includes("bombardino 2"))return "Bombardino 2";
 if(x.includes("bombardino"))return "Bombardino 1";
 if(x.includes("tuba")&&(x.includes("sib")||x.includes("si bemol")))return "Tuba en Si bemol";
 if(x.includes("tuba")&&x.includes(" do"))return "Tuba en Do";
 if(x.includes("tuba"))return "Tuba 1";
 if(x.includes("corneta")&&x.includes("reb"))return "Corneta Do/Reb";
 if(x.includes("corneta"))return "Corneta 1";
 if(x.includes("tambor"))return "Tambores";
 return "";
}
async function digest(file:File){const hash=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
export default function BulkImporter(){
 const db=getSupabaseBrowser();
 const [parts,setParts]=useState<Part[]>([]);
 const [rows,setRows]=useState<Entry[]>([]);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [info,setInfo]=useState("");
 const [report,setReport]=useState<string[]>([]);
 useEffect(()=>{void db.from("musical_parts").select("id,name").order("id").then(r=>setParts((r.data??[]) as Part[]));},[]);
 function choose(e:React.ChangeEvent<HTMLInputElement>){
  const files=Array.from(e.target.files??[]).filter(f=>!f.name.startsWith("."));
  setRows(files.map(file=>{
   const path=file.webkitRelativePath||file.name;
   const seg=path.split("/").filter(Boolean);
   const full=seg.some(x=>norm(x).includes("guiones completos"));
   const sub=seg.at(-2)||"";
   const title=full?file.name.replace(/\.[^.]+$/,"").replace(/[-_ ]*(partitura completa|guion completo|guion do)\s*$/i,"").trim():seg.at(-3)||file.name.replace(/\.[^.]+$/,"");
   const ext=file.name.split(".").pop()?.toLowerCase()||"";
   const candidate=partName(sub)||partName(file.name);
   const found=parts.find(p=>norm(p.name)===norm(candidate));
   const issue=!types[ext]?"Formato no compatible":file.size>20*1024*1024?"Supera 20 MB":full&&!["pdf","mp3","wav","m4a","sib"].includes(ext)?"No admitido para guiones":!full&&!found?"Asignar instrumento":!full&&seg.length<3?"Revisar carpeta de marcha":"";
   return {file,path,title,partId:found?.id??null,full,issue,done:false};
  }));setReport([]);setInfo("");
 }
 function adjust(i:number,delta:Partial<Entry>){setRows(prev=>prev.map((r,j)=>i===j?{...r,...delta,issue:delta.partId!==undefined||delta.full!==undefined?"":r.issue}:r));}
 async function start(){
  const work=rows.map((r,i)=>({...r,i})).filter(r=>!r.issue&&!r.done&&r.title.trim()&&(r.full||r.partId));
  if(!work.length)return;
  if(!window.confirm("¿Importar "+work.length+" archivos al bucket privado? Los guiones serán exclusivos de directiva."))return;
  setBusy(true);setProgress(0);
  const notes:string[]=[];
  try{
   const [a,b]=await Promise.all([db.from("march_scores").select("musical_part_id,import_hash"),db.from("full_scores").select("import_hash")]);
   if(a.error)throw a.error;if(b.error)throw b.error;
   const seen=new Set((a.data??[]).filter(v=>v.import_hash).map(v=>v.musical_part_id+":"+v.import_hash));
   const seenFull=new Set((b.data??[]).map(v=>v.import_hash).filter(Boolean));
   for(const item of work){
    const ext=item.file.name.split(".").pop()!.toLowerCase();
    try{
     const hash=await digest(item.file),key=item.partId+":"+hash;
     if(item.full?seenFull.has(hash):seen.has(key)){notes.push("Duplicado: "+item.path);setRows(prev=>prev.map((r,i)=>i===item.i?{...r,done:true}:r));setProgress(v=>v+1);continue;}
     const path=(item.full?"guiones":String(item.partId))+"/"+crypto.randomUUID()+"."+ext;
     const mime=types[ext];
     const up=await db.storage.from("partituras").upload(path,item.file,{contentType:mime,upsert:false});
     if(up.error)throw up.error;
     const base={title:item.title.trim().slice(0,160),storage_path:path,mime_type:mime,import_hash:hash};
     const result=item.full?await db.from("full_scores").insert(base):await db.from("march_scores").insert({...base,musical_part_id:item.partId});
     if(result.error)throw Error("Archivo almacenado en "+path+" pero falló el catálogo: "+result.error.message);
     if(item.full)seenFull.add(hash);else seen.add(key);
     notes.push("Importado: "+item.path);
     setRows(prev=>prev.map((r,i)=>i===item.i?{...r,done:true}:r));
    }catch(err){notes.push("ERROR: "+item.path+" — "+(err instanceof Error?err.message:String(err)));}
    setProgress(v=>v+1);setReport([...notes]);
   }
   setInfo("Importados: "+notes.filter(x=>x.startsWith("Importado")).length+"; duplicados: "+notes.filter(x=>x.startsWith("Duplicado")).length+"; errores: "+notes.filter(x=>x.startsWith("ERROR")).length+".");
  }catch(err){setInfo("No se pudo iniciar: "+(err instanceof Error?err.message:String(err))+". Revisa las migraciones SQL.");}
  finally{setBusy(false);setReport(notes);}
 }
 const ready=rows.filter(r=>!r.issue&&!r.done&&r.title.trim()&&(r.full||r.partId)).length;
 return <main className="container"><Link className="backLink" href="/panel/partituras">← Volver a partituras</Link>
 <header className="header"><span className="brandIcon">♫</span><div><small>SUPERADMIN · PASIÓN APP</small><h1>Importación masiva</h1></div></header>
 <p className="muted">Descarga la carpeta de repertorio desde Google Drive y descomprime el ZIP. Aquí podrás seleccionar la carpeta entera, revisar los destinos e importarla con tu sesión autorizada.</p>
 <section className="scoreUpload"><h2>1. Selecciona la carpeta</h2>
 <input type="file" multiple {...{"webkitdirectory":""}} aria-label="Seleccionar carpeta" onChange={choose} disabled={busy}/>
 <p className="muted small">Selecciona la carpeta descomprimida, no el ZIP. Funciona mejor desde Safari de Mac o Chrome.</p></section>
 {rows.length>0&&<><p className="notice">Detectados: {rows.length} · Listos: {ready} · Revisar: {rows.filter(r=>r.issue&&!r.done).length} · Terminados: {rows.filter(r=>r.done).length}</p>
 <h2>2. Revisa la clasificación</h2><div className="requestGrid">{rows.map((r,i)=><article key={i} className="requestCard"><strong>{r.file.name}</strong><p className="muted small">{r.path}</p>
 <label className="scoreImportLabel">Marcha<input value={r.title} disabled={busy||r.done} onChange={e=>adjust(i,{title:e.target.value})}/></label>
 <label className="scoreImportLabel">Destino<select disabled={busy||r.done} value={r.full?"full":r.partId??""} onChange={e=>adjust(i,e.target.value==="full"?{full:true,partId:null}:{full:false,partId:Number(e.target.value)||null})}>
 <option value="">Sin asignar</option><option value="full">Guiones completos (directiva)</option>{parts.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
 <p className={r.issue?"formError":"muted small"}>{r.done?"Completado / duplicado":r.issue||"Preparado"}</p></article>)}</div>
 <h2>3. Importar</h2><p className="muted">{info}</p><button className="primaryButton" disabled={busy||!ready} onClick={()=>void start()}>{busy?"Importando…":"Importar "+ready+" archivos"}</button>{busy&&<p className="muted">Procesados {progress}</p>}
 {report.length>0&&<details className="scoreImportReport"><summary>Informe de resultados ({report.length})</summary><pre>{report.join("\n")}</pre></details>}
 </>}</main>;
}

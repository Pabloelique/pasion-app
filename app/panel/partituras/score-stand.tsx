"use client";
import {useEffect,useRef,useState} from "react";

type Props={url:string;title:string;mime:string;onClose:()=>void};
type PdfDocument=import("pdfjs-dist").PDFDocumentProxy;
export default function ScoreStand({url,title,mime,onClose}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const surface=useRef<HTMLDivElement>(null);
 const [pdf,setPdf]=useState<PdfDocument|null>(null);
 const [pages,setPages]=useState(1);
 const [page,setPage]=useState(1);
 const [showControls,setShowControls]=useState(true);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(mime==="application/pdf");
 const pdfMode=mime==="application/pdf";
 useEffect(()=>{
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
  window.addEventListener("keydown",esc);
  return()=>{document.body.style.overflow=oldOverflow;window.removeEventListener("keydown",esc);};
 },[onClose]);
 useEffect(()=>{
  if(!pdfMode)return;
  let cancelled=false;
  let task:{destroy:()=>Promise<void>}|undefined;
  setLoading(true);setError("");setPage(1);
  (async()=>{
   try{
    const lib=await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();
    const loadingTask=lib.getDocument({url,withCredentials:false});
    task=loadingTask;
    const doc=await loadingTask.promise;
    if(!cancelled){setPdf(doc as PdfDocument);setPages(doc.numPages);setLoading(false);}
   }catch(e){if(!cancelled){setError(e instanceof Error?e.message:"No se pudo visualizar el PDF.");setLoading(false);}}
  })();
  return()=>{cancelled=true;setPdf(null);if(task)void task.destroy().catch(()=>{});};
 },[url,pdfMode]);
 useEffect(()=>{
  if(!pdf||!pdfMode||!canvas.current||!surface.current)return;
  let cancelled=false;
  let renderTask:{cancel:()=>void;promise:Promise<unknown>}|undefined;
  const draw=async()=>{
   try{
    const pdfPage=await pdf.getPage(page);
    if(cancelled||!surface.current||!canvas.current)return;
    const base=pdfPage.getViewport({scale:1});
    const host=surface.current;
    const width=Math.max(100,host.clientWidth-12);
    const height=Math.max(100,host.clientHeight-12);
    const scale=Math.min(width/base.width,height/base.height);
    const pixelRatio=Math.min(window.devicePixelRatio||1,2.5);
    const viewport=pdfPage.getViewport({scale});
    const cvs=canvas.current;
    cvs.width=Math.round(viewport.width*pixelRatio);
    cvs.height=Math.round(viewport.height*pixelRatio);
    cvs.style.width=viewport.width+"px";
    cvs.style.height=viewport.height+"px";
    const ctx=cvs.getContext("2d");
    if(!ctx)throw new Error("No se pudo abrir el lienzo de la partitura.");
    renderTask=pdfPage.render({canvas:cvs,canvasContext:ctx,viewport,transform:[pixelRatio,0,0,pixelRatio,0,0]});
    await renderTask.promise;
   }catch(e){if(!cancelled&&!(e instanceof Error&&e.name==="RenderingCancelledException"))setError("No se pudo dibujar esta página.");}
  };
  void draw();
  const observer=new ResizeObserver(()=>{if(!cancelled){renderTask?.cancel();void draw();}});
  observer.observe(surface.current);
  return()=>{cancelled=true;observer.disconnect();renderTask?.cancel();};
 },[pdf,page,pdfMode]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==="ArrowRight"||e.key==="PageDown"){setPage(n=>Math.min(pages,n+1));}
   if(e.key==="ArrowLeft"||e.key==="PageUp"){setPage(n=>Math.max(1,n-1));}
  };
  window.addEventListener("keydown",key);
  return()=>window.removeEventListener("keydown",key);
 },[pages]);
 const next=()=>setPage(n=>Math.min(pages,n+1));
 const prev=()=>setPage(n=>Math.max(1,n-1));
 const isImage=mime.startsWith("image/");
 return <div className="scoreStand" role="dialog" aria-modal="true" aria-label={"Modo atril: "+title}>
   <div className="scoreStandSurface" ref={surface}>
    {pdfMode?<canvas ref={canvas} className="scoreStandCanvas" aria-label={title+" página "+page}/>:isImage?<img className="scoreStandImage" src={url} alt={title}/>:null}
    {loading&&<span className="scoreStandLoading">Preparando partitura…</span>}
    {error&&<span className="scoreStandLoading" role="alert">{error}</span>}
    {pdfMode&&pages>1&&!loading&&<div className="scoreStandTouch" aria-label="Pasar página">
      <button aria-label="Página anterior" disabled={page===1} onClick={prev}/>
      <button aria-label="Página siguiente" disabled={page===pages} onClick={next}/>
    </div>}
   </div>
   <div className="scoreStandTop">
    <button type="button" className="scoreStandToggle" onClick={()=>setShowControls(x=>!x)} aria-label={showControls?"Ocultar controles":"Mostrar controles"}>{showControls?"⋯":"☰"}</button>
    {showControls&&<div className="scoreStandToolbar"><span title={title}>{title}</span>{pdfMode&&pages>1&&<span>{page} / {pages}</span>}<button type="button" onClick={onClose}>Salir</button></div>}
   </div>
   <span className="scoreStandTip">Coloca el móvil en horizontal. {pdfMode&&pages>1?"Toca los lados para cambiar de página.":""}</span>
 </div>;
}

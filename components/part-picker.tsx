"use client";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import {groupParts,type Part} from "@/lib/parts";

type Extra={value:string;label:string};
type Props={parts:Part[];value:string;onChange:(value:string)=>void;placeholder?:string;extras?:Extra[];disabled?:boolean;required?:boolean;ariaLabel?:string;name?:string};

/** Selector de hilo musical agrupado por familias (Cornetas, Trompetas, Trombones…). En el móvil se abre como hoja inferior. */
export default function PartPicker({parts,value,onChange,placeholder="Selecciona un hilo",extras=[],disabled=false,required=false,ariaLabel,name}:Props){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const list=useRef<HTMLDivElement>(null);
 const id=useId();
 const families=useMemo(()=>groupParts(parts),[parts]);
 const selectedPart=parts.find(p=>String(p.id)===value);
 const selectedExtra=extras.find(e=>e.value===value);
 const label=selectedPart?.name??selectedExtra?.label??placeholder;
 const family=selectedPart?families.find(f=>f.parts.some(p=>p.id===selectedPart.id)):undefined;
 useEffect(()=>{
  if(!open)return;
  const outside=(e:MouseEvent|TouchEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);}};
  document.addEventListener("mousedown",outside);document.addEventListener("touchstart",outside);document.addEventListener("keydown",esc);
  // Enfoca la opción elegida al abrir.
  requestAnimationFrame(()=>{const el=list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')??list.current?.querySelector<HTMLButtonElement>("button");el?.focus();});
  return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("touchstart",outside);document.removeEventListener("keydown",esc);};
 },[open]);
 function choose(v:string){onChange(v);setOpen(false);}
 function keyNav(e:React.KeyboardEvent){
  if(!["ArrowDown","ArrowUp"].includes(e.key))return;
  e.preventDefault();
  const items=[...(list.current?.querySelectorAll<HTMLButtonElement>("button[role=option]")??[])];
  const i=items.indexOf(document.activeElement as HTMLButtonElement);
  items[Math.max(0,Math.min(items.length-1,i+(e.key==="ArrowDown"?1:-1)))]?.focus();
 }
 return <div className={"partPicker"+(open?" open":"")} ref={root}>
  {name!==undefined&&<input type="hidden" name={name} value={value}/>}
  {required&&<input className="partPickerRequired" tabIndex={-1} aria-hidden="true" required value={value} onChange={()=>{}}/>}
  <button type="button" className="partPickerButton" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={ariaLabel?ariaLabel+": "+label:undefined} onClick={()=>setOpen(o=>!o)}>
   <span className="partPickerIcon" aria-hidden="true">{family?.icon??(selectedExtra?"✦":"♫")}</span>
   <span className={"partPickerLabel"+(selectedPart||selectedExtra?"":" placeholder")}>{label}</span>
   <span className="partPickerArrow" aria-hidden="true">⌄</span>
  </button>
  {open&&<>
   <div className="partPickerBackdrop" onClick={()=>setOpen(false)}/>
   <div className="partPickerPanel" id={id} role="listbox" ref={list} onKeyDown={keyNav} aria-label={ariaLabel??"Hilo musical"}>
    <div className="partPickerSheetHead"><strong>{ariaLabel??"Hilo musical"}</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">✕</button></div>
    {extras.length>0&&<div className="partPickerExtras">{extras.map(e=><button type="button" role="option" aria-selected={e.value===value} key={e.value} className="partOption extra" onClick={()=>choose(e.value)}>{e.label}</button>)}</div>}
    {families.map(f=><div className="partFamily" key={f.key}>
     <div className="partFamilyHead"><span aria-hidden="true">{f.icon}</span>{f.name}</div>
     <div className="partFamilyOptions">{f.parts.map(p=><button type="button" role="option" aria-selected={String(p.id)===value} key={p.id} className="partOption" onClick={()=>choose(String(p.id))}>
      <span>{p.name}</span>{String(p.id)===value&&<span className="partCheck" aria-hidden="true">✓</span>}
     </button>)}</div>
    </div>)}
   </div>
  </>}
 </div>;
}

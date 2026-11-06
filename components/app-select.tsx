"use client";
import {Children,isValidElement,useEffect,useId,useMemo,useRef,useState,type ReactNode,type ReactElement} from "react";

type Opt={value:string;label:string;disabled:boolean};
type Group={label:string|null;options:Opt[]};
type ChangeEvent={target:{value:string};currentTarget:{value:string}};
type Props={value?:string|number;onChange?:(e:ChangeEvent)=>void;disabled?:boolean;required?:boolean;name?:string;className?:string;children?:ReactNode;"aria-label"?:string;id?:string};

function textOf(node:ReactNode):string{
 if(node===null||node===undefined||typeof node==="boolean")return "";
 if(typeof node==="string"||typeof node==="number")return String(node);
 if(Array.isArray(node))return node.map(textOf).join("");
 if(isValidElement(node))return textOf((node.props as {children?:ReactNode}).children);
 return "";
}
function parse(children:ReactNode):Group[]{
 const groups:Group[]=[];let loose:Group={label:null,options:[]};
 const optionFrom=(el:ReactElement)=>{const p=el.props as {value?:string|number;disabled?:boolean;children?:ReactNode};const label=textOf(p.children);return {value:String(p.value??label),label,disabled:Boolean(p.disabled)};};
 Children.toArray(children).forEach(child=>{
  if(!isValidElement(child))return;
  if(child.type==="option")loose.options.push(optionFrom(child));
  else if(child.type==="optgroup"){
   if(loose.options.length){groups.push(loose);loose={label:null,options:[]};}
   const p=child.props as {label?:string;children?:ReactNode};
   groups.push({label:p.label??"",options:Children.toArray(p.children).filter(isValidElement).filter(c=>c.type==="option").map(c=>optionFrom(c as ReactElement))});
  }
 });
 if(loose.options.length)groups.push(loose);
 return groups;
}
const norm=(v:string)=>v.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

/** Desplegable propio de PASIÓN APP: sustituye a <select> con la misma API (value, onChange(e.target.value), <option>, <optgroup>). */
export default function Select({value,onChange,disabled=false,required=false,name,className,children,"aria-label":ariaLabel,id}:Props){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState("");
 const root=useRef<HTMLDivElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const listId=useId();
 const groups=useMemo(()=>parse(children),[children]);
 const all=groups.flatMap(g=>g.options);
 const current=all.find(o=>o.value===String(value??""));
 const many=all.length>9;
 const shown=query?groups.map(g=>({...g,options:g.options.filter(o=>norm(o.label).includes(norm(query)))})).filter(g=>g.options.length):groups;
 useEffect(()=>{
  if(!open){setQuery("");return;}
  const outside=(e:MouseEvent|TouchEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
  document.addEventListener("mousedown",outside);document.addEventListener("touchstart",outside);document.addEventListener("keydown",esc);
  requestAnimationFrame(()=>{
   const target=many&&window.matchMedia("(min-width:641px)").matches?panel.current?.querySelector<HTMLInputElement>("input"):panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')??panel.current?.querySelector<HTMLButtonElement>("button[role=option]");
   target?.focus();(target as HTMLElement|undefined)?.scrollIntoView?.({block:"nearest"});
  });
  return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("touchstart",outside);document.removeEventListener("keydown",esc);};
 },[open,many]);
 function choose(o:Opt){
  if(o.disabled)return;
  setOpen(false);
  if(o.value!==String(value??""))onChange?.({target:{value:o.value},currentTarget:{value:o.value}});
 }
 function keyNav(e:React.KeyboardEvent){
  if(!["ArrowDown","ArrowUp"].includes(e.key))return;
  e.preventDefault();
  const items=[...(panel.current?.querySelectorAll<HTMLButtonElement>("button[role=option]:not([disabled])")??[])];
  const i=items.indexOf(document.activeElement as HTMLButtonElement);
  items[Math.max(0,Math.min(items.length-1,i<0?0:i+(e.key==="ArrowDown"?1:-1)))]?.focus();
 }
 return <div className={"partPicker appSelect"+(open?" open":"")+(className?" "+className:"")} ref={root}>
  {name&&<input type="hidden" name={name} value={String(value??"")}/>}
  <button type="button" id={id} className="partPickerButton" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel?ariaLabel+": "+(current?.label??""):undefined} onClick={()=>setOpen(o=>!o)}>
   <span className={"partPickerLabel"+(current&&current.value!==""?"":" placeholder")}>{current?.label??"Seleccionar"}</span>
   <span className="partPickerArrow" aria-hidden="true">⌄</span>
  </button>
  {required&&<input className="partPickerRequired" tabIndex={-1} aria-hidden="true" required value={current&&current.value!==""?current.value:""} onChange={()=>{}}/>}
  {open&&<>
   <div className="partPickerBackdrop" onClick={()=>setOpen(false)}/>
   <div className="partPickerPanel appSelectPanel" id={listId} role="listbox" ref={panel} onKeyDown={keyNav} aria-label={ariaLabel}>
    <div className="partPickerSheetHead"><strong>{ariaLabel??"Elige una opción"}</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">✕</button></div>
    {many&&<input className="appSelectSearch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar en la lista"/>}
    {shown.length===0&&<p className="muted small appSelectEmpty">Sin resultados</p>}
    {shown.map((g,gi)=><div className="partFamily" key={gi}>
     {g.label&&<div className="partFamilyHead">{g.label}</div>}
     <div className="appSelectOptions">{g.options.map(o=><button type="button" role="option" aria-selected={o.value===String(value??"")} disabled={o.disabled} key={o.value+o.label} className="partOption" onClick={()=>choose(o)}>
      <span>{o.label}</span>{o.value===String(value??"")&&<span className="partCheck" aria-hidden="true">✓</span>}
     </button>)}</div>
    </div>)}
   </div>
  </>}
 </div>;
}

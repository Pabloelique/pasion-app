"use client";
import {useEffect,useState} from "react";
type Theme="light"|"dark";
const key="pasion-theme";
function applyTheme(theme:Theme){
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
 if(meta)meta.content=theme==="light"?"#f4f7f2":"#143b2a";
}
export default function ThemeSwitcher(){
 const [theme,setTheme]=useState<Theme|null>(null);
 const [warning,setWarning]=useState("");
 useEffect(()=>{
  const media=window.matchMedia("(prefers-color-scheme: light)");
  let saved:Theme|null=null;
  try{const value=localStorage.getItem(key);if(value==="light"||value==="dark")saved=value;}catch{}
  const sync=()=>{const value=saved??(media.matches?"light":"dark");applyTheme(value);setTheme(value);};
  const storage=(event:StorageEvent)=>{
   if(event.key!==key&&event.key!==null)return;
   saved=event.newValue==="light"||event.newValue==="dark"?event.newValue:null;sync();
  };
  sync();media.addEventListener("change",sync);window.addEventListener("storage",storage);
  // Mantener la elección de esta pestaña también al cambiar el modo del sistema.
  const local=(event:Event)=>{saved=(event as CustomEvent<Theme>).detail;};
  window.addEventListener("pasion-theme-change",local);
  return()=>{media.removeEventListener("change",sync);window.removeEventListener("storage",storage);window.removeEventListener("pasion-theme-change",local);};
 },[]);
 function choose(value:Theme){
  applyTheme(value);setTheme(value);setWarning("");
  window.dispatchEvent(new CustomEvent("pasion-theme-change",{detail:value}));
  try{localStorage.setItem(key,value);}catch{setWarning("El modo está aplicado, pero este navegador no permite guardar la elección.");}
 }
 return <div className="themeBar">
  <span className="themeBarLabel" id="theme-label">Apariencia</span>
  <div className="themeChoices" role="group" aria-labelledby="theme-label">
   <button type="button" aria-pressed={theme==="light"} onClick={()=>choose("light")}><span aria-hidden="true">☀ </span>Claro</button>
   <button type="button" aria-pressed={theme==="dark"} onClick={()=>choose("dark")}><span aria-hidden="true">☾ </span>Oscuro</button>
  </div>
  {warning&&<p className="themeSaveWarning" role="status">{warning}</p>}
 </div>;
}

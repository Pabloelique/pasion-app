"use client";
import {useEffect} from "react";
export function useRecordAnchor(prefix:string,records:string){
 useEffect(()=>{
  let frame=0;
  function open(){
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const id=window.location.hash.slice(1);
    if(!id.startsWith(prefix))return;
    const target=document.getElementById(id);
    if(target){target.scrollIntoView({block:"start"});target.focus({preventScroll:true});}
   });
  }
  open();window.addEventListener("hashchange",open);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener("hashchange",open);};
 },[prefix,records]);
}

"use client";
import {useEffect,useState} from "react";
import {useAppDatabase,useDemoMode} from "@/lib/app-data";
import {initials} from "@/lib/profile-utils";

/** Firma (en un solo viaje) las rutas de fotos de perfil del bucket privado. */
export function useAvatarUrls(paths:(string|null|undefined)[]){
 const db=useAppDatabase();
 const demo=useDemoMode();
 const key=[...new Set(paths.filter((p):p is string=>Boolean(p)))].sort().join("|");
 const [urls,setUrls]=useState<Record<string,string>>({});
 useEffect(()=>{
  if(demo||!key)return;
  let active=true;
  void db.storage.from("avatars").createSignedUrls(key.split("|"),3600).then(({data})=>{
   if(!active||!data)return;
   const next:Record<string,string>={};
   for(const item of data)if(item.path&&item.signedUrl)next[item.path]=item.signedUrl;
   setUrls(next);
  });
  return()=>{active=false;};
 },[db,demo,key]);
 return urls;
}

export default function Avatar({src,first,last,size=48}:{src?:string|null;first?:string|null;last?:string|null;size?:number}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return <span className="avatar" style={{width:size,height:size,fontSize:Math.round(size*0.38)}}>
  {src&&!broken?<img src={src} alt="" onError={()=>setBroken(true)}/>:<span aria-hidden="true">{initials(first,last)}</span>}
 </span>;
}

/** Recorta la foto en cuadrado y la reduce a 512 px antes de subirla (menos datos y más privacidad: sin metadatos GPS). */
export async function prepareAvatar(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);
 const side=Math.min(bitmap.width,bitmap.height);
 const size=Math.min(512,side);
 const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("No se pudo preparar la foto.");
 ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);
 bitmap.close();
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la foto.")),"image/jpeg",0.85));
}

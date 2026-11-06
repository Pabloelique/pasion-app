"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
import {useDemoMode} from "@/lib/app-data";
import Avatar,{useAvatarUrls} from "./avatar";

/** Foto del usuario en la cabecera del inicio; lleva a «Mi perfil». */
export default function ProfileButton(){
 const demo=useDemoMode();
 const [me,setMe]=useState<{first_name:string;last_name:string;avatar_url:string|null}|null>(null);
 useEffect(()=>{
  if(demo)return;
  const db=getSupabaseBrowser();
  void db.auth.getUser().then(({data})=>{
   if(!data.user)return;
   void db.from("profiles").select("first_name,last_name,avatar_url").eq("id",data.user.id).single().then(({data:p})=>{if(p)setMe(p);});
  });
 },[demo]);
 const urls=useAvatarUrls([me?.avatar_url]);
 if(demo||!me)return null;
 return <Link href="/panel/perfil" className="profileButton" aria-label="Mi perfil">
  <Avatar src={me.avatar_url?urls[me.avatar_url]:null} first={me.first_name} last={me.last_name} size={40}/>
 </Link>;
}

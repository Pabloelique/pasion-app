"use client";
import {createContext,useContext,type ReactNode,type ComponentProps} from "react";
import NextLink from "next/link";
import {useRouter} from "next/navigation";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Client=ReturnType<typeof getSupabaseBrowser>;
const DemoContext=createContext<Client|null>(null);
export function DemoDataProvider({db,children}:{db:Client;children:ReactNode}){
 return <DemoContext.Provider value={db}>{children}</DemoContext.Provider>;
}
export function useDemoMode(){return useContext(DemoContext)!==null;}
export function useAppDatabase(){const demo=useContext(DemoContext);return demo??getSupabaseBrowser();}
export function demoHref(href:string){return href.replace(/^\/panel(?=\/|#|$)/,"/demo");}
export default function AppLink(props:ComponentProps<typeof NextLink>){
 const demo=useDemoMode();
 return <NextLink {...props} href={demo&&typeof props.href==="string"?demoHref(props.href):props.href}/>;
}
export function useAppRouter(){
 const router=useRouter();const demo=useDemoMode();
 return {...router,push:(href:string,options?:Parameters<typeof router.push>[1])=>router.push(demo?demoHref(href):href,options)};
}

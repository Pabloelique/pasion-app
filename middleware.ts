import {NextResponse,type NextRequest} from "next/server";
import {createServerClient} from "@supabase/ssr";

// Renueva la sesión de Supabase en cada visita para que nadie salga expulsado al caducar el token.
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return response;
 const db=createServerClient(url,key,{
  cookies:{
   getAll(){return request.cookies.getAll();},
   setAll(toSet:{name:string;value:string;options?:Parameters<typeof response.cookies.set>[2]}[]){
    toSet.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    toSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   },
  },
 });
 await db.auth.getUser();
 return response;
}

export const config={matcher:["/panel/:path*","/demo/:path*","/api/eventos/:path*","/api/demo-access"]};

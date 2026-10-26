import Link from "next/link";
import {getSupabaseServer} from "@/lib/supabase/server";

export default async function PanelLayout({children}:{children:React.ReactNode}){
 const db=await getSupabaseServer();
 const {data:{user}}=await db.auth.getUser();
 let approved=false;
 if(user){
  const {data:profile}=await db.from("profiles").select("approval_status").eq("id",user.id).single();
  approved=profile?.approval_status==="approved";
 }
 return <>
  {children}
  {approved&&<nav className="mobilePanelNav" aria-label="Navegación principal">
   <Link href="/panel"><span aria-hidden="true">⌂</span><span>Inicio</span></Link>
   <Link href="/panel/calendario"><span aria-hidden="true">▦</span><span>Calendario</span></Link>
   <Link href="/panel/partituras"><span aria-hidden="true">♫</span><span>Partituras</span></Link>
   <Link href="/panel/notificaciones"><span aria-hidden="true">♧</span><span>Avisos</span></Link>
  </nav>}
 </>;
}

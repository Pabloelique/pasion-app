"use client";
import Link from "next/link";
import {useDemoMode} from "@/lib/app-data";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const isDemo=useDemoMode();
  if(isDemo)return <Link className="secondaryButton linkButton" href="/">Salir de la demostración</Link>;
  return <button className="secondaryButton" type="button" disabled={working} onClick={async () => {
    setWorking(true);
    try { await getSupabaseBrowser().auth.signOut(); router.replace("/acceso"); router.refresh(); }
    finally { setWorking(false); }
  }}>{working ? "Saliendo…" : "Cerrar sesión"}</button>;
}

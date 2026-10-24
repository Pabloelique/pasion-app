"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function ConfirmationPage() {
  const [status, setStatus] = useState("Comprobando la confirmación del correo…");
  useEffect(() => {
    let live = true;
    async function confirm() {
      try {
        const { error } = await getSupabaseBrowser().auth.getSession();
        if (!live) return;
        setStatus(error ? "No se pudo comprobar el enlace. Vuelve a iniciar sesión o solicita uno nuevo." : "Correo confirmado. Ya puedes iniciar sesión. Tu acceso a la agrupación seguirá pendiente de aprobación.");
      } catch {
        if (live) setStatus("No se pudo confirmar la sesión. Prueba a iniciar sesión.");
      }
    }
    void confirm();
    return () => { live = false; };
  }, []);
  return <main className="authShell"><section className="authCard"><h1>Confirmación de correo</h1><p>{status}</p><Link className="primaryButton linkButton" href="/acceso">Ir al inicio de sesión</Link></section></main>;
}

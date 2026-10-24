import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import LogoutButton from "./salir";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/acceso");
  const { data: profile } = await supabase.from("profiles").select("first_name,last_name,role,requested_role,approval_status,musical_part_id").eq("id", user.id).single();
  if (!profile) return <main className="authShell"><section className="authCard"><h1>Perfil no disponible</h1><p>Tu cuenta existe, pero todavía no hemos podido cargar tu perfil. Contacta con la directiva.</p><LogoutButton/></section></main>;

  if (profile.approval_status !== "approved") return <main className="authShell"><section className="authCard">
    <span className="eyebrow">SOLICITUD DE ACCESO</span><h1>{profile.approval_status === "rejected" ? "Solicitud no aprobada" : "Pendiente de aprobación"}</h1>
    <p>Hola, {profile.first_name || "músico"}. {profile.approval_status === "rejected" ? "La directiva no ha aprobado la solicitud. Contacta con la agrupación si necesitas aclararlo." : profile.requested_role === "directiva" ? "Tu solicitud de directiva debe ser revisada por el superadmin." : "Un miembro de la directiva debe aprobar tu acceso."}</p>
    <p className="muted">Mientras tanto, las partituras, el calendario interno y la información privada permanecerán bloqueados.</p><LogoutButton/>
  </section></main>;

  const role = profile.role as string;
  return <main className="container">
    <header className="header"><span className="brandIcon">♫</span><div><small>PASIÓN APP</small><h1>Hola, {profile.first_name || "músico"}</h1></div></header>
    <section className="hero"><span className="eyebrow">{role === "superadmin" ? "SUPERADMIN" : role === "directiva" ? "DIRECTIVA" : "MÚSICO"}</span><h2>Tu espacio en La Pasión</h2><p>Tu cuenta está aprobada. Ya hemos conectado el inicio de sesión real; estamos desarrollando los módulos internos y los permisos de gestión.</p></section>
    <section className="grid"><article className="tile"><span className="tileIcon">♫</span><strong>Partituras</strong><p>Próximamente: acceso privado por hilo musical.</p></article><article className="tile"><span className="tileIcon">▦</span><strong>Calendario</strong><p>Próximamente: ensayos y actuaciones.</p></article><article className="tile"><span className="tileIcon">✓</span><strong>Asistencia</strong><p>Próximamente: confirmaciones y faltas.</p></article></section>
    {role === "superadmin" && <p className="notice">Superadmin reconocido. El panel para aprobar usuarios y asignar directiva se implementará en el siguiente módulo.</p>}
    <div className="logoutArea"><LogoutButton/></div>
  </main>;
}

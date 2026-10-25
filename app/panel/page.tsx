import { redirect } from "next/navigation";
import Link from "next/link";
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
    <section className="grid"><Link href="/panel/partituras" className="tile" style={{textDecoration:"none",color:"inherit"}}><span className="tileIcon">♫</span><strong>Partituras y materiales</strong><p>Biblioteca privada según tu hilo musical.</p></Link><Link href="/panel/mi-asistencia" className="tile" style={{textDecoration:"none",color:"inherit"}}><span className="tileIcon">✓</span><strong>Mi asistencia</strong><p>Consulta tus presencias y faltas registradas.</p></Link><Link href="/panel/calendario" className="tile" style={{textDecoration:"none",color:"inherit"}}><span className="tileIcon">▦</span><strong>Calendario</strong><p>Ensayos, actuaciones y confirmación de asistencia.</p></Link>{(role === "superadmin" || role === "directiva") && <Link href="/panel/asistencia" className="tile" style={{textDecoration:"none",color:"inherit"}}><span className="tileIcon">✓</span><strong>Pasar lista</strong><p>Control de asistencia y faltas de la agrupación.</p></Link>}</section>
    <section className="notice"><strong>Votaciones de marchas</strong><p>Propón, vota y consulta los resultados de nuevas marchas musicales.</p><Link className="primaryButton linkButton" href="/panel/votaciones">Abrir votaciones →</Link></section>
    <section className="notice"><strong>Tablón de anuncios</strong><p>Comunicados de la directiva y conversación entre miembros de La Pasión.</p><Link className="primaryButton linkButton" href="/panel/tablon">Abrir tablón →</Link></section>
    {(role === "superadmin" || role === "directiva") && <section className="notice"><strong>Actuaciones y contratos</strong><p>Procesiones, cachés, pagos y compromisos de la agrupación.</p><Link className="primaryButton linkButton" href="/panel/actuaciones">Abrir actuaciones →</Link></section>}
    {(role === "superadmin" || role === "directiva") && <section className="notice"><strong>Inventario</strong><p>Instrumentos, uniformes, asignaciones y mantenimientos.</p><Link className="primaryButton linkButton" href="/panel/inventario">Abrir inventario →</Link></section>}
    {(role === "superadmin" || role === "directiva") && <section className="notice"><strong>Tesorería</strong><p>Ingresos, gastos, saldo interno y exportación de movimientos de la agrupación.</p><Link className="primaryButton linkButton" href="/panel/tesoreria">Abrir tesorería →</Link></section>}
    {(role === "superadmin" || role === "directiva") && <section className="notice"><strong>Gestión de solicitudes</strong><p>Revisa y aprueba las cuentas nuevas de la agrupación.</p><Link className="primaryButton linkButton" href="/panel/solicitudes">Ver solicitudes pendientes →</Link><p><Link className="secondaryButton linkButton" href="/panel/miembros">Gestionar miembros →</Link></p></section>}
    <div className="logoutArea"><LogoutButton/></div>
  </main>;
}

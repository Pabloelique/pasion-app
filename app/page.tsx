import Link from "next/link";
const sections = [
  { icon: "♫", title: "Partituras", detail: "Por hilo musical" },
  { icon: "▦", title: "Calendario", detail: "Ensayos y actuaciones" },
  { icon: "✓", title: "Asistencia", detail: "Confirmaciones y justificantes" },
  { icon: "☷", title: "Tablón", detail: "Avisos y votaciones" },
  { icon: "€", title: "Tesorería", detail: "Solo directiva autorizada" },
  { icon: "♫", title: "Repertorio oficial", detail: "Marchas y enlaces para escucharlas" },
];
export default function Home() {
  return <main className="container">
    <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL</small><h1>La Pasión de Mazarrón</h1></div></header>
    <section className="hero"><span className="eyebrow">PASIÓN APP · AGRUPACIÓN MUSICAL</span><h2>Tu agrupación, siempre contigo.</h2><p>Accede a ensayos, partituras, repertorio, comunicados y actividades de nuestra agrupación desde cualquier dispositivo.</p></section>
    <Link href="/acceso" className="primaryButton linkButton homeAccess">Entrar o solicitar registro →</Link><h3>Áreas de la plataforma</h3>
    <section className="grid">{sections.map(s=><article className="tile" key={s.title}><span className="tileIcon">{s.icon}</span><strong>{s.title}</strong><p>{s.detail}</p></article>)}</section>
    <p className="footnote">Acceso privado para miembros autorizados de la Agrupación Musical La Pasión de Mazarrón.</p>
  </main>;
}

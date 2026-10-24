const sections = [
  { icon: "♫", title: "Partituras", detail: "Por hilo musical" },
  { icon: "▦", title: "Calendario", detail: "Ensayos y actuaciones" },
  { icon: "✓", title: "Asistencia", detail: "Confirmaciones y justificantes" },
  { icon: "☷", title: "Tablón", detail: "Avisos y votaciones" },
  { icon: "€", title: "Tesorería", detail: "Solo directiva autorizada" },
  { icon: "♙", title: "Mi perfil", detail: "Fotos y redes sociales" },
];
export default function Home() {
  return <main className="container">
    <header className="header"><span className="brandIcon">♫</span><div><small>AGRUPACIÓN MUSICAL</small><h1>La Pasión de Mazarrón</h1></div></header>
    <section className="hero"><span className="eyebrow">PASIÓN APP · EN DESARROLLO</span><h2>Tu agrupación, siempre contigo.</h2><p>Estamos construyendo la aplicación para organizar ensayos, partituras, comunicaciones y actividades desde cualquier dispositivo.</p></section>
    <h3>Áreas de la plataforma</h3>
    <section className="grid">{sections.map(s=><article className="tile" key={s.title}><span className="tileIcon">{s.icon}</span><strong>{s.title}</strong><p>{s.detail}</p></article>)}</section>
    <p className="footnote">Esta pantalla es un inicio visual. Los módulos, el login y los permisos todavía no están operativos.</p>
  </main>;
}

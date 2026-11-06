"use client";
import Link from "@/lib/app-data";
import Tuner from "./tuner";
import Metronome from "./metronome";

export default function MusicTools({partName}:{partName:string|null}){
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>AGRUPACIÓN MUSICAL LA PASIÓN</small><h1>Afinador y metrónomo</h1></div></header>
  <p className="muted">Afina con la nota que lees en tu partitura: elige tu instrumento y el afinador hace el transporte por ti. Tu configuración se guarda en este móvil.</p>
  <div className="toolsGrid">
   <section className="toolsCard"><h2>Afinador</h2><Tuner partName={partName}/></section>
   <section className="toolsCard"><Metronome/></section>
  </div>
 </main>;
}

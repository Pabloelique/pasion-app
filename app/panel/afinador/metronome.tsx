"use client";
import {useEffect,useRef,useState} from "react";
import Select from "@/components/app-select";

const STORAGE="pasion-metronome-v1";
const METERS=[{beats:2,label:"2/4"},{beats:3,label:"3/4"},{beats:4,label:"4/4"},{beats:6,label:"6/8"},{beats:1,label:"Sin acento"}];
export const clampBpm=(n:number)=>Math.min(240,Math.max(30,Math.round(n)));

type Saved={bpm:number;beats:number};
function readSaved():Saved{
 try{const v=JSON.parse(localStorage.getItem(STORAGE)??"null") as Saved|null;if(v&&Number.isFinite(v.bpm))return {bpm:clampBpm(v.bpm),beats:METERS.some(m=>m.beats===v.beats)?v.beats:4};}catch{}
 return {bpm:72,beats:4};
}

/** Metrónomo con Web Audio: programa los golpes por adelantado para que el tempo no se descuadre. */
export default function Metronome({compact=false}:{compact?:boolean}){
 const [bpm,setBpm]=useState(72);
 const [beats,setBeats]=useState(4);
 const [playing,setPlaying]=useState(false);
 const [beat,setBeat]=useState(-1);
 const ctx=useRef<AudioContext|null>(null);
 const timer=useRef<number|undefined>(undefined);
 const nextTime=useRef(0);
 const count=useRef(0);
 const settings=useRef({bpm:72,beats:4});
 const taps=useRef<number[]>([]);
 const visual=useRef<number[]>([]);
 useEffect(()=>{const s=readSaved();setBpm(s.bpm);setBeats(s.beats);},[]);
 useEffect(()=>{settings.current={bpm,beats};try{localStorage.setItem(STORAGE,JSON.stringify({bpm,beats}));}catch{}},[bpm,beats]);
 useEffect(()=>()=>{stop();void ctx.current?.close();},[]);

 function click(time:number,accent:boolean){
  const ac=ctx.current!;
  const osc=ac.createOscillator();const gain=ac.createGain();
  osc.type="square";osc.frequency.value=accent?1760:1100;
  gain.gain.setValueAtTime(0.0001,time);
  gain.gain.exponentialRampToValueAtTime(accent?0.6:0.35,time+0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001,time+0.05);
  osc.connect(gain).connect(ac.destination);
  osc.start(time);osc.stop(time+0.06);
 }
 function schedule(){
  const ac=ctx.current;if(!ac)return;
  while(nextTime.current<ac.currentTime+0.12){
   const {bpm:tempo,beats:bar}=settings.current;
   const position=count.current%bar;
   click(nextTime.current,bar>1&&position===0);
   const delay=Math.max(0,(nextTime.current-ac.currentTime)*1000);
   visual.current.push(window.setTimeout(()=>setBeat(position),delay));
   nextTime.current+=60/tempo;
   count.current++;
  }
 }
 async function start(){
  if(!ctx.current){
   const Ctor=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
   ctx.current=new Ctor();
  }
  await ctx.current.resume();
  count.current=0;nextTime.current=ctx.current.currentTime+0.06;
  schedule();timer.current=window.setInterval(schedule,25);
  setPlaying(true);
 }
 function stop(){
  window.clearInterval(timer.current);timer.current=undefined;
  visual.current.forEach(t=>window.clearTimeout(t));visual.current=[];
  setPlaying(false);setBeat(-1);
 }
 function tap(){
  const now=performance.now();
  const list=[...taps.current.filter(t=>now-t<2500),now];taps.current=list;
  if(list.length>=2){
   const gaps=list.slice(1).map((t,i)=>t-list[i]);
   setBpm(clampBpm(60000/(gaps.reduce((a,b)=>a+b,0)/gaps.length)));
  }
 }
 const dots=Math.max(1,beats);
 return <section className={compact?"metronome compact":"metronome"} aria-label="Metrónomo">
  {!compact&&<h2>Metrónomo</h2>}
  <div className="metronomeBeats" aria-hidden="true">
   {Array.from({length:dots},(_,i)=><span key={i} className={(beat===i?"on ":"")+(i===0&&beats>1?"accent":"")}/>)}
  </div>
  <div className="metronomeTempo">
   <button type="button" onClick={()=>setBpm(b=>clampBpm(b-1))} aria-label="Bajar tempo">−</button>
   <output aria-live="polite"><strong>{bpm}</strong><small>BPM</small></output>
   <button type="button" onClick={()=>setBpm(b=>clampBpm(b+1))} aria-label="Subir tempo">+</button>
  </div>
  <input type="range" min={30} max={240} value={bpm} onChange={e=>setBpm(clampBpm(Number(e.target.value)))} aria-label="Tempo en pulsaciones por minuto"/>
  <div className="metronomeRow">
   <Select value={beats} onChange={e=>setBeats(Number(e.target.value))} aria-label="Compás">
    {METERS.map(m=><option key={m.label} value={m.beats}>{m.label}</option>)}
   </Select>
   <button type="button" className="secondaryButton" onClick={tap}>Marcar tempo</button>
   <button type="button" className="primaryButton" onClick={()=>playing?stop():void start()}>{playing?"■ Parar":"▶ Empezar"}</button>
  </div>
  {!compact&&<p className="muted small">En iPhone, si no suena, quita el modo silencio del móvil.</p>}
 </section>;
}

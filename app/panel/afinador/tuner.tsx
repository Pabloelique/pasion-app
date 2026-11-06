"use client";
import {useEffect,useRef,useState} from "react";
import {INSTRUMENTS,TRANSPOSITIONS,detectPitchDetailed,midiToFrequency,noteName,presetForPart,readPitch,type Notation,type Reading} from "@/lib/tuning";

type Settings={instrument:string;transposition:string;a4:number;notation:Notation};
const KEY="pasion-tuner-v1";
const REFERENCES=[440,441,442,443];

function load(part:string|null):Settings{
 const preset=presetForPart(part);
 const fallback:Settings={instrument:preset.id,transposition:preset.transposition,a4:442,notation:"latin"};
 try{
  const v=JSON.parse(localStorage.getItem(KEY)??"null") as Partial<Settings>|null;
  if(v&&TRANSPOSITIONS.some(t=>t.id===v.transposition)&&REFERENCES.includes(Number(v.a4)))
   return {instrument:INSTRUMENTS.some(i=>i.id===v.instrument)?v.instrument!:"concierto",transposition:v.transposition!,a4:Number(v.a4),notation:v.notation==="english"?"english":"latin"};
 }catch{}
 return fallback;
}

export default function Tuner({partName}:{partName:string|null}){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [listening,setListening]=useState(false);
 const [reading,setReading]=useState<Reading|null>(null);
 const [error,setError]=useState("");
 const [playing,setPlaying]=useState<string|null>(null);
 const audio=useRef<{ctx:AudioContext;stream:MediaStream;timer:number}|null>(null);
 const [level,setLevel]=useState(0);
 const tone=useRef<{ctx:AudioContext;osc:OscillatorNode}|null>(null);
 const history=useRef<number[]>([]);
 const current=useRef<Settings|null>(null);
 useEffect(()=>{setSettings(load(partName));},[partName]);
 useEffect(()=>{current.current=settings;if(settings)try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}},[settings]);
 useEffect(()=>()=>{stopListening();stopTone();},[]);
 if(!settings)return <p className="muted">Preparando afinador…</p>;
 const transposition=TRANSPOSITIONS.find(t=>t.id===settings.transposition)!;
 const update=(patch:Partial<Settings>)=>setSettings(old=>old?{...old,...patch}:old);
 function chooseInstrument(id:string){
  const preset=INSTRUMENTS.find(i=>i.id===id);
  if(preset)update({instrument:id,transposition:preset.transposition});
 }
 async function startListening(){
  setError("");
  if(!navigator.mediaDevices?.getUserMedia){setError("Este navegador no permite usar el micrófono. En iPhone abre PASIÓN APP desde Safari o desde el icono de la pantalla de inicio.");return;}
  // En iPhone el audio debe crearse en el mismo toque del botón, antes de cualquier espera.
  const Ctor=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  const ctx=new Ctor();
  void ctx.resume();
  let stream:MediaStream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  }catch{
   void ctx.close();
   setError("No se ha podido usar el micrófono. Permite el acceso al micrófono para PASIÓN APP en los ajustes del navegador y vuelve a intentarlo.");
   return;
  }
  await ctx.resume().catch(()=>{});
  const source=ctx.createMediaStreamSource(stream);
  const analyser=ctx.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=0;
  // Salida a volumen cero: algunos Safari no procesan el micrófono si no llega al altavoz.
  const mute=ctx.createGain();mute.gain.value=0;
  source.connect(analyser);analyser.connect(mute).connect(ctx.destination);
  const buffer=new Float32Array(analyser.fftSize);
  let lastHeard=0;
  const analyse=()=>{
   analyser.getFloatTimeDomainData(buffer);
   let peak=0;for(let i=0;i<buffer.length;i+=8)peak=Math.max(peak,Math.abs(buffer[i]));
   setLevel(Math.min(1,peak*4));
   const found=detectPitchDetailed(buffer,ctx.sampleRate);
   const now=performance.now();
   if(found){
    lastHeard=now;
    // Mediana de las últimas lecturas para que la aguja no baile; si cambias de nota, se reinicia.
    const prev=history.current[history.current.length-1];
    const list=prev&&Math.abs(1200*Math.log2(found.hz/prev))>80?[found.hz]:[...history.current,found.hz].slice(-5);
    history.current=list;
    const median=[...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
    const cfg=current.current;
    if(cfg)setReading(readPitch(median,cfg.a4,TRANSPOSITIONS.find(x=>x.id===cfg.transposition)!.semitones));
   }else if(now-lastHeard>900){history.current=[];setReading(null);}
  };
  audio.current={ctx,stream,timer:window.setInterval(analyse,50)};
  setListening(true);
 }
 function stopListening(){
  const a=audio.current;audio.current=null;
  if(a){window.clearInterval(a.timer);a.stream.getTracks().forEach(t=>t.stop());void a.ctx.close();}
  history.current=[];setListening(false);setReading(null);setLevel(0);
 }
 function stopTone(){const t=tone.current;tone.current=null;if(t){t.osc.stop();void t.ctx.close();}setPlaying(null);}
 async function playTone(id:string,concertMidi:number){
  if(playing===id){stopTone();return;}
  stopTone();
  const Ctor=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  const ctx=new Ctor();await ctx.resume();
  const osc=ctx.createOscillator();const gain=ctx.createGain();
  osc.type="triangle";osc.frequency.value=midiToFrequency(concertMidi,settings!.a4);gain.gain.value=0.25;
  osc.connect(gain).connect(ctx.destination);osc.start();
  tone.current={ctx,osc};setPlaying(id);
 }
 const written=reading?noteName(reading.writtenMidi,settings.notation):null;
 const concert=reading?noteName(reading.concertMidi,settings.notation):null;
 const cents=reading?.cents??0;
 const inTune=reading!==null&&Math.abs(cents)<=5;
 const verdict=!reading?(listening?"Escuchando… toca una nota larga":"Pulsa «Empezar a afinar»"):inTune?"¡Afinado!":cents>0?"Estás alto · baja un poco":"Estás bajo · sube un poco";
 // Notas de afinación habituales: Si♭ y La reales.
 const references=[{id:"sib",label:"Si♭ real",midi:70},{id:"la",label:"La real",midi:69},{id:"fa",label:"Fa real",midi:65}];
 return <section className="tuner">
  <div className="tunerSettings">
   <label>Mi instrumento<select value={settings.instrument} onChange={e=>chooseInstrument(e.target.value)}>
    {INSTRUMENTS.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
   </select></label>
   <label>Afinación del instrumento<select value={settings.transposition} onChange={e=>update({transposition:e.target.value})}>
    {TRANSPOSITIONS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select></label>
   <label>La de referencia<select value={settings.a4} onChange={e=>update({a4:Number(e.target.value)})}>
    {REFERENCES.map(r=><option key={r} value={r}>La = {r} Hz</option>)}
   </select></label>
   <label>Nombres de notas<select value={settings.notation} onChange={e=>update({notation:e.target.value as Notation})}>
    <option value="latin">Do, Re, Mi…</option><option value="english">C, D, E…</option>
   </select></label>
  </div>
  <p className="muted small">{transposition.detail}</p>
  <div className={"tunerDisplay"+(inTune?" inTune":"")} aria-live="polite">
   <span className="tunerLabel">Nota escrita (la de tu partitura)</span>
   <strong className="tunerNote">{written?written.name:"—"}<small>{written?written.octave:""}</small></strong>
   <div className="tunerGauge" aria-label={reading?cents+" cents":"Sin lectura"}>
    <span className="tunerScale"><i>-50</i><i>0</i><i>+50</i></span>
    <span className="tunerNeedle" style={{left:`calc(${50+Math.max(-50,Math.min(50,cents))}% - 2px)`}}/>
   </div>
   <span className="tunerVerdict">{verdict}</span>
   {listening&&<span className="tunerLevel" aria-hidden="true"><i style={{width:Math.round(level*100)+"%"}}/></span>}
   <span className="muted small">{reading&&concert?`Suena: ${concert.name}${concert.octave} real · ${reading.hz.toFixed(1)} Hz · ${cents>0?"+":""}${cents} cents`:"El afinador escucha por el micrófono del móvil."}</span>
  </div>
  {error&&<p role="alert" className="formError">{error}</p>}
  <div className="attendanceActions">
   <button type="button" className="primaryButton" onClick={()=>listening?stopListening():void startListening()}>{listening?"■ Parar afinador":"🎤 Empezar a afinar"}</button>
  </div>
  <h3>Nota de referencia</h3>
  <p className="muted small">Suena la nota real; entre paréntesis, cómo la lees tú.</p>
  <div className="attendanceActions">
   {references.map(r=>{const w=noteName(r.midi+transposition.semitones,settings.notation);return <button key={r.id} type="button" className="secondaryButton" aria-pressed={playing===r.id} onClick={()=>void playTone(r.id,r.midi)}>{playing===r.id?"■ ":"▶ "}{r.label} (tu {w.name})</button>;})}
  </div>
 </section>;
}

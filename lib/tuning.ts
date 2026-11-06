// PASIÓN APP · Lógica del afinador: transporte por instrumento, nombres de notas y detección de tono.

export type Transposition={id:string;name:string;semitones:number;detail:string};

/** semitones = cuántos semitonos está la nota ESCRITA por encima de la nota REAL que suena. */
export const TRANSPOSITIONS:Transposition[]=[
 {id:"do",name:"Do (sin transporte)",semitones:0,detail:"Lo que lees es lo que suena: trombón y bombardino en clave de fa, tuba en Do, corneta en Do."},
 {id:"sib",name:"Si♭",semitones:2,detail:"Trompeta, corneta, fliscorno y clarinete en Si♭: suenan un tono por debajo de lo escrito."},
 {id:"sib-sol",name:"Si♭ en clave de sol (9ª)",semitones:14,detail:"Bombardino, trombón o tuba en Si♭ escritos en clave de sol: suenan una novena por debajo."},
 {id:"reb",name:"Re♭",semitones:-1,detail:"Corneta en Re♭: suena un semitono por encima de lo escrito."},
 {id:"mib",name:"Mi♭ (6ª)",semitones:9,detail:"Saxo alto y trompa en Mi♭: suenan una sexta mayor por debajo."},
 {id:"fa",name:"Fa",semitones:7,detail:"Trompa en Fa: suena una quinta por debajo de lo escrito."},
];

export type InstrumentPreset={id:string;name:string;transposition:string};
export const INSTRUMENTS:InstrumentPreset[]=[
 {id:"corneta",name:"Corneta en Si♭",transposition:"sib"},
 {id:"corneta-do",name:"Corneta en Do",transposition:"do"},
 {id:"corneta-reb",name:"Corneta en Re♭",transposition:"reb"},
 {id:"trompeta",name:"Trompeta en Si♭",transposition:"sib"},
 {id:"fliscorno",name:"Fliscorno en Si♭",transposition:"sib"},
 {id:"bombardino-sol",name:"Bombardino (clave de sol)",transposition:"sib-sol"},
 {id:"bombardino-fa",name:"Bombardino (clave de fa)",transposition:"do"},
 {id:"trombon",name:"Trombón (clave de fa)",transposition:"do"},
 {id:"trombon-sol",name:"Trombón en Si♭ (clave de sol)",transposition:"sib-sol"},
 {id:"tuba-do",name:"Tuba en Do",transposition:"do"},
 {id:"tuba-sib",name:"Tuba en Si♭",transposition:"sib"},
 {id:"trompa",name:"Trompa en Fa",transposition:"fa"},
 {id:"saxo-alto",name:"Saxo alto en Mi♭",transposition:"mib"},
 {id:"concierto",name:"Afinación real (sin transporte)",transposition:"do"},
];

const normalize=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
/** Elige el instrumento por defecto a partir del hilo musical del perfil. */
export function presetForPart(part:string|null|undefined):InstrumentPreset{
 const n=normalize(part??"");
 const by=(id:string)=>INSTRUMENTS.find(i=>i.id===id)!;
 if(n.includes("corneta")&&(n.includes("reb")||n.includes("do/")||n.includes(" do")))return by("corneta-do");
 if(n.includes("corneta"))return by("corneta");
 if(n.includes("trompeta"))return by("trompeta");
 if(n.includes("fliscorno"))return by("fliscorno");
 if(n.includes("bombardino"))return by("bombardino-sol");
 if(n.includes("tuba")&&(n.includes("si bemol")||n.includes("sib")))return by("tuba-sib");
 if(n.includes("tuba"))return by("tuba-do");
 if(n.includes("trombon"))return by("trombon");
 if(n.includes("trompa"))return by("trompa");
 if(n.includes("saxo"))return by("saxo-alto");
 return by("concierto");
}

const LATIN=["Do","Do♯","Re","Mi♭","Mi","Fa","Fa♯","Sol","La♭","La","Si♭","Si"];
const ENGLISH=["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
export type Notation="latin"|"english";
export function noteName(midi:number,notation:Notation="latin"){
 const m=Math.round(midi);
 return {name:(notation==="english"?ENGLISH:LATIN)[((m%12)+12)%12],octave:Math.floor(m/12)-1};
}

/** Frecuencia → nota MIDI exacta (decimal) con el La de referencia indicado. */
export const frequencyToMidi=(hz:number,a4=440)=>69+12*Math.log2(hz/a4);
export const midiToFrequency=(midi:number,a4=440)=>a4*Math.pow(2,(midi-69)/12);

export type Reading={hz:number;concertMidi:number;writtenMidi:number;cents:number};
export function readPitch(hz:number,a4:number,semitones:number):Reading{
 const exact=frequencyToMidi(hz,a4);
 const concertMidi=Math.round(exact);
 return {hz,concertMidi,writtenMidi:concertMidi+semitones,cents:Math.round((exact-concertMidi)*100)};
}

/**
 * Detección de tono (método de McLeod / NSDF).
 * Funciona con señales flojas del micrófono, con notas graves (tuba ~40 Hz) y con timbres
 * con muchos armónicos (metales). Devuelve { hz, clarity } o null si no hay una nota clara.
 */
export function detectPitchDetailed(buffer:Float32Array,sampleRate:number,minHz=38,maxHz=1600):{hz:number;clarity:number}|null{
 // Reduce a la mitad la frecuencia de muestreo (media de pares): 4 veces menos cálculo.
 const half=Math.floor(buffer.length/2);
 const x=new Float32Array(half);
 let mean=0;
 for(let i=0;i<half;i++){x[i]=(buffer[2*i]+buffer[2*i+1])/2;mean+=x[i];}
 mean/=half;
 let energy=0;
 for(let i=0;i<half;i++){x[i]-=mean;energy+=x[i]*x[i];}
 const rms=Math.sqrt(energy/half);
 if(rms<0.0025)return null; // silencio
 const rate=sampleRate/2;
 const minLag=Math.max(2,Math.floor(rate/maxHz));
 const maxLag=Math.min(Math.floor(half/2),Math.ceil(rate/minHz));
 const nsdf=new Float32Array(maxLag+2);
 for(let tau=minLag-1;tau<=maxLag+1&&tau<half;tau++){
  let acf=0,m=0;
  const limit=half-tau;
  for(let j=0;j<limit;j++){const a=x[j],b=x[j+tau];acf+=a*b;m+=a*a+b*b;}
  nsdf[tau]=m>0?2*acf/m:0;
 }
 // Máximos clave: el mayor de cada tramo positivo tras cruzar por cero.
 const peaks:number[]=[];
 let tau=minLag;
 while(tau<maxLag&&nsdf[tau]>0)tau++; // salir del primer lóbulo
 while(tau<maxLag){
  while(tau<maxLag&&nsdf[tau]<=0)tau++;
  let best=-1;
  while(tau<maxLag&&nsdf[tau]>0){if(best<0||nsdf[tau]>nsdf[best])best=tau;tau++;}
  if(best>0)peaks.push(best);
 }
 if(peaks.length===0)return null;
 const highest=Math.max(...peaks.map(p=>nsdf[p]));
 if(highest<0.6)return null; // ruido, no nota
 const chosen=peaks.find(p=>nsdf[p]>=0.88*highest)!;
 // Interpolación parabólica para afinar al cent.
 const a=nsdf[chosen-1],b=nsdf[chosen],c=nsdf[chosen+1];
 const denom=a-2*b+c;
 const shift=denom!==0?0.5*(a-c)/denom:0;
 const period=chosen+Math.max(-1,Math.min(1,shift));
 const hz=rate/period;
 if(hz<minHz||hz>maxHz)return null;
 return {hz,clarity:b};
}

/** Igual que detectPitchDetailed pero devuelve solo los Hz (o -1 si no hay nota clara). */
export function detectPitch(buffer:Float32Array,sampleRate:number):number{
 return detectPitchDetailed(buffer,sampleRate)?.hz??-1;
}

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

/** Detección de tono por autocorrelación. Devuelve Hz o -1 si no hay una nota clara. */
export function detectPitch(buffer:Float32Array,sampleRate:number):number{
 let size=buffer.length;
 let rms=0;for(let i=0;i<size;i++)rms+=buffer[i]*buffer[i];
 rms=Math.sqrt(rms/size);
 if(rms<0.012)return -1;
 // Recorta los extremos silenciosos.
 let r1=0,r2=size-1;const threshold=0.2;
 for(let i=0;i<size/2;i++){if(Math.abs(buffer[i])<threshold){r1=i;break;}}
 for(let i=1;i<size/2;i++){if(Math.abs(buffer[size-i])<threshold){r2=size-i;break;}}
 const data=buffer.slice(r1,r2);size=data.length;
 if(size<64)return -1;
 const c=new Float32Array(size);
 for(let lag=0;lag<size;lag++){let sum=0;for(let j=0;j<size-lag;j++)sum+=data[j]*data[j+lag];c[lag]=sum;}
 let d=0;while(d<size-1&&c[d]>c[d+1])d++;
 let maxVal=-1,maxPos=-1;
 for(let i=d;i<size;i++){if(c[i]>maxVal){maxVal=c[i];maxPos=i;}}
 if(maxPos<=0||maxVal<c[0]*0.5)return -1;
 let t0=maxPos;
 const x1=c[t0-1]??c[t0],x2=c[t0],x3=c[t0+1]??c[t0];
 const a=(x1+x3-2*x2)/2,b=(x3-x1)/2;
 if(a)t0=t0-b/(2*a);
 const hz=sampleRate/t0;
 return hz>=25&&hz<=2500?hz:-1;
}

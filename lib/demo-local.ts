// Read-only public examples. Real works, simulated activity; never imports Supabase.
import {demoScoreSvg} from "./demo-score";
type Row=Record<string,unknown>;
type Result={data:Row[]|Row|null;error:{message:string;code:string}|null;count:number|null};
export const demoId=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
export const DEMO_USER=demoId(1);
const readonlyError={message:"Demostración de solo lectura: esta acción no está disponible.",code:"DEMO_READ_ONLY"};
export function demoFixtures(now=new Date()){
 const at=(days:number,hour=19)=>{const d=new Date(now);d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString();};
 const stamp=now.toISOString(),event=demoId(10),contest=demoId(20),post=demoId(30);
 const tables:Record<string,Row[]>={
  musical_parts:[{id:1,name:"Trompeta"}],
  band_events:[
   {id:event,title:"Taller de interpretación: Amarguras",event_type:"ensayo",description:"Agenda simulada: lectura de Amarguras, trabajo de fraseo y equilibrio de metales. No es una convocatoria real.",location:"Sala de ensayo · escenario de demostración",starts_at:at(1),ends_at:at(1,21),cancelled_at:null},
   {id:demoId(11),title:"Concierto de música procesional",event_type:"actuacion",description:"Agenda simulada: concierto al aire libre con obras de Manuel Font de Anta. No es una actuación anunciada ni vinculada a La Pasión.",location:"Parque de María Luisa · Sevilla (escenario simulado)",starts_at:at(3,18),ends_at:at(3,20),cancelled_at:null}
  ],
  event_responses:[{event_id:event,user_id:DEMO_USER,response:"asistire",justification:null}],
  event_target_parts:[],
  rehearsal_pieces:[{id:demoId(12),event_id:event,march_title:"Amarguras",objective:"Practicar la entrada y el ritmo.",progress:"trabajando",position:1},{id:demoId(13),event_id:event,march_title:"Soleá, dame la mano",objective:"Repasar el final.",progress:"lista",position:2}],
  march_scores:[{id:demoId(14),title:"Himno a la alegría - Trompeta",musical_part_id:1,storage_path:"demo/score-a",mime_type:"image/svg+xml",created_at:stamp}],
  full_scores:[],
  band_repertoire:[{id:demoId(16),title:"Amarguras",composer:"Manuel Font de Anta",youtube_url:"",spotify_url:"",notes:"Obra real de 1919. Fuente: Hermandad de la Amargura (amargura.org/musica/). Selección de muestra, no repertorio de La Pasión.",from_proposal:null,created_at:stamp},{id:demoId(17),title:"Soleá, dame la mano",composer:"Manuel Font de Anta",youtube_url:"",spotify_url:"",notes:"Obra real. Fuente: Archivo SGAE. Selección de muestra, no repertorio de La Pasión.",from_proposal:null,created_at:stamp}],
  board_posts:[{id:post,title:"Lectura de Amarguras o Soleá, dame la mano",content:"Para el próximo taller compararemos el fraseo y los contrastes de estas dos obras de Manuel Font de Anta. Abre la votación para ver las opciones. Actividad simulada: los votos no se envían.",priority:"importante",author_id:demoId(2),created_at:stamp,link_path:"/panel/votaciones#votacion-"+contest},{id:demoId(31),title:"Plan del taller de interpretación",content:"El taller empieza a las 19:00: afinación conjunta, lectura por secciones y repaso de las entradas. Consulta el calendario. Este plan solo ilustra el funcionamiento de la app.",priority:"normal",author_id:demoId(2),created_at:stamp,link_path:"/panel/calendario#evento-"+event}],
  board_comments:[{id:demoId(32),post_id:post,content:"En la lectura revisaremos las respiraciones antes de unir metales y percusión. Mensaje de demostración.",author_id:demoId(3),created_at:stamp}],
  march_contests:[{id:contest,title:"¿Qué obra analizamos en el próximo taller?",created_at:stamp,closes_at:at(1,23),winning_option_id:null,composer:null,estimated_cost:null,published_at:null}],
  march_contest_options:[{id:demoId(21),contest_id:contest,title:"Amarguras"},{id:demoId(22),contest_id:contest,title:"Soleá, dame la mano"}],
  march_contest_votes:[],march_contest_contributions:[],march_proposals:[],march_proposal_votes:[],
  app_notifications:[{id:demoId(40),user_id:DEMO_USER,kind:"comunicado",source_id:post,title:"Nuevo plan de trabajo",message:"Lectura de Amarguras o Soleá, dame la mano",destination:"/panel/tablon",created_at:stamp,read_at:null},{id:demoId(41),user_id:DEMO_USER,kind:"ensayo",source_id:event,title:"Taller de interpretación convocado",message:"Consulta el horario y el plan de trabajo del taller simulado.",destination:"/panel/calendario",created_at:stamp,read_at:null}]
 };
 const rpc:Record<string,Row[]>={
  my_event_responses:tables.event_responses,
  board_people:[{id:demoId(2),display_name:"Equipo de coordinación (demo)"},{id:demoId(3),display_name:"Visitante (demo)"}],
  my_attendance_history:[{event_id:demoId(50),event_title:"Lectura por secciones: Amarguras",event_starts_at:at(-4),attendance_status:"presente",marked_at:at(-4)},{event_id:demoId(51),event_title:"Audición didáctica de música procesional",event_starts_at:at(-7),attendance_status:"justificada",marked_at:at(-7)}],
  march_contest_results:[{contest_id:contest,option_id:demoId(21),vote_count:7},{contest_id:contest,option_id:demoId(22),vote_count:5}],
  march_contest_contribution_totals:[],march_vote_results:[]
 };
 return {tables,rpc,stamp};
}
export type DemoDataset=ReturnType<typeof demoFixtures>;
class LocalQuery {
 private rows:Row[];private blocked=false;private singleRow=false;
 constructor(rows:Row[]){this.rows=rows.map(r=>({...r}));}
 select(..._args:unknown[]){return this;}
 eq(key:string,value:unknown){this.rows=this.rows.filter(r=>r[key]===value);return this;}
 is(key:string,value:unknown){return this.eq(key,value);}
 in(key:string,values:unknown[]){this.rows=this.rows.filter(r=>values.includes(r[key]));return this;}
 gte(key:string,value:string){this.rows=this.rows.filter(r=>String(r[key])>=value);return this;}
 gt(key:string,value:string){this.rows=this.rows.filter(r=>String(r[key])>value);return this;}
 lt(key:string,value:string){this.rows=this.rows.filter(r=>String(r[key])<value);return this;}
 order(key:string,options?:{ascending?:boolean}){this.rows.sort((a,b)=>String(a[key]??"").localeCompare(String(b[key]??""))*(options?.ascending===false?-1:1));return this;}
 limit(n:number){this.rows=this.rows.slice(0,n);return this;}
 maybeSingle(){this.singleRow=true;return this;}
 single(){this.singleRow=true;return this;}
 insert(..._args:unknown[]){this.blocked=true;return this;}
 update(..._args:unknown[]){this.blocked=true;return this;}
 upsert(..._args:unknown[]){this.blocked=true;return this;}
 delete(){this.blocked=true;return this;}
 then(resolve:(result:Result)=>unknown,reject?:(error:unknown)=>unknown){
  const result:Result=this.blocked?{data:null,error:readonlyError,count:null}:{data:this.singleRow?(this.rows[0]??null):this.rows,error:null,count:this.rows.length};
  return Promise.resolve(result).then(resolve,reject);
 }
}
export function createLocalDemoClient(dataset:DemoDataset){
 return {
  from:(table:string)=>new LocalQuery(dataset.tables[table]??[]),
  rpc:(name:string)=>Object.hasOwn(dataset.rpc,name)?Promise.resolve({data:structuredClone(dataset.rpc[name]),error:null}):Promise.resolve({data:null,error:readonlyError}),
  storage:{from:()=>({createSignedUrl:async(path:string)=>path==="demo/score-a"?{data:{signedUrl:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(demoScoreSvg)},error:null}:{data:null,error:readonlyError},upload:async()=>({data:null,error:readonlyError}),remove:async()=>({data:null,error:readonlyError})})}
 };
}
export async function openDemoDatabase(){
 const seed=demoFixtures();
 // IndexedDB lives on this device. No demo content is written to the real database.
 try{
  if(typeof indexedDB!=="undefined")await new Promise<void>((resolve,reject)=>{
   const request=indexedDB.open("pasion-demo-local-v1",1);
   request.onupgradeneeded=()=>request.result.createObjectStore("fixtures");
   request.onerror=()=>reject(request.error);
   request.onblocked=()=>reject(new Error("Almacenamiento local no disponible"));
   request.onsuccess=()=>{const db=request.result;const tx=db.transaction("fixtures","readwrite");tx.objectStore("fixtures").put(seed,"dataset");tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};
  });
 }catch{/* Private browsing may disable IndexedDB; the same fixtures stay in memory. */}
 return {dataset:seed,client:createLocalDemoClient(seed)};
}

// Read-only, entirely fictitious data. This module never imports a Supabase client.
type Row=Record<string,unknown>;
type Result={data:Row[]|Row|null;error:{message:string;code:string}|null;count:number|null};
export const demoId=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
export const DEMO_USER=demoId(1);
const readonlyError={message:"Demostración de solo lectura: esta acción no está disponible.",code:"DEMO_READ_ONLY"};
export function demoFixtures(now=new Date()){
 const at=(days:number,hour=19)=>{const d=new Date(now);d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString();};
 const stamp=now.toISOString(),event=demoId(10),contest=demoId(20),post=demoId(30);
 const tables:Record<string,Row[]>={
  musical_parts:[{id:1,name:"Corneta de ejemplo"}],
  band_events:[
   {id:event,title:"Ensayo general de ejemplo",event_type:"ensayo",description:"Sesión ficticia para conocer cómo se consulta un ensayo.",location:"Sala de ejemplo",starts_at:at(1),ends_at:at(1,21),cancelled_at:null},
   {id:demoId(11),title:"Actuación de ejemplo",event_type:"actuacion",description:"Actividad ficticia sin relación con el calendario real.",location:"Plaza ficticia",starts_at:at(3,18),ends_at:at(3,20),cancelled_at:null}
  ],
  event_responses:[{event_id:event,user_id:DEMO_USER,response:"asistire",justification:null}],
  event_target_parts:[],
  rehearsal_pieces:[{id:demoId(12),event_id:event,march_title:"Marcha de ejemplo A",objective:"Practicar la entrada y el ritmo.",progress:"trabajando",position:1},{id:demoId(13),event_id:event,march_title:"Marcha de ejemplo B",objective:"Repasar el final.",progress:"lista",position:2}],
  march_scores:[{id:demoId(14),title:"Marcha de ejemplo A - Corneta de ejemplo",musical_part_id:1,storage_path:"demo/score-a",mime_type:"image/svg+xml",created_at:stamp},{id:demoId(15),title:"Marcha de ejemplo B - Corneta de ejemplo",musical_part_id:1,storage_path:"demo/score-b",mime_type:"image/svg+xml",created_at:stamp}],
  full_scores:[],
  band_repertoire:[{id:demoId(16),title:"Marcha de ejemplo A",composer:"Autor ficticio",youtube_url:"",spotify_url:"",notes:"Repertorio de demostración.",from_proposal:null,created_at:stamp},{id:demoId(17),title:"Marcha de ejemplo B",composer:"Autora ficticia",youtube_url:"",spotify_url:"",notes:"Marcha de muestra.",from_proposal:null,created_at:stamp}],
  board_posts:[{id:post,title:"Votación de nuevas marchas de ejemplo",content:"Este comunicado es ficticio. Puedes leer el mensaje completo y abrir la votación con el botón VOTA AQUÍ. Los votos están deshabilitados en la demostración.",priority:"importante",author_id:demoId(2),created_at:stamp,link_path:"/panel/votaciones#votacion-"+contest},{id:demoId(31),title:"Próximo ensayo de ejemplo",content:"Consulta el calendario para ver los detalles de este ensayo ficticio.",priority:"normal",author_id:demoId(2),created_at:stamp,link_path:"/panel/calendario#evento-"+event}],
  board_comments:[{id:demoId(32),post_id:post,content:"Comentario ficticio de ejemplo.",author_id:demoId(3),created_at:stamp}],
  march_contests:[{id:contest,title:"Elegir una marcha de ejemplo",created_at:stamp,closes_at:at(1,23),winning_option_id:null,composer:null,estimated_cost:null,published_at:null}],
  march_contest_options:[{id:demoId(21),contest_id:contest,title:"Marcha de ejemplo A"},{id:demoId(22),contest_id:contest,title:"Marcha de ejemplo B"}],
  march_contest_votes:[],march_contest_contributions:[],march_proposals:[],march_proposal_votes:[],
  app_notifications:[{id:demoId(40),user_id:DEMO_USER,kind:"comunicado",source_id:post,title:"Nuevo comunicado de ejemplo",message:"Votación de nuevas marchas de ejemplo",destination:"/panel/tablon",created_at:stamp,read_at:null},{id:demoId(41),user_id:DEMO_USER,kind:"ensayo",source_id:event,title:"Nuevo ensayo de ejemplo",message:"Ensayo general ficticio",destination:"/panel/calendario",created_at:stamp,read_at:null}]
 };
 const rpc:Record<string,Row[]>={
  my_event_responses:tables.event_responses,
  board_people:[{id:demoId(2),display_name:"Directiva de ejemplo"},{id:demoId(3),display_name:"Músico de ejemplo 02"}],
  my_attendance_history:[{event_id:demoId(50),event_title:"Ensayo pasado de ejemplo",event_starts_at:at(-4),attendance_status:"presente",marked_at:at(-4)},{event_id:demoId(51),event_title:"Actuación pasada ficticia",event_starts_at:at(-7),attendance_status:"justificada",marked_at:at(-7)}],
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
const scoreSvg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="white"/><text x="60" y="65" font-size="26">PARTITURA FICTICIA DE EJEMPLO</text><text x="60" y="100" font-size="18">Sin contenido real de la agrupación</text>'+[180,200,220,240,260,360,380,400,420,440].map(y=>'<path d="M60 '+y+'H840" stroke="black"/>').join("")+[130,230,330,430,530,630,730].map((x,i)=>'<ellipse cx="'+x+'" cy="'+(240-i%3*20)+'" rx="12" ry="8"/><path d="M'+(x+11)+' '+(240-i%3*20)+'v-65" stroke="black" stroke-width="3"/>').join("")+'</svg>';
export function createLocalDemoClient(dataset:DemoDataset){
 return {
  from:(table:string)=>new LocalQuery(dataset.tables[table]??[]),
  rpc:(name:string)=>Object.hasOwn(dataset.rpc,name)?Promise.resolve({data:structuredClone(dataset.rpc[name]),error:null}):Promise.resolve({data:null,error:readonlyError}),
  storage:{from:()=>({createSignedUrl:async(path:string)=>["demo/score-a","demo/score-b"].includes(path)?{data:{signedUrl:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(scoreSvg)},error:null}:{data:null,error:readonlyError},upload:async()=>({data:null,error:readonlyError}),remove:async()=>({data:null,error:readonlyError})})}
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

const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const validId=(id:string)=>new RegExp("^"+uuid+"$","i").test(id);
const sections=["/panel/votaciones","/panel/calendario","/panel/partituras","/panel/repertorio","/panel/tablon","/panel/notificaciones","/panel/justificaciones"];
export function safeAppLink(path:string|null|undefined):string|null{
 if(!path)return null;
 if(sections.includes(path))return path;
 return new RegExp("^/panel/(?:votaciones#votacion-|calendario#evento-|tablon#anuncio-|notificaciones#aviso-|justificaciones#falta-)"+uuid+"$","i").test(path)?path:null;
}
export function noticeLink(kind:string,id:string,destination:string){
 if(validId(id)){
  if(kind==="ausencia")return "/panel/justificaciones#falta-"+id;
  if(kind==="votacion"||kind==="aportacion")return "/panel/votaciones#votacion-"+id;
  if(["ensayo","actuacion","evento"].includes(kind))return "/panel/calendario#evento-"+id;
  if(kind==="comunicado")return "/panel/tablon#anuncio-"+id;
 }
 return safeAppLink(destination)??"/panel/notificaciones";
}
export function actionLabel(path:string){
 if(path.startsWith("/panel/justificaciones"))return "VER JUSTIFICACIÓN";
 if(path.startsWith("/panel/votaciones#"))return "VOTA AQUÍ";
 if(path==="/panel/votaciones")return "VER VOTACIÓN DE NUEVAS MARCHAS";
 if(path.startsWith("/panel/calendario#"))return "VER EVENTO";
 if(path==="/panel/calendario")return "VER CALENDARIO";
 if(path==="/panel/partituras")return "VER PARTITURAS";
 if(path==="/panel/repertorio")return "VER REPERTORIO";
 return "LEER COMUNICADO";
}
export type LinkChoice={path:string;title:string;label:string};
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function detectAnnouncementLink(text:string,choices:LinkChoice[]):string|null{
 // Un enlace explícito dentro de la app prevalece sobre las palabras del mensaje.
 const explicit=text.match(/(?:https:\/\/pasion-app\.vercel\.app)?(\/panel\/[a-z-]+(?:#[a-z-]+[0-9a-f-]{36})?)/i);
 if(explicit&&safeAppLink(explicit[1]))return safeAppLink(explicit[1]);
 const words=" "+normalize(text)+" ";
 const matches=choices.filter(c=>normalize(c.title).length>=5&&words.includes(" "+normalize(c.title)+" "));
 if(matches.length===1)return matches[0].path;
 if(/\b(votacion|votaciones|votar|vota)\b/.test(words))return "/panel/votaciones";
 if(/\b(ensayo|ensayos|actuacion|actuaciones|reunion|calendario)\b/.test(words))return "/panel/calendario";
 if(/\b(partitura|partituras)\b/.test(words))return "/panel/partituras";
 if(/\brepertorio\b/.test(words))return "/panel/repertorio";
 return null;
}

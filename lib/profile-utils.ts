// PASIÓN APP · Utilidades del perfil: redes sociales, iniciales y fotos.

export type Network="instagram"|"tiktok"|"facebook";
const patterns:Record<Network,{re:RegExp;max:number;hosts:string[]}>={
 instagram:{re:/^[A-Za-z0-9._]{1,30}$/,max:30,hosts:["instagram.com","www.instagram.com"]},
 tiktok:{re:/^[A-Za-z0-9._]{1,30}$/,max:30,hosts:["tiktok.com","www.tiktok.com"]},
 facebook:{re:/^[A-Za-z0-9.]{1,50}$/,max:50,hosts:["facebook.com","www.facebook.com","m.facebook.com"]},
};
/** Acepta «@usuario», «usuario» o el enlace completo y devuelve solo el usuario (o null si no es válido). */
export function cleanHandle(network:Network,value:string):string|null{
 let v=value.trim();
 if(!v)return "";
 if(/^https?:\/\//i.test(v)||/^(www\.)?(instagram|tiktok|facebook)\.com/i.test(v)){
  try{
   const url=new URL(/^https?:/i.test(v)?v:"https://"+v);
   if(!patterns[network].hosts.includes(url.hostname.toLowerCase()))return null;
   v=url.pathname.split("/").filter(Boolean)[0]??"";
  }catch{return null;}
 }
 v=v.replace(/^@/,"");
 return patterns[network].re.test(v)?v:null;
}
export function socialUrl(network:Network,handle:string){
 if(network==="instagram")return "https://www.instagram.com/"+encodeURIComponent(handle)+"/";
 if(network==="tiktok")return "https://www.tiktok.com/@"+encodeURIComponent(handle);
 return "https://www.facebook.com/"+encodeURIComponent(handle);
}
export function initials(first:string|null|undefined,last:string|null|undefined){
 const a=(first??"").trim()[0]??"",b=(last??"").trim()[0]??"";
 return (a+b).toLocaleUpperCase("es")||"♪";
}
export const MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

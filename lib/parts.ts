// PASIÓN APP · Hilos musicales agrupados por familia de instrumento.
export type Part={id:number;name:string};
export type Family={key:string;name:string;icon:string;parts:Part[]};
const FAMILIES=[
 {key:"corneta",name:"Cornetas",icon:"🎺"},
 {key:"trompeta",name:"Trompetas",icon:"🎺"},
 {key:"trombon",name:"Trombones",icon:"🎶"},
 {key:"bombardino",name:"Bombardinos",icon:"🎶"},
 {key:"tuba",name:"Tubas",icon:"🎶"},
 {key:"percusion",name:"Percusión",icon:"🥁"},
 {key:"otros",name:"Otros",icon:"♫"},
];
const norm=(v:string)=>v.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
export function familyOf(name:string){
 const n=norm(name);
 if(n.startsWith("corneta"))return "corneta";
 if(n.startsWith("trompeta"))return "trompeta";
 if(n.startsWith("trombon"))return "trombon";
 if(n.startsWith("bombardino"))return "bombardino";
 if(n.startsWith("tuba"))return "tuba";
 if(/tambor|bombo|platos|caja|percusion/.test(n))return "percusion";
 return "otros";
}
/** Dentro de cada familia: primero los numerados (1, 2, 3) y luego el resto por orden alfabético. */
function partOrder(a:Part,b:Part){
 const na=a.name.match(/\s(\d+)\s*$/),nb=b.name.match(/\s(\d+)\s*$/);
 if(na&&nb)return Number(na[1])-Number(nb[1]);
 if(na)return -1;if(nb)return 1;
 return a.name.localeCompare(b.name,"es");
}
export function groupParts(parts:Part[]):Family[]{
 return FAMILIES.map(f=>({...f,parts:parts.filter(p=>familyOf(p.name)===f.key).sort(partOrder)})).filter(f=>f.parts.length>0);
}
/** Nombre corto dentro de su familia: «Trompeta 1» → «1ª», «Tuba en Do» → «en Do». */
export function shortName(name:string){
 const rest=name.replace(/^\S+\s*/,"").trim();
 if(/^\d+$/.test(rest))return rest+"ª";
 return rest?rest.charAt(0).toLocaleUpperCase("es")+rest.slice(1):name;
}

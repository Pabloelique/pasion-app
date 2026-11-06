// PASIÓN APP · Fechas de Semana Santa para la cuenta atrás.
/** Fechas de Semana Santa (algoritmo de Butcher para el Domingo de Resurrección). */
export function easterSunday(year:number){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
 const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
 const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
 return {year,month,day};
}

const DAY=86400000;
/** Inicio (Viernes de Dolores, Domingo de Ramos) y fin (Domingo de Resurrección) en hora de Madrid. */
export function holyWeek(year:number){
 const {month,day}=easterSunday(year);
 const easter=Date.UTC(year,month-1,day);
 const at=(offset:number)=>new Date(easter+offset*DAY);
 return {dolores:at(-9),ramos:at(-7),jueves:at(-3),viernes:at(-2),resurreccion:at(0)};
}
/** Medianoche de Madrid de una fecha civil (UTC+1 en invierno; Semana Santa cae a veces en horario de verano). */
export function madridMidnight(date:Date){
 const y=date.getUTCFullYear(),m=date.getUTCMonth(),d=date.getUTCDate();
 const guess=Date.UTC(y,m,d,0,0,0);
 const offsetHours=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",hour:"2-digit",hourCycle:"h23"}).format(new Date(guess)));
 return new Date(guess-offsetHours*3600000);
}
export type Countdown={state:"before";target:Date;ramos:Date;dolores:Date;year:number}|{state:"during";year:number};
export function semanaSantaCountdown(now=new Date()):Countdown{
 for(const year of [now.getUTCFullYear(),now.getUTCFullYear()+1]){
  const w=holyWeek(year);
  const ramos=madridMidnight(w.ramos),dolores=madridMidnight(w.dolores);
  const end=new Date(madridMidnight(w.resurreccion).getTime()+DAY);
  if(now<dolores)return {state:"before",target:dolores,ramos,dolores,year};
  if(now<end)return {state:"during",year};
 }
 const w=holyWeek(now.getUTCFullYear()+2);
 return {state:"before",target:madridMidnight(w.dolores),ramos:madridMidnight(w.ramos),dolores:madridMidnight(w.dolores),year:now.getUTCFullYear()+2};
}

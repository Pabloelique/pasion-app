"use client";
import {csvCell} from "@/lib/csv";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Booking={id:string;title:string;customer_name:string;location:string;performance_date:string;start_time:string|null;duration_minutes:number|null;status:string;fee_cents:number;notes:string;contract_reference:string;is_test:boolean;created_at:string};
type Payment={id:string;booking_id:string;paid_on:string;amount_cents:number;method:string;reference:string};
const statuses:Record<string,string>={propuesta:"Propuesta",negociacion:"En negociación",confirmada:"Confirmada",realizada:"Realizada",cancelada:"Cancelada"};
const methods:Record<string,string>={transferencia:"Transferencia",efectivo:"Efectivo",tarjeta:"Tarjeta",otros:"Otros"};
const euro=(c:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(c/100);
function parseCents(s:string){const x=s.trim().replace(",",".");if(!/^\d+(?:\.\d{1,2})?$/.test(x))return null;const [a,b=""]=x.split(".");const result=Number(a)*100+Number(b.padEnd(2,"0"));return Number.isSafeInteger(result)&&result>=0&&result<=999999999?result:null;}
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const empty={title:"",customer_name:"",location:"",performance_date:"",start_time:"",duration_minutes:"",status:"propuesta",fee:"",notes:"",contract_reference:"",is_test:false};
type FormValues=typeof empty;
export default function Bookings({userId}:{userId:string}){
 const db=getSupabaseBrowser();
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [form,setForm]=useState<FormValues>({...empty});
 const [editing,setEditing]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [filter,setFilter]=useState("todos"),[search,setSearch]=useState("");
 const [paying,setPaying]=useState<string|null>(null),[paidAmount,setPaidAmount]=useState("");
 const [paidDate,setPaidDate]=useState(today()),[paidMethod,setPaidMethod]=useState("transferencia"),[paidRef,setPaidRef]=useState("");
 const [error,setError]=useState(""),[success,setSuccess]=useState("");
 const field=<K extends keyof FormValues>(key:K,value:FormValues[K])=>setForm(v=>({...v,[key]:value}));
 async function reload(){
  setLoading(true);setError("");
  const [b,p]=await Promise.all([db.from("band_bookings").select("id,title,customer_name,location,performance_date,start_time,duration_minutes,status,fee_cents,notes,contract_reference,is_test,created_at").order("performance_date",{ascending:false}),db.from("booking_payments").select("id,booking_id,paid_on,amount_cents,method,reference")]);
  if(b.error)setError(b.error.message);else setBookings((b.data??[]) as Booking[]);
  if(p.error)setError(p.error.message);else setPayments((p.data??[]) as Payment[]);
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const sums=useMemo(()=>{const by=new Map<string,number>();payments.forEach(p=>by.set(p.booking_id,(by.get(p.booking_id)??0)+p.amount_cents));return by;},[payments]);
 const shown=useMemo(()=>bookings.filter(b=>!b.is_test&&(filter==="todos"||b.status===filter)&&[b.title,b.customer_name,b.location].join(" ").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))),[bookings,filter,search]);
 const confirmed=bookings.filter(b=>!b.is_test&&["confirmada","realizada"].includes(b.status));
 const totals={contracted:confirmed.reduce((a,b)=>a+b.fee_cents,0),collected:confirmed.reduce((a,b)=>a+(sums.get(b.id)??0),0)};
 const loadEdit=(b:Booking)=>{setEditing(b.id);setForm({title:b.title,customer_name:b.customer_name,location:b.location,performance_date:b.performance_date,start_time:b.start_time?.slice(0,5)??"",duration_minutes:b.duration_minutes===null?"":String(b.duration_minutes),status:b.status,fee:(b.fee_cents/100).toFixed(2),notes:b.notes,contract_reference:b.contract_reference,is_test:b.is_test});setError("");setSuccess("");window.scrollTo({top:0,behavior:"smooth"});};
 const reset=()=>{setEditing(null);setForm({...empty});};
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError("");setSuccess("");
  const fee=parseCents(form.fee||"0"),duration=form.duration_minutes?Number(form.duration_minutes):null;
  if(fee===null||duration!==null&&(!Number.isInteger(duration)||duration<15||duration>1440)){setError("Revisa el caché y la duración.");return;}
  if(!form.performance_date){setError("Indica la fecha de la actuación.");return;}
  const payload={title:form.title.trim(),customer_name:form.customer_name.trim(),location:form.location.trim(),performance_date:form.performance_date,start_time:form.start_time||null,duration_minutes:duration,status:form.status,fee_cents:fee,notes:form.notes.trim(),contract_reference:form.contract_reference.trim(),is_test:form.is_test};
  if(!window.confirm((editing?"¿Guardar cambios de":"¿Registrar")+" «"+payload.title+"»?"))return;
  setBusy(true);
  const result=editing?await db.from("band_bookings").update(payload).eq("id",editing):await db.from("band_bookings").insert({...payload,created_by:userId});
  setBusy(false);
  if(result.error){setError(result.error.message);return;}
  reset();setSuccess(editing?"Actuación actualizada.":"Actuación registrada.");await reload();
 }
 async function payment(b:Booking){
  const cents=parseCents(paidAmount),already=sums.get(b.id)??0;
  if(cents===null||cents===0){setError("Introduce un importe cobrado válido.");return;}
  if(cents+already>b.fee_cents){setError("El total cobrado superaría el caché acordado.");return;}
  if(!window.confirm("¿Confirmar un cobro recibido de "+euro(cents)+"? No se reflejará automáticamente en Tesorería."))return;
  setBusy(true);setError("");setSuccess("");
  const result=await db.from("booking_payments").insert({booking_id:b.id,amount_cents:cents,paid_on:paidDate,method:paidMethod,reference:paidRef.trim(),created_by:userId});
  setBusy(false);
  if(result.error){setError(result.error.message);return;}
  setPaying(null);setPaidAmount("");setPaidRef("");setSuccess("Cobro registrado. Recuerda reflejarlo en Tesorería si llevas ambos libros.");await reload();
 }
 function exportCsv(){
  const esc=csvCell;
  const head=["Fecha","Actuación","Contratante","Localidad","Estado","Caché EUR","Cobrado EUR","Pendiente EUR","Referencia"];
  const data=shown.map(b=>{const paid=sums.get(b.id)??0;return [b.performance_date,b.title,b.customer_name,b.location,statuses[b.status],(b.fee_cents/100).toFixed(2),(paid/100).toFixed(2),((b.fee_cents-paid)/100).toFixed(2),b.contract_reference].map(v=>esc(String(v))).join(";");});
  const blob=new Blob(["\uFEFF"+[head.join(";"),...data].join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download="actuaciones_lapasion.csv";anchor.click();URL.revokeObjectURL(url);
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>DIRECTIVA · LA PASIÓN DE MAZARRÓN</small><h1>Actuaciones y contratos</h1></div></header>
  <p className="muted">Gestiona contrataciones, cachés y cobros. Los compromisos pendientes no son ingresos recibidos. El contrato firmado se conserva fuera de este registro.</p>
  <div className="bookingStats"><div><span>Contratado</span><strong>{euro(totals.contracted)}</strong></div><div><span>Cobrado</span><strong>{euro(totals.collected)}</strong></div><div><span>Pendiente</span><strong>{euro(totals.contracted-totals.collected)}</strong></div></div>
  <section className="bookingCard"><h2>{editing?"Editar actuación":"Nueva actuación"}</h2>
   <form className="bookingForm" onSubmit={e=>void submit(e)}>
    <label>Actuación / procesión<input required minLength={3} maxLength={160} value={form.title} onChange={e=>field("title",e.target.value)} placeholder="Ej. Jueves Santo"/></label>
    <label>Contratante / cofradía<input required minLength={3} maxLength={180} value={form.customer_name} onChange={e=>field("customer_name",e.target.value)} placeholder="Nombre de la cofradía"/></label>
    <label>Localidad / lugar<input maxLength={200} value={form.location} onChange={e=>field("location",e.target.value)}/></label>
    <label>Fecha<input type="date" required value={form.performance_date} onChange={e=>field("performance_date",e.target.value)}/></label>
    <label>Hora de inicio<input type="time" value={form.start_time} onChange={e=>field("start_time",e.target.value)}/></label>
    <label>Duración (minutos)<input type="number" min={15} max={1440} value={form.duration_minutes} onChange={e=>field("duration_minutes",e.target.value)}/></label>
    <label>Estado<select value={form.status} onChange={e=>field("status",e.target.value)}>{Object.entries(statuses).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
    <label>Caché acordado (€)<input inputMode="decimal" value={form.fee} onChange={e=>field("fee",e.target.value)} placeholder="Ej. 650,00"/></label>
    <label>Referencia del contrato<input maxLength={200} value={form.contract_reference} onChange={e=>field("contract_reference",e.target.value)} placeholder="Código interno o nombre del PDF"/></label>
    <label className="bookingWide">Observaciones<textarea rows={3} maxLength={2500} value={form.notes} onChange={e=>field("notes",e.target.value)} placeholder="Repertorio, condiciones, contacto…"/></label>
    <div className="bookingActions"><button type="submit" className="primaryButton" disabled={busy}>{busy?"Guardando…":editing?"Guardar cambios":"Registrar actuación"}</button>{editing&&<button type="button" className="secondaryButton" onClick={reset}>Cancelar</button>}</div>
   </form>
  </section>
  <section className="bookingCard">
   <div className="bookingHead"><h2>Contrataciones ({shown.length})</h2><button className="secondaryButton" type="button" onClick={exportCsv} disabled={!shown.length}>Exportar CSV</button></div>
   <div className="bookingFilters"><label>Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Actuación o cofradía"/></label><label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos</option>{Object.entries(statuses).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
   {error&&<p className="formError" role="alert">{error}</p>}
   {success&&<p className="formSuccess" role="status">{success}</p>}
   {loading?<p className="muted">Cargando contrataciones…</p>:shown.length===0?<p className="muted">Todavía no hay actuaciones para estos filtros.</p>:<div className="bookingList">{shown.map(b=>{
    const paid=sums.get(b.id)??0,remaining=b.fee_cents-paid;
    return <article className="bookingItem" key={b.id}>
      <div className="bookingHead"><strong>{b.title}</strong><span className="bookingStatus">{statuses[b.status]??b.status}</span></div>
      <p className="muted small">{b.performance_date} {b.start_time?" · "+b.start_time.slice(0,5):""} · {b.customer_name} · {b.location}</p>
      <p>Caché: <strong>{euro(b.fee_cents)}</strong> · Cobrado: <strong>{euro(paid)}</strong> · Pendiente: <strong>{euro(remaining)}</strong></p>
      {b.contract_reference&&<p className="muted small">Contrato: {b.contract_reference}</p>}
      {b.notes&&<p className="muted small">{b.notes}</p>}
      <div className="bookingActions"><button className="secondaryButton" type="button" onClick={()=>loadEdit(b)}>Editar</button>
      {!b.is_test&&remaining>0&&b.status!=="cancelada"&&<button className="primaryButton" type="button" onClick={()=>{setPaying(paying===b.id?null:b.id);setError("");}}>Registrar cobro</button>}</div>
      {paying===b.id&&<div className="bookingPayment">
       <label>Importe cobrado (€)<input inputMode="decimal" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="Ej. 150,00"/></label>
       <label>Fecha de cobro<input type="date" value={paidDate} onChange={e=>setPaidDate(e.target.value)}/></label>
       <label>Método<select value={paidMethod} onChange={e=>setPaidMethod(e.target.value)}>{Object.entries(methods).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
       <label>Referencia<input maxLength={180} value={paidRef} onChange={e=>setPaidRef(e.target.value)}/></label>
       <button className="primaryButton" type="button" disabled={busy} onClick={()=>void payment(b)}>Confirmar cobro</button>
      </div>}
      {payments.filter(p=>p.booking_id===b.id).length>0&&<details><summary>Historial de cobros</summary>{payments.filter(p=>p.booking_id===b.id).map(p=><p className="muted small" key={p.id}>{p.paid_on} · {euro(p.amount_cents)} · {methods[p.method]??p.method} {p.reference}</p>)}</details>}
     </article>;
   })}</div>}
  </section>
 </main>;
}

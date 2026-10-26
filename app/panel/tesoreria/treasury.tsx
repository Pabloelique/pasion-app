"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Movement={id:string;movement_date:string;kind:"ingreso"|"gasto";category:string;description:string;amount_cents:number;payment_method:string;reference:string;is_test:boolean;created_at:string;reversal_of:string|null;created_by:string};
const categories:Record<string,string>={actuacion:"Actuaciones",donacion:"Donaciones",cuota_voluntaria:"Cuotas voluntarias",subvencion:"Subvenciones",instrumentos:"Instrumentos",partituras:"Partituras",transporte:"Transporte",uniformes:"Uniformes",material:"Material",otros:"Otros"};
const methods:Record<string,string>={efectivo:"Efectivo",transferencia:"Transferencia",tarjeta:"Tarjeta",otros:"Otros"};
const money=(cents:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(cents/100);
function parseCents(s:string):number|null{
 const clean=s.trim().replace(",",".");
 if(!/^\d+(?:\.\d{1,2})?$/.test(clean))return null;
 const [whole,fraction=""]=clean.split(".");
 const result=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 return Number.isSafeInteger(result)&&result>0&&result<=999999999?result:null;
}
function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
export default function Treasury({userId}:{userId:string}){
 const db=getSupabaseBrowser();
 const [rows,setRows]=useState<Movement[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [kind,setKind]=useState<"ingreso"|"gasto">("ingreso");
 const [category,setCategory]=useState("actuacion");
 const [date,setDate]=useState(localDate());
 const [description,setDescription]=useState("");
 const [amount,setAmount]=useState("");
 const [method,setMethod]=useState("transferencia");
 const [reference,setReference]=useState("");
 const [filterKind,setFilterKind]=useState("todos");
 const [filterCategory,setFilterCategory]=useState("todos");
 const [filterYear,setFilterYear]=useState("todos");
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 async function reload(){
  setLoading(true);setError("");
  const {data,error:err}=await db.from("treasury_movements").select("*").order("movement_date",{ascending:false}).order("created_at",{ascending:false}).limit(2000);
  if(err)setError(err.message);else setRows((data??[]) as Movement[]);
  setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const years=useMemo(()=>[...new Set(rows.map(r=>r.movement_date.slice(0,4)))].sort().reverse(),[rows]);
 const visible=useMemo(()=>rows.filter(r=>!r.is_test&&(filterKind==="todos"||r.kind===filterKind)&&(filterCategory==="todos"||r.category===filterCategory)&&(filterYear==="todos"||r.movement_date.startsWith(filterYear))),[rows,filterKind,filterCategory,filterYear]);
 const amounts=useMemo(()=>visible.reduce((acc,r)=>{acc[r.kind]+=r.amount_cents;return acc;},{ingreso:0,gasto:0}),[visible]);
 const reversedIds=useMemo(()=>new Set(rows.map(r=>r.reversal_of).filter(Boolean)),[rows]);
 const add=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const cents=parseCents(amount);
  if(cents===null){setError("Introduce un importe positivo válido con máximo dos decimales.");return;}
  if(description.trim().length<3){setError("La descripción debe tener al menos 3 caracteres.");return;}
  if(!date){setError("Selecciona una fecha.");return;}
  if(!window.confirm("¿Registrar "+money(cents)+" como "+kind+"? El registro no se puede editar: solo anular con otro asiento."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.from("treasury_movements").insert({movement_date:date,kind,category,description:description.trim(),amount_cents:cents,payment_method:method,reference:reference.trim(),is_test:false,created_by:userId});
  setBusy(false);
  if(err){setError(err.message);return;}
  setAmount("");setDescription("");setReference("");setSuccess("Movimiento registrado correctamente.");await reload();
 };
 async function reverse(m:Movement){
  const reason=window.prompt("Motivo de la anulación (mínimo 5 caracteres):");
  if(reason===null)return;
  if(reason.trim().length<5||reason.length>200){setError("Indica un motivo de 5 a 200 caracteres.");return;}
  if(!window.confirm("¿Anular este movimiento con un asiento de signo contrario? Quedará registrada la anulación."))return;
  setBusy(true);setError("");setSuccess("");
  const {error:err}=await db.rpc("reverse_treasury_movement",{target_id:m.id,reason:reason.trim()});
  setBusy(false);
  if(err){setError(err.message);return;}
  setSuccess("Movimiento anulado mediante contrapartida.");await reload();
 }
 function exportCsv(){
  const headers=["Fecha","Tipo","Categoría","Concepto","Importe EUR","Método","Referencia","Creado por","ID","Anula a"];
  const val=(s:string)=>'"'+s.replaceAll('"','""')+'"';
  const lines=[headers.join(";"),...visible.map(m=>[
   m.movement_date,m.kind,categories[m.category]??m.category,m.description,(m.amount_cents/100).toFixed(2).replace(".",","),methods[m.payment_method]??m.payment_method,m.reference,m.created_by,m.id,m.reversal_of??""
  ].map(v=>val(String(v))).join(";"))];
  const csv="\uFEFF"+lines.join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="pasion_tesoreria_"+localDate()+".csv";a.click();URL.revokeObjectURL(url);
 }
 return <main className="container">
  <Link href="/panel" className="backLink">← Volver al panel</Link>
  <header className="header"><span className="brandIcon"><img src="/icons/logo-192.png" alt="Escudo de La Pasión de Mazarrón" width={54} height={54}/></span><div><small>DIRECTIVA · LA PASIÓN DE MAZARRÓN</small><h1>Tesorería</h1></div></header>
  <p className="muted">Libro interno de movimientos económicos. Solo directiva y superadmin. No realiza pagos, facturas ni conciliación bancaria automática.</p>
  <section className="treasuryCard"><h2>Registrar movimiento</h2>
   <form className="treasuryForm" onSubmit={e=>void add(e)}>
    <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as "ingreso"|"gasto")}><option value="ingreso">Ingreso</option><option value="gasto">Gasto</option></select></label>
    <label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
    <label>Fecha<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Importe (€)<input required inputMode="decimal" placeholder="125,50" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Concepto<input required minLength={3} maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ej. Actuación Domingo de Ramos"/></label>
    <label>Método<select value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(methods).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
    <label>Referencia (opcional)<input maxLength={120} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Referencia bancaria o justificante"/></label>
    <button disabled={busy} type="submit" className="primaryButton">{busy?"Registrando…":"Guardar movimiento"}</button>
   </form>
  </section>
  <section className="treasuryCard">
   <div className="treasuryHeading"><h2>Resumen económico</h2><button className="secondaryButton" type="button" disabled={loading} onClick={()=>void reload()}>Actualizar</button></div>
   <p className="muted small">Saldo calculado exclusivamente a partir de los movimientos registrados en la app, no del saldo bancario real.</p>
   <div className="treasuryFilters">
    <label>Tipo<select value={filterKind} onChange={e=>setFilterKind(e.target.value)}><option value="todos">Todos</option><option value="ingreso">Ingresos</option><option value="gasto">Gastos</option></select></label>
    <label>Categoría<select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="todos">Todas</option>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Año<select value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="todos">Todos</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   </div>
   <div className="treasuryStats"><div><span>Ingresos</span><strong>{money(amounts.ingreso)}</strong></div><div><span>Gastos</span><strong>{money(amounts.gasto)}</strong></div><div><span>Saldo</span><strong>{money(amounts.ingreso-amounts.gasto)}</strong></div></div>
   <div className="treasuryHeading"><h3>Movimientos ({visible.length})</h3><button className="secondaryButton" type="button" onClick={exportCsv} disabled={loading||visible.length===0}>Exportar CSV</button></div>
   {error&&<p role="alert" className="formError">{error}</p>}
   {success&&<p role="status" className="formSuccess">{success}</p>}
   {loading?<p className="muted">Cargando movimientos…</p>:visible.length===0?<p className="muted">No hay movimientos para estos filtros.</p>:<div className="treasuryList">
    {visible.map(m=><article className="treasuryEntry" key={m.id}>
     <div><strong>{m.description}</strong><p className="muted small">{m.movement_date} · {categories[m.category]??m.category} · {methods[m.payment_method]??m.payment_method}</p>
      {m.reference&&<p className="muted small">Referencia: {m.reference}</p>}
      {m.reversal_of&&<p className="muted small">Anulación de un movimiento anterior</p>}
     </div>
     <div className="treasuryEntrySide"><strong className={m.kind==="ingreso"?"treasuryPositive":"treasuryNegative"}>{m.kind==="ingreso"?"+":"−"}{money(m.amount_cents)}</strong>
     {!m.reversal_of&&!reversedIds.has(m.id)&&<button type="button" className="treasuryCancel" disabled={busy} onClick={()=>void reverse(m)}>Anular</button>}
     {reversedIds.has(m.id)&&<span className="muted small">Anulado</span>}
     </div>
    </article>)}
   </div>}
  </section>
 </main>;
}

"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowser} from "@/lib/supabase/client";
type Asset={id:string;asset_code:string;title:string;category:string;condition:string;owner_type:string;assigned_to:string|null;purchase_date:string|null;purchase_price_cents:number|null;next_maintenance:string|null;notes:string;created_by:string;updated_at:string};
type Member={id:string;display_name:string};
const categories:Record<string,string>={corneta:"Cornetas",trompeta:"Trompetas",trombon:"Trombones",bombardino:"Bombardinos",tuba:"Tubas",percusion:"Percusión",uniforme:"Uniformes",accesorio:"Accesorios",otro:"Otros"};
const states:Record<string,string>={nuevo:"Nuevo",bueno:"Buen estado",revision:"Pendiente de revisión",reparacion:"En reparación",baja:"De baja"};
const owners:Record<string,string>={agrupacion:"Propiedad de la agrupación",cedido:"Cedido a la agrupación"};
const euros=(v:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(v/100);
const blank={asset_code:"",title:"",category:"trompeta",condition:"bueno",owner_type:"agrupacion",assigned_to:"",purchase_date:"",purchase_price:"",next_maintenance:"",notes:""};
type FormData=typeof blank;
function cents(value:string):number|null{const x=value.trim().replace(",",".");if(!x)return null;if(!/^\d+(?:\.\d{1,2})?$/.test(x))return NaN;const [major,minor=""]=x.split(".");const n=Number(major)*100+Number(minor.padEnd(2,"0"));return Number.isSafeInteger(n)&&n>=0?n:NaN;}
export default function Inventory({userId}:{userId:string}){
 const db=getSupabaseBrowser();
 const [assets,setAssets]=useState<Asset[]>([]);
 const [people,setPeople]=useState<Member[]>([]);
 const [form,setForm]=useState<FormData>({...blank});
 const [editing,setEditing]=useState<string|null>(null);
 const [filter,setFilter]=useState("");
 const [cat,setCat]=useState("todos");
 const [condition,setCondition]=useState("todos");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const person=(id:string|null)=>people.find(p=>p.id===id)?.display_name??"Sin asignar";
 async function reload(){
   setLoading(true);setError("");
   const [a,b]=await Promise.all([db.from("band_inventory").select("*").order("asset_code"),db.rpc("inventory_people")]);
   if(a.error)setError(a.error.message);else setAssets((a.data??[]) as Asset[]);
   if(b.error)setError(b.error.message);else setPeople((b.data??[]) as Member[]);
   setLoading(false);
 }
 useEffect(()=>{void reload();},[]);
 const shown=useMemo(()=>assets.filter(a=>(cat==="todos"||a.category===cat)&&(condition==="todos"||a.condition===condition)&&(a.title+" "+a.asset_code+" "+(people.find(p=>p.id===a.assigned_to)?.display_name??"")).toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))),[assets,cat,condition,filter,people]);
 const maintenance=assets.filter(a=>a.next_maintenance&&a.next_maintenance<=new Date().toISOString().slice(0,10)&&a.condition!=="baja").length;
 function update<K extends keyof FormData>(key:K,value:FormData[K]){setForm(old=>({...old,[key]:value}));}
 function beginEdit(a:Asset){setEditing(a.id);setForm({asset_code:a.asset_code,title:a.title,category:a.category,condition:a.condition,owner_type:a.owner_type,assigned_to:a.assigned_to??"",purchase_date:a.purchase_date??"",purchase_price:a.purchase_price_cents===null?"":String(a.purchase_price_cents/100),next_maintenance:a.next_maintenance??"",notes:a.notes});setError("");setMessage("");window.scrollTo({top:0,behavior:"smooth"});}
 function cancel(){setEditing(null);setForm({...blank});}
 async function save(e:React.FormEvent<HTMLFormElement>){
   e.preventDefault();if(busy)return;setError("");setMessage("");
   const price=cents(form.purchase_price);
   if(Number.isNaN(price)){setError("El importe debe ser un número válido de hasta dos decimales.");return;}
   if(!form.title.trim()||!form.asset_code.trim()){setError("Indica el código y el nombre del artículo.");return;}
   const payload={asset_code:form.asset_code.trim(),title:form.title.trim(),category:form.category,condition:form.condition,owner_type:form.owner_type,assigned_to:form.assigned_to||null,purchase_date:form.purchase_date||null,purchase_price_cents:price,next_maintenance:form.next_maintenance||null,notes:form.notes.trim()};
   if(!window.confirm((editing?"¿Guardar cambios en":"¿Añadir al inventario")+" «"+payload.title+"»?"))return;
   setBusy(true);
   const result=editing
     ?await db.from("band_inventory").update(payload).eq("id",editing)
     :await db.from("band_inventory").insert({...payload,created_by:userId});
   setBusy(false);
   if(result.error){setError(result.error.message);return;}
   setMessage(editing?"Artículo actualizado.":"Artículo añadido al inventario.");cancel();await reload();
 }
 return <main className="container">
   <Link href="/panel" className="backLink">← Volver al panel</Link>
   <header className="header"><span className="brandIcon">♬</span><div><small>DIRECTIVA · LA PASIÓN DE MAZARRÓN</small><h1>Inventario</h1></div></header>
   <p className="muted">Control privado de instrumentos, uniformes y material. Registra asignaciones y próximas revisiones.</p>
   <div className="inventoryStats"><div><strong>{assets.length}</strong><span>Artículos registrados</span></div><div><strong>{assets.filter(a=>a.assigned_to).length}</strong><span>Asignados</span></div><div><strong>{maintenance}</strong><span>Revisiones pendientes</span></div></div>
   <section className="inventoryCard"><h2>{editing?"Editar artículo":"Añadir material"}</h2>
     <form className="inventoryForm" onSubmit={e=>void save(e)}>
      <label>Código de inventario<input required maxLength={40} minLength={2} placeholder="Ej. TPT-001" value={form.asset_code} onChange={e=>update("asset_code",e.target.value)}/></label>
      <label>Nombre del material<input required minLength={3} maxLength={150} placeholder="Ej. Trompeta Yamaha" value={form.title} onChange={e=>update("title",e.target.value)}/></label>
      <label>Tipo<select value={form.category} onChange={e=>update("category",e.target.value)}>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Estado<select value={form.condition} onChange={e=>update("condition",e.target.value)}>{Object.entries(states).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Titularidad<select value={form.owner_type} onChange={e=>update("owner_type",e.target.value)}>{Object.entries(owners).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
      <label>Asignado a<select value={form.assigned_to} onChange={e=>update("assigned_to",e.target.value)}><option value="">Sin asignar</option>{people.map(p=><option value={p.id} key={p.id}>{p.display_name}</option>)}</select></label>
      <label>Fecha de compra<input type="date" value={form.purchase_date} onChange={e=>update("purchase_date",e.target.value)}/></label>
      <label>Precio de compra (€)<input inputMode="decimal" placeholder="Opcional" value={form.purchase_price} onChange={e=>update("purchase_price",e.target.value)}/></label>
      <label>Próximo mantenimiento<input type="date" value={form.next_maintenance} onChange={e=>update("next_maintenance",e.target.value)}/></label>
      <label className="inventoryWide">Observaciones<textarea rows={3} maxLength={1500} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Número de serie, reparación pendiente, accesorios…"/></label>
      <div className="inventoryActions"><button type="submit" className="primaryButton" disabled={busy}>{busy?"Guardando…":editing?"Guardar cambios":"Añadir artículo"}</button>{editing&&<button type="button" className="secondaryButton" onClick={cancel} disabled={busy}>Cancelar</button>}</div>
     </form>
   </section>
   <section className="inventoryCard"><h2>Material registrado</h2>
     <div className="inventoryFilters"><label>Buscar<input placeholder="Código, nombre o músico" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
      <label>Tipo<select value={cat} onChange={e=>setCat(e.target.value)}><option value="todos">Todos los tipos</option>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Estado<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="todos">Todos los estados</option>{Object.entries(states).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
     </div>
     {error&&<p className="formError" role="alert">{error}</p>}
     {message&&<p className="formSuccess" role="status">{message}</p>}
     {loading?<p className="muted">Cargando inventario…</p>:shown.length===0?<p className="muted">No hay artículos para estos filtros.</p>:<div className="inventoryList">{shown.map(a=><article className="inventoryItem" key={a.id}>
       <div><strong>{a.title}</strong><p className="muted small">{a.asset_code} · {categories[a.category]??a.category} · {states[a.condition]??a.condition}</p>
       <p className="muted small">{owners[a.owner_type]??a.owner_type} · {person(a.assigned_to)}</p>
       {a.purchase_price_cents!==null&&<p className="muted small">Compra: {euros(a.purchase_price_cents)}</p>}
       {a.next_maintenance&&<p className={a.next_maintenance<=new Date().toISOString().slice(0,10)?"inventoryWarning":"muted small"}>Revisión: {a.next_maintenance}</p>}
       {a.notes&&<p className="muted small">{a.notes}</p>}</div>
       <button className="secondaryButton" type="button" onClick={()=>beginEdit(a)}>Editar</button>
     </article>)}</div>}
   </section>
 </main>;
}

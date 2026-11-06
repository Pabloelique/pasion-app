import DemoApp from "../demo-app";
import {notFound} from "next/navigation";
export default async function DemoPage({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!["inicio","calendario","partituras","ensayos","repertorio","mi-asistencia","tablon","votaciones","notificaciones","afinador"].includes(section))notFound();
 return <DemoApp section={section}/>;
}

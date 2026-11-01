import type {Metadata} from "next";
export const metadata:Metadata={
 title:"Prueba PASIÓN APP · Sin registro",
 description:"Explora PASIÓN APP gratis, sin registro ni aprobación: calendario, partituras, repertorio, votaciones y avisos con datos de demostración.",
 openGraph:{title:"Prueba PASIÓN APP",description:"Entra sin registro ni aprobación y descubre la app por dentro. Demostración pública con obras musicales reales y actividad simulada.",url:"https://pasion-app.vercel.app/demo",type:"website",images:[{url:"https://pasion-app.vercel.app/icons/logo-192.png",width:192,height:192,alt:"PASIÓN APP"}]}
};
export default function DemoLayout({children}:{children:React.ReactNode}){return children;}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSwitcher from "./theme-switcher";

export const metadata: Metadata = {
  title: "PASIÓN APP | La Pasión de Mazarrón",
  description: "Gestión musical de la Agrupación La Pasión de Mazarrón",
  applicationName: "PASIÓN APP",
  manifest: "/manifest.webmanifest",
  icons: {icon:[{url:"/icons/logo-192.png",sizes:"192x192",type:"image/png"}],apple:[{url:"/icons/logo-192.png",sizes:"192x192",type:"image/png"}],shortcut:"/icons/logo-192.png"},
};

export const viewport: Viewport = {
  themeColor: "#143b2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"(function(){var t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';try{var s=localStorage.getItem('pasion-theme');if(s==='light'||s==='dark')t=s;}catch(e){}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.content=t==='light'?'#f4f7f2':'#143b2a';})();"}}/></head><body><ThemeSwitcher/>{children}</body></html>;
}

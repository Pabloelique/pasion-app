import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  return <html lang="es"><body>{children}</body></html>;
}

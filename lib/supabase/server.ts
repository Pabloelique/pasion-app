import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Falta configurar Supabase en las variables de entorno de Vercel.");
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(toSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* En Server Components no se pueden escribir cookies; se actualizan en las rutas Auth. */ }
      },
    },
  });
}

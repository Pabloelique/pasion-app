import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/panel", request.url));
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/acceso", request.url));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/acceso", request.url));
  const client = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(toSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
        toSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/acceso", request.url));
  return response;
}

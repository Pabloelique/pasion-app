"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Part = { id: number; name: string };
type Mode = "login" | "register";
const fallbackParts: Part[] = [];
export default function AccessPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [parts, setParts] = useState<Part[]>(fallbackParts);
  const [part, setPart] = useState("");
  const [requestedRole, setRequestedRole] = useState("musico");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadParts() {
      try {
        const { data, error } = await getSupabaseBrowser().from("musical_parts").select("id,name").order("id");
        if (error) throw error;
        if (active) setParts(data ?? []);
      } catch {
        if (active) setError("No se pueden cargar los hilos musicales. Comprueba la conexión con Supabase.");
      }
    }
    void loadParts();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      const client = getSupabaseBrowser();
      if (mode === "login") {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace("/panel");
        router.refresh();
      } else {
        if (!firstName.trim() || !lastName.trim() || !part) throw new Error("Completa el nombre, los apellidos y el hilo musical.");
        if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) throw new Error("Para este registro debes introducir una dirección de Gmail válida.");
        if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
          throw new Error("La contraseña necesita al menos 12 caracteres, letras y números.");
        const { error: signUpError } = await client.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/confirmacion",
            data: { first_name: firstName.trim(), last_name: lastName.trim(), musical_part_id: part, requested_role: requestedRole },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Solicitud enviada. Revisa Gmail para confirmar tu correo. Después deberá aprobarte la directiva; si solicitas directiva, solo el superadmin podrá hacerlo.");
        setPassword("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación.");
    } finally { setLoading(false); }
  }

  return <main className="authShell">
    <Link className="backLink" href="/">← Volver al inicio</Link>
    <section className="authCard">
      <div className="authHeading"><span className="brandIcon">♫</span><div><span className="eyebrow">LA PASIÓN DE MAZARRÓN</span><h1>PASIÓN APP</h1></div></div>
      <h2>{mode === "login" ? "Bienvenido de nuevo" : "Solicitar acceso"}</h2>
      <p className="muted">{mode === "login" ? "Entra con tu correo y contraseña." : "Tu cuenta quedará pendiente hasta que la apruebe la agrupación."}</p>
      <div className="switcher"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => {setMode("login");setError("");setMessage("");}}>Iniciar sesión</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => {setMode("register");setError("");setMessage("");}}>Registrarse</button></div>
      <form onSubmit={submit} className="authForm">
        {mode === "register" && <>
          <label>Nombre<input autoComplete="given-name" maxLength={80} required value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
          <label>Apellidos<input autoComplete="family-name" maxLength={100} required value={lastName} onChange={e => setLastName(e.target.value)} /></label>
          <label>Hilo musical<select required value={part} onChange={e => setPart(e.target.value)}><option value="">Selecciona tu hilo</option>{parts.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
          <label>Rol solicitado<select value={requestedRole} onChange={e => setRequestedRole(e.target.value)}><option value="musico">Músico</option><option value="directiva">Directiva (requiere aprobación del superadmin)</option></select></label>
        </>}
        <label>Correo electrónico (Gmail)<input type="email" autoComplete="email" placeholder="ejemplo@gmail.com" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 12 : undefined} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="formError">{error}</p>}
        {message && <p role="status" className="formSuccess">{message}</p>}
        <button className="primaryButton" type="submit" disabled={loading}>{loading ? "Procesando…" : mode === "login" ? "Entrar en PASIÓN APP" : "Solicitar registro"}</button>
      </form>
      <p className="muted helpText">El registro no concede permisos automáticamente. Los accesos se aprueban individualmente.</p>
    </section>
  </main>;
}

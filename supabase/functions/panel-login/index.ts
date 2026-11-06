// Ingreso al panel CIG verificado del lado del servidor.
// La página manda el perfil y el SHA-256 de la contraseña (igual que antes); acá se verifica
// y, si está bien, se entrega una sesión de Supabase. Sin esa sesión la base no entrega datos.
//
// Acciones:
//   { accion: "ingresar", clave, hash }
//   { accion: "cambiar", clave, hash, hashNuevo }
//
// La primera vez que un perfil ingresa sin contraseña guardada en el servidor, la que escribe
// queda registrada (mismo comportamiento que tenía el panel).
import { createClient } from "npm:@supabase/supabase-js@2";

const PERFILES: Record<string, { nombre: string; rol: string; area: string; canEdit: boolean; tecnico: boolean }> = {
  gonzalo: { nombre: "Gonzalo Monteros", rol: "Intendente", area: "Intendencia", canEdit: false, tecnico: false },
  estela: { nombre: "Estela Palacios", rol: "Directora", area: "Dirección", canEdit: true, tecnico: false },
  carlos: { nombre: "Carlos Chauvet", rol: "Área técnica", area: "Técnica", canEdit: true, tecnico: true },
  emmanuel: { nombre: "Emmanuel Aguilar", rol: "Agente de campo", area: "Agente de campo", canEdit: true, tecnico: true },
  andres: { nombre: "Andrés Ferrer", rol: "Área técnica", area: "Técnica", canEdit: true, tecnico: true },
  usuario: { nombre: "Usuario", rol: "Solo lectura", area: "Consulta", canEdit: false, tecnico: false },
};

const MAX_FALLOS = 8; // por perfil
const VENTANA_MIN = 15;
const ITERACIONES = 210000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors, "Content-Type": "application/json" } });

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const deHex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

async function derivar(secreto: string, sal: Uint8Array, iter: number) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256));
}
async function guardable(secreto: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERACIONES}$${hex(sal)}$${await derivar(secreto, sal, ITERACIONES)}`;
}
async function coincide(secreto: string, guardado: string) {
  const [, iter, sal, valor] = guardado.split("$");
  const calc = await derivar(secreto, deHex(sal), Number(iter));
  if (calc.length !== valor.length) return false;
  let d = 0;
  for (let i = 0; i < calc.length; i++) d |= calc.charCodeAt(i) ^ valor.charCodeAt(i);
  return d === 0;
}

const esHash = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const publico = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });

  let cuerpo: { accion?: string; clave?: string; hash?: string; hashNuevo?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "Pedido inválido." }, 400);
  }
  const { accion = "ingresar", clave = "", hash, hashNuevo } = cuerpo;
  const perfil = PERFILES[clave];
  if (!perfil) return responder({ error: "Usuario no habilitado." }, 403);
  if (!esHash(hash)) return responder({ error: "Ingresá la contraseña para continuar." }, 400);
  if (accion === "cambiar" && !esHash(hashNuevo)) return responder({ error: "Ingresá la contraseña nueva." }, 400);

  // Freno a intentos repetidos
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const { count: fallos } = await admin
    .from("panel_login_intentos")
    .select("id", { count: "exact", head: true })
    .eq("usuario_clave", clave)
    .eq("ok", false)
    .gte("created_at", desde);
  if ((fallos ?? 0) >= MAX_FALLOS) {
    return responder({ error: `Demasiados intentos. Probá de nuevo en ${VENTANA_MIN} minutos.` }, 429);
  }
  const anotar = (ok: boolean) => admin.from("panel_login_intentos").insert({ usuario_clave: clave, ok });

  // Fila del perfil (se crea si no existe)
  let { data: fila, error: errFila } = await admin
    .from("panel_usuarios")
    .select("id, activo, auth_user_id, password_pbkdf2")
    .eq("usuario_clave", clave)
    .maybeSingle();
  if (errFila) return responder({ error: "No se pudo validar el usuario." }, 500);
  if (!fila) {
    const { data: nueva, error } = await admin
      .from("panel_usuarios")
      .insert({ usuario_clave: clave, nombre: perfil.nombre, rol: perfil.rol, area: perfil.area, can_edit: perfil.canEdit, tecnico: perfil.tecnico })
      .select("id, activo, auth_user_id, password_pbkdf2")
      .single();
    if (error) return responder({ error: "No se pudo crear el usuario." }, 500);
    fila = nueva;
  }
  if (!fila.activo) return responder({ error: "Usuario no habilitado." }, 403);

  // Verificar o registrar la contraseña
  let registrada = false;
  if (!fila.password_pbkdf2) {
    await admin.from("panel_usuarios").update({ password_pbkdf2: await guardable(hash!), password_set_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", fila.id);
    registrada = true;
  } else if (!(await coincide(hash!, fila.password_pbkdf2))) {
    await anotar(false);
    return responder({ error: accion === "cambiar" ? "La contraseña actual es incorrecta." : "Contraseña incorrecta." }, 401);
  }

  if (accion === "cambiar") {
    await admin.from("panel_usuarios").update({ password_pbkdf2: await guardable(hashNuevo!), password_set_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", fila.id);
    await anotar(true);
    return responder({ ok: true });
  }

  // Cuenta interna de Supabase para este perfil (nadie la usa directamente)
  const email = `${clave}@cig-brs.local`;
  let authId = fila.auth_user_id as string | null;
  if (!authId) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: hex(crypto.getRandomValues(new Uint8Array(32))),
      app_metadata: { perfil: clave },
    });
    if (error && !/already/i.test(error.message)) return responder({ error: "No se pudo preparar la sesión." }, 500);
    authId = creado?.user?.id ?? null;
    if (!authId) {
      const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authId = lista?.users.find((u) => u.email === email)?.id ?? null;
    }
    if (!authId) return responder({ error: "No se pudo preparar la sesión." }, 500);
    await admin.from("panel_usuarios").update({ auth_user_id: authId }).eq("id", fila.id);
  }

  // Sesión: enlace de un solo uso generado y canjeado acá mismo (no se manda ningún mail)
  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (errEnlace || !enlace?.properties?.hashed_token) return responder({ error: "No se pudo iniciar la sesión." }, 500);
  const { data: sesion, error: errSesion } = await publico.auth.verifyOtp({ type: "magiclink", token_hash: enlace.properties.hashed_token });
  if (errSesion || !sesion.session) return responder({ error: "No se pudo iniciar la sesión." }, 500);

  await anotar(true);
  return responder({
    ok: true,
    registrada,
    access_token: sesion.session.access_token,
    refresh_token: sesion.session.refresh_token,
  });
});

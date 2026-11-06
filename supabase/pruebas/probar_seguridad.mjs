// Prueba del acceso seguro contra el entorno LOCAL de Supabase (npx supabase start).
// uso: node supabase/pruebas/probar_seguridad.mjs <API_URL> <ANON_KEY>
// Usa solo contraseñas de prueba inventadas y datos del seed local.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const [, , URL_API, ANON] = process.argv;
if (!URL_API || !ANON || !/127\.0\.0\.1|localhost/.test(URL_API)) {
  console.error("Solo se corre contra el entorno local.");
  process.exit(1);
}
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
let fallas = 0;
const ok = (cond, txt) => {
  console.log(`${cond ? "OK   " : "FALLA"} ${txt}`);
  if (!cond) fallas++;
};
const login = async (cuerpo) => {
  const r = await fetch(`${URL_API}/functions/v1/panel-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// 1. Sin sesión: nada se lee, nada se cambia
const anon = createClient(URL_API, ANON, { auth: { persistSession: false } });
const { data: e0 } = await anon.from("expedientes").select("id");
ok((e0 ?? []).length === 0, "sin sesión no se leen expedientes");
await anon.from("expedientes").delete().gte("id", 0);
const { data: c0 } = await anon.from("certificados_residencia").select("id");
ok((c0 ?? []).length === 0, "sin sesión no se leen constancias");
const { data: u0 } = await anon.from("panel_usuarios").select("*");
ok((u0 ?? []).length === 0, "sin sesión no se leen usuarios ni contraseñas");
const { error: up0 } = await anon.storage.from("planos-expedientes").upload("prueba/anon.txt", new Blob(["x"]), { contentType: "text/plain" });
ok(!!up0, "sin sesión no se suben archivos");
const { error: rpc0 } = await anon.rpc("panel_login_password", { p_usuario_clave: "estela", p_password_hash: sha("x") });
ok(!!rpc0, "la función vieja de ingreso ya no existe");

// 2. Primer ingreso de Estela: registra la contraseña de siempre
const H1 = sha("clave-de-prueba-1");
let r = await login({ clave: "estela", hash: H1 });
ok(r.status === 200 && r.data.registrada === true && !!r.data.access_token, "primer ingreso registra la contraseña");
r = await login({ clave: "estela", hash: H1 });
ok(r.status === 200 && r.data.registrada === false, "segundo ingreso con la misma contraseña funciona");
r = await login({ clave: "estela", hash: sha("otra") });
ok(r.status === 401, "contraseña equivocada es rechazada");

// 3. Con sesión: el panel funciona igual
const sesion = createClient(URL_API, ANON, { auth: { persistSession: false } });
const r2 = await login({ clave: "estela", hash: H1 });
await sesion.auth.setSession({ access_token: r2.data.access_token, refresh_token: r2.data.refresh_token });
const { data: e1 } = await sesion.from("expedientes").select("id");
ok((e1 ?? []).length >= 30, `con sesión se leen expedientes (${(e1 ?? []).length})`);
const { error: upd } = await sesion.from("expedientes").update({ notas: "editado en prueba" }).eq("id", 1);
ok(!upd, "con sesión se edita un expediente");
const { error: ins } = await sesion.from("panel_accesos").insert({ nombre: "Estela Palacios", rol: "Directora" });
ok(!ins, "con sesión se registra el acceso");
const { data: c1 } = await sesion.from("certificados_residencia").select("id");
ok((c1 ?? []).length === 5, "con sesión se leen constancias");
const { data: u1 } = await sesion.from("panel_usuarios").select("password_pbkdf2");
ok((u1 ?? []).length === 0, "ni con sesión se leen las contraseñas guardadas");
const ruta = `1/prueba-${Date.now()}.txt`;
const { error: up1 } = await sesion.storage.from("planos-expedientes").upload(ruta, new Blob(["plano de prueba"]), { contentType: "text/plain" });
ok(!up1, "con sesión se sube un archivo");
const pub = await fetch(`${URL_API}/storage/v1/object/public/planos-expedientes/${ruta}`);
ok(pub.status >= 400, `el enlace público ya no abre el archivo (${pub.status})`);
const { data: firmado } = await sesion.storage.from("planos-expedientes").createSignedUrl(ruta, 300);
const abierto = firmado ? await fetch(firmado.signedUrl) : null;
ok(abierto?.status === 200 && (await abierto.text()) === "plano de prueba", "el enlace temporal sí abre el archivo");
const { error: del } = await sesion.storage.from("planos-expedientes").remove([ruta]);
ok(!del, "con sesión se borra un archivo");

// 4. Cambiar contraseña
const H2 = sha("clave-de-prueba-2");
r = await login({ accion: "cambiar", clave: "estela", hash: sha("mala"), hashNuevo: H2 });
ok(r.status === 401, "cambiar con la contraseña actual equivocada es rechazado");
r = await login({ accion: "cambiar", clave: "estela", hash: H1, hashNuevo: H2 });
ok(r.status === 200, "cambiar con la contraseña actual correcta funciona");
ok((await login({ clave: "estela", hash: H2 })).status === 200, "entra con la contraseña nueva");
ok((await login({ clave: "estela", hash: H1 })).status === 401, "la vieja ya no sirve");

// 5. Perfil sin fila previa (intendente) y perfil inexistente
r = await login({ clave: "gonzalo", hash: sha("clave-intendente-prueba") });
ok(r.status === 200 && r.data.registrada === true, "el intendente registra su contraseña la primera vez");
ok((await login({ clave: "hacker", hash: H1 })).status === 403, "un perfil que no existe es rechazado");

// 6. Freno a intentos repetidos
for (let i = 0; i < 8; i++) await login({ clave: "carlos", hash: sha(`x${i}`) }).catch(() => {});
const primera = await login({ clave: "carlos", hash: sha("cualquiera") });
ok([200, 401, 429].includes(primera.status), "carlos: primer intento registra o rechaza");
for (let i = 0; i < 9; i++) await login({ clave: "carlos", hash: sha(`mal${i}`) });
ok((await login({ clave: "carlos", hash: sha("mal-final") })).status === 429, "después de muchos errores se frena por 15 minutos");

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : "\nTodo OK");
process.exit(fallas ? 1 : 0);

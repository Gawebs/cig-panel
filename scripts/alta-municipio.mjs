// Alta (o actualización) de un municipio o comuna: datos, logo, leyes, localidades, barrios y usuarios.
// Se puede correr de nuevo con el mismo archivo: actualiza lo que cambió y no duplica nada.
//
// Uso:
//   node scripts/alta-municipio.mjs supabase/municipios/<slug>.json --confirmar
//
// Lee la base de destino de las variables de entorno CIG_SUPABASE_URL y CIG_SERVICE_ROLE_KEY
// (si no están, usa NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local).
// Sin --confirmar solo muestra lo que haría.
//
// A cada usuario nuevo se le genera una contraseña provisoria que se guarda en credenciales/<slug>.txt
// (carpeta fuera de git). Hay que entregarla en mano y pedir que la cambien al entrar (menú "Mi cuenta").

import { randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const [archivo, ...banderas] = process.argv.slice(2)
const confirmar = banderas.includes('--confirmar')
if (!archivo || !existsSync(archivo)) {
  console.error('Uso: node scripts/alta-municipio.mjs supabase/municipios/<slug>.json [--confirmar]')
  process.exit(1)
}

const envLocal = existsSync('.env.local')
  ? Object.fromEntries(
      readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {}
const url = process.env.CIG_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL
const clave = process.env.CIG_SERVICE_ROLE_KEY ?? envLocal.SUPABASE_SERVICE_ROLE_KEY
if (!url || !clave) {
  console.error('Faltan CIG_SUPABASE_URL y CIG_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const m = JSON.parse(readFileSync(archivo, 'utf8'))
const ROLES = ['direccion', 'subdireccion', 'armado', 'relevamiento', 'consulta']
const errores = []
if (!/^[a-z0-9-]+$/.test(m.slug ?? '')) errores.push('slug: solo minúsculas, números y guiones')
if (!/^[A-Z0-9]{2,6}$/.test(m.sigla ?? '')) errores.push('sigla: de 2 a 6 mayúsculas o números (va en el número de expediente)')
if (!['municipio', 'comuna'].includes(m.tipo)) errores.push('tipo: "municipio" o "comuna"')
if (!m.leyes?.length) errores.push('leyes: al menos una')
for (const u of m.usuarios ?? []) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) errores.push(`usuario ${u.email}: correo inválido`)
  if (!u.roles?.length || u.roles.some((r) => !ROLES.includes(r))) errores.push(`usuario ${u.email}: roles válidos son ${ROLES.join(', ')}`)
}
if (m.logo && !existsSync(m.logo)) errores.push(`logo: no existe el archivo ${m.logo}`)
for (const p of m.perfiles_de_ingreso ?? []) {
  if (!/^[a-z0-9-]+$/.test(p.usuario_clave ?? '')) errores.push(`perfil ${p.nombre}: usuario_clave inválido`)
  if (!p.roles?.length || p.roles.some((r) => !ROLES.includes(r))) errores.push(`perfil ${p.nombre}: roles válidos son ${ROLES.join(', ')}`)
}
if (errores.length) {
  console.error('Revisá el archivo:\n- ' + errores.join('\n- '))
  process.exit(1)
}

console.log(`Base de destino: ${url}`)
console.log(`${m.tipo === 'comuna' ? 'Comuna' : 'Municipio'}: ${m.nombre} (${m.sigla}) · leyes: ${m.leyes.join(', ')}`)
console.log(`Localidades: ${(m.localidades ?? []).map((l) => `${l.nombre} (${l.barrios?.length ?? 0} barrios)`).join(', ') || 'ninguna'}`)
console.log(`Usuarios: ${(m.usuarios ?? []).map((u) => `${u.email} [${u.roles.join('+')}]`).join(', ') || 'ninguno'}`)
if (m.perfiles_de_ingreso?.length) {
  console.log(`Ingreso por nombre: ${m.perfiles_de_ingreso.map((p) => `${p.nombre} [${p.roles.join('+')}]`).join(', ')}`)
}
if (!confirmar) {
  console.log('\nNo se cambió nada. Para hacerlo, repetí el comando con --confirmar.')
  process.exit(0)
}

const db = createClient(url, clave, { auth: { persistSession: false } })
async function ok(promesa, que) {
  const { data, error } = await promesa
  if (error) throw new Error(`${que}: ${error.message}`)
  return data
}

// 1. Leyes (la configuración vive en supabase/marcos y se actualiza siempre)
for (const f of readdirSync('supabase/marcos').filter((x) => x.endsWith('.json'))) {
  const ley = JSON.parse(readFileSync(join('supabase/marcos', f), 'utf8'))
  await ok(db.from('legal_frameworks').upsert({ ...ley, updated_at: new Date().toISOString() }), `ley ${ley.id}`)
}

// 2. Municipio
const fila = await ok(
  db.from('municipalities').upsert({
    nombre: m.nombre, slug: m.slug, sigla: m.sigla, tipo: m.tipo, departamento: m.departamento ?? null,
    color_principal: m.color_principal ?? null, correo_catastro: m.correo_catastro || null,
    area_nombre: m.area_nombre ?? 'Dirección de Regularización Dominial y Hábitat',
    secretaria_nombre: m.secretaria_nombre ?? 'Secretaría de Gobierno',
    plazo_catastro_dias: m.plazo_catastro_dias ?? 10, plazo_catastro_tipo: m.plazo_catastro_tipo ?? 'habiles',
    informe_intendente: m.informe_intendente ?? false,
  }, { onConflict: 'slug' }).select('id').single(),
  'municipio',
)
const muni = fila.id

// 3. Logo (depósito público "logos")
if (m.logo) {
  const ruta = `${m.slug}/logo${extname(m.logo).toLowerCase()}`
  const tipo = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[extname(m.logo).toLowerCase()]
  await ok(db.storage.from('logos').upload(ruta, readFileSync(m.logo), { contentType: tipo, upsert: true }), 'logo')
  const { data } = db.storage.from('logos').getPublicUrl(ruta)
  await ok(db.from('municipalities').update({ logo_path: data.publicUrl }).eq('id', muni), 'logo en el municipio')
}

// 4. Leyes activadas
await ok(db.from('municipality_frameworks').upsert(m.leyes.map((framework_id) => ({ municipality_id: muni, framework_id, activo: true }))), 'leyes del municipio')

// 5. Localidades y barrios
for (const l of m.localidades ?? []) {
  const loc = await ok(db.from('localities').upsert({ municipality_id: muni, nombre: l.nombre }, { onConflict: 'municipality_id,nombre' }).select('id').single(), `localidad ${l.nombre}`)
  if (l.barrios?.length) {
    await ok(db.from('neighborhoods').upsert(
      l.barrios.map((nombre) => ({ municipality_id: muni, locality_id: loc.id, nombre })),
      { onConflict: 'municipality_id,nombre' },
    ), `barrios de ${l.nombre}`)
  }
}

// 6. Personas que entran eligiendo su nombre (contraseña en panel_usuarios, función panel-login)
if (m.perfiles_de_ingreso?.length) {
  await ok(db.from('login_profiles').upsert(m.perfiles_de_ingreso.map((p) => ({
    usuario_clave: p.usuario_clave, municipality_id: muni, nombre: p.nombre, rol_texto: p.rol_texto ?? '',
    roles: p.roles, orden: p.orden ?? 0, activo: p.activo ?? true,
  }))), 'perfiles de ingreso')
}

// 7. Usuarios con correo
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const provisoria = () => {
  // Cumple la regla de la base: 10+ caracteres con mayúsculas, minúsculas y números.
  const base = Array.from({ length: 10 }, () => LETRAS[randomInt(LETRAS.length)]).join('')
  return `${base}A${randomInt(10)}b`
}
const nuevas = []
const existentes = []
let pagina = 1
for (;;) {
  const { data } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 })
  existentes.push(...data.users)
  if (data.users.length < 1000) break
  pagina++
}
for (const u of m.usuarios ?? []) {
  const email = u.email.toLowerCase()
  let user = existentes.find((x) => x.email === email)
  if (!user) {
    const password = provisoria()
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`usuario ${email}: ${error.message}`)
    user = data.user
    nuevas.push(`${email}\t${password}`)
  }
  await ok(db.from('profiles').upsert({ id: user.id, nombre: u.nombre, email }), `perfil ${email}`)
  await ok(db.from('memberships').upsert({ user_id: user.id, municipality_id: muni, roles: u.roles }), `roles de ${email}`)
}

if (nuevas.length) {
  mkdirSync('credenciales', { recursive: true })
  const destino = join('credenciales', `${m.slug}.txt`)
  writeFileSync(destino, `Contraseñas provisorias de ${m.nombre} (${new Date().toLocaleString('es-AR')}).\nEntregar en mano y pedir que la cambien al entrar (menú "Mi cuenta"). Borrar este archivo después.\n\n${nuevas.join('\n')}\n`, { flag: 'a' })
  console.log(`\n${nuevas.length} usuario(s) nuevo(s). Contraseñas provisorias en ${destino} (no se muestran acá).`)
}
console.log(`\nListo: ${m.nombre} quedó configurado.`)

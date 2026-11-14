// Carga datos de prueba en la base LOCAL (supabase start).
// Se niega a correr contra cualquier base que no sea localhost.
//
// Uso: node scripts/semilla-local.mjs
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url ?? '')) {
  console.error(`Freno: la semilla solo corre contra la base local, no contra "${url}".`)
  process.exit(1)
}

const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLAVE_PRUEBA = env.SEMILLA_CLAVE_PRUEBA || 'prueba-local-2026'

async function ok(promise, que) {
  const { data, error } = await promise
  if (error) throw new Error(`${que}: ${error.message}`)
  return data
}

// 1. Leyes
const marcos = readdirSync('supabase/marcos').filter((f) => f.endsWith('.json'))
for (const archivo of marcos) {
  const m = JSON.parse(readFileSync(join('supabase/marcos', archivo), 'utf8'))
  await ok(db.from('legal_frameworks').upsert({ ...m, updated_at: new Date().toISOString() }), `ley ${m.id}`)
}
console.log(`Leyes cargadas: ${marcos.length}`)

// 2. Municipios de prueba (dos, para probar que no se ven entre sí)
const municipios = [
  { nombre: 'Municipalidad de Banda del Río Salí (PRUEBA)', slug: 'brs-prueba', sigla: 'BRS', tipo: 'municipio', departamento: 'Cruz Alta', color_principal: '#13a07a', logo_path: '/logo-municipio-prueba.png' },
  { nombre: 'Comuna de Prueba', slug: 'comuna-prueba', sigla: 'CPR', tipo: 'comuna', departamento: 'Leales', color_principal: '#1f5fae' },
]
const ids = {}
for (const m of municipios) {
  const fila = await ok(db.from('municipalities').upsert(m, { onConflict: 'slug' }).select('id').single(), `municipio ${m.slug}`)
  ids[m.slug] = fila.id
}

const brs = ids['brs-prueba']
const comuna = ids['comuna-prueba']

await ok(db.from('municipality_frameworks').upsert([
  { municipality_id: brs, framework_id: 'ley_pierri' },
  { municipality_id: brs, framework_id: 'ley_5670' },
  { municipality_id: brs, framework_id: 'ley_8162' },
  { municipality_id: comuna, framework_id: 'ley_pierri' },
]), 'leyes por municipio')

// 3. Localidades y algunos barrios de Banda del Río Salí
const localidades = await ok(db.from('localities').upsert([
  { municipality_id: brs, nombre: 'Banda del Río Salí' },
  { municipality_id: brs, nombre: 'Lastenia' },
], { onConflict: 'municipality_id,nombre' }).select('id,nombre'), 'localidades')
const idBrs = localidades.find((l) => l.nombre === 'Banda del Río Salí').id
await ok(db.from('neighborhoods').upsert(
  ['La Milagrosa', 'Presidente Menem', 'Centro', 'San Antonio', 'Los Pinos'].map((nombre) => ({ municipality_id: brs, locality_id: idBrs, nombre })),
  { onConflict: 'municipality_id,nombre' },
), 'barrios')

// 4. Usuarios de prueba (uno por rol) — correos ficticios @prueba.local
const usuarios = [
  { email: 'direccion@prueba.local', nombre: 'Dirección (prueba)', roles: ['direccion'], muni: brs },
  { email: 'subdireccion@prueba.local', nombre: 'Subdirección (prueba)', roles: ['subdireccion', 'armado'], muni: brs },
  { email: 'armado@prueba.local', nombre: 'Atención y armado (prueba)', roles: ['armado'], muni: brs },
  { email: 'relevamiento@prueba.local', nombre: 'Relevamiento (prueba)', roles: ['relevamiento'], muni: brs },
  { email: 'consulta@prueba.local', nombre: 'Consulta (prueba)', roles: ['consulta'], muni: brs },
  { email: 'comuna@prueba.local', nombre: 'Comuna de Prueba', roles: ['subdireccion', 'armado'], muni: comuna },
  { email: 'soporte@prueba.local', nombre: 'Soporte Nexaia (prueba)', roles: null, muni: null },
]

const { data: existentes } = await db.auth.admin.listUsers({ perPage: 200 })
for (const u of usuarios) {
  let user = existentes.users.find((x) => x.email === u.email)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: CLAVE_PRUEBA, email_confirm: true })
    if (error) throw new Error(`usuario ${u.email}: ${error.message}`)
    user = data.user
  }
  await ok(db.from('profiles').upsert({ id: user.id, nombre: u.nombre, email: u.email }), `perfil ${u.email}`)
  if (u.roles) {
    await ok(db.from('memberships').upsert({ user_id: user.id, municipality_id: u.muni, roles: u.roles }), `roles ${u.email}`)
  } else {
    await ok(db.from('platform_admins').upsert({ user_id: user.id }), `soporte ${u.email}`)
  }
}

console.log(`Usuarios de prueba: ${usuarios.length} (clave: la de SEMILLA_CLAVE_PRUEBA en .env.local)`)
console.log('Listo.')

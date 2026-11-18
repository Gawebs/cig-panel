// Pasa las constancias de tenencia precaria del panel anterior (cig-panel) al sistema nuevo,
// en la MISMA base: de public.certificados_residencia a tenure_certificates, y sus PDF del depósito
// "planos-expedientes" al depósito "constancias". No toca ni borra nada del panel anterior.
// Se puede correr de nuevo: lo que ya se pasó (por id_anterior y ruta del archivo) se saltea.
//
// Uso:
//   CIG_SUPABASE_URL=... CIG_SERVICE_ROLE_KEY=... node scripts/importar-constancias-panel-anterior.mjs <slug-municipio> [--confirmar]
// Sin --confirmar solo cuenta lo que haría.

import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'

const [slug, ...banderas] = process.argv.slice(2)
const confirmar = banderas.includes('--confirmar')
if (!slug) {
  console.error('Uso: node scripts/importar-constancias-panel-anterior.mjs <slug-municipio> [--confirmar]')
  process.exit(1)
}
const envLocal = existsSync('.env.local')
  ? Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  : {}
const url = process.env.CIG_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL
const clave = process.env.CIG_SERVICE_ROLE_KEY ?? envLocal.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, clave, { auth: { persistSession: false } })

async function ok(promesa, que) {
  const { data, error } = await promesa
  if (error) throw new Error(`${que}: ${error.message}`)
  return data
}

const ESTADOS = ['pendiente', 'notificado', 'visitado', 'listo', 'entregado']
const normalizar = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^barrio\s+/, '').replace(/\s+/g, ' ').trim()
const texto = (v) => {
  const t = (v ?? '').toString().trim()
  return t || null
}

console.log(`Base: ${url}`)
const muni = await ok(db.from('municipalities').select('id, nombre').eq('slug', slug).single(), `municipio ${slug}`)
const barrios = await ok(db.from('neighborhoods').select('id, nombre').eq('municipality_id', muni.id), 'barrios')
const viejas = await ok(db.from('certificados_residencia').select('*').order('numero'), 'constancias del panel anterior')
const archivos = await ok(db.from('certificado_residencia_archivos').select('*'), 'archivos del panel anterior')
const yaPasadas = await ok(db.from('tenure_certificates').select('id, id_anterior').eq('municipality_id', muni.id).not('id_anterior', 'is', null), 'constancias ya pasadas')
const mapa = new Map(yaPasadas.map((c) => [c.id_anterior, c.id]))

console.log(`${muni.nombre}: ${viejas.length} constancias y ${archivos.length} archivos en el panel anterior; ${mapa.size} ya pasadas.`)
if (!confirmar) {
  console.log('No se cambió nada. Para pasarlas, repetí el comando con --confirmar.')
  process.exit(0)
}

let nuevas = 0
const avisos = []
for (const v of viejas) {
  if (mapa.has(v.id)) continue
  const dni = (v.dni ?? '').replace(/\D/g, '')
  const dniValido = /^\d{7,8}$/.test(dni)
  const barrio = barrios.find((b) => normalizar(b.nombre) === normalizar(v.barrio))
  const observaciones = [texto(v.observaciones), !dniValido && texto(v.dni) ? `DNI como figuraba en el panel anterior: ${v.dni}` : null, texto(v.motivo) && v.motivo !== 'Constancia de tenencia precaria' ? `Motivo: ${v.motivo}` : null]
    .filter(Boolean).join('\n') || null
  const fila = await ok(db.from('tenure_certificates').insert({
    municipality_id: muni.id,
    numero: v.numero,
    estado: ESTADOS.includes(v.estado) ? v.estado : 'pendiente',
    vecino_nombre: texto(v.vecino_nombre) ?? '(sin nombre)',
    dni: dniValido ? dni : null,
    domicilio: texto(v.domicilio),
    neighborhood_id: barrio?.id ?? null,
    barrio: texto(v.barrio),
    telefono: texto(v.telefono),
    fecha_visita: v.fecha_visita ?? null,
    observaciones,
    presentado_ante: texto(v.presentado_ante),
    padron_catastral: texto(v.padron_catastral),
    matricula_catastral: texto(v.matricula_catastral),
    propietario_legal: texto(v.propietario_legal),
    agente_nombre: texto(v.agente_nombre),
    created_at: v.created_at ?? undefined,
    origen: 'panel_anterior',
    id_anterior: v.id,
  }).select('id, numero').single(), `constancia ${v.numero}`)
  if (fila.numero !== v.numero) avisos.push(`${v.numero} quedó como ${fila.numero}`)
  mapa.set(v.id, fila.id)
  nuevas++
}

let copiados = 0
for (const a of archivos) {
  const nueva = mapa.get(a.certificado_id)
  if (!nueva) { avisos.push(`archivo ${a.archivo_path}: su constancia no existe`); continue }
  const nombre = a.archivo_path.split('/').pop()
  const destino = `${muni.id}/${nueva}/${nombre}`
  const { data: existe } = await db.from('tenure_certificate_files').select('id').eq('storage_path', destino).maybeSingle()
  if (existe) continue
  const { data: blob, error } = await db.storage.from('planos-expedientes').download(a.archivo_path)
  if (error || !blob) { avisos.push(`no se pudo bajar ${a.archivo_path}: ${error?.message}`); continue }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let paginas = null
  try { paginas = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount() } catch {}
  const subida = await db.storage.from('constancias').upload(destino, bytes, { contentType: a.tipo_mime || 'application/pdf', upsert: false })
  if (subida.error && !/exists|duplicate/i.test(subida.error.message)) { avisos.push(`no se pudo subir ${destino}: ${subida.error.message}`); continue }
  await ok(db.from('tenure_certificate_files').insert({
    certificate_id: nueva, storage_path: destino, nombre_archivo: a.nombre_original ?? nombre,
    tamano_bytes: a.tamano_bytes ?? bytes.byteLength, paginas, created_at: a.created_at ?? undefined,
  }), `registro de ${destino}`)
  copiados++
}

console.log(`Listo: ${nuevas} constancias y ${copiados} archivos pasados.`)
if (avisos.length) console.log('Avisos:\n- ' + avisos.join('\n- '))

'use client'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { quitarDocumentoPorRuta } from '@/actions/documentos'
import { expedienteExiste, guardarRelevamiento } from '@/actions/relevamiento'
import { createClient } from '@/lib/supabase/client'
import { subirDocumento } from '@/lib/subida'
import {
  borrarArchivo, estaPendiente, leerArchivo, listarRelevamientos, marcarSincronizado,
  type ClaveFoto, type RelevamientoCampo,
} from './almacen'
import { observacionesDeCroquis } from './croquis-plantilla'

export const ORDEN_FOTOS: ClaveFoto[] = ['frente', 'contrafrente', 'interior1', 'interior2']

function tipoBase(tipo: string) {
  return tipo.split(';')[0] || 'audio/webm'
}

function extension(tipo: string) {
  const base = tipoBase(tipo)
  return base === 'audio/mp4' ? 'm4a' : base === 'audio/mpeg' ? 'mp3' : base.includes('wav') ? 'wav' : base.split('/')[1] ?? 'webm'
}

/** PDF de una hoja con las coordenadas tomadas en el lugar, en el formato que pide Catastro. */
export async function pdfCoordenadas(p: { numero: string; lat: number; lng: number; precision: number; fecha: string }): Promise<File> {
  const pdf = await PDFDocument.create()
  const hoja = pdf.addPage([595.28, 841.89])
  const fuente = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const texto = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
  hoja.drawText('Coordenadas geográficas del inmueble', { x: 60, y: 760, size: 16, font: negrita })
  hoja.drawText(`Expediente interno: ${p.numero}`, { x: 60, y: 730, size: 11, font: fuente })
  hoja.drawText(texto, { x: 60, y: 680, size: 22, font: negrita, color: rgb(0.1, 0.25, 0.5) })
  hoja.drawText(`Latitud ${p.lat.toFixed(6)}  ·  Longitud ${p.lng.toFixed(6)}`, { x: 60, y: 655, size: 11, font: fuente })
  const fecha = new Date(p.fecha).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
  hoja.drawText(`Tomadas en el lugar con GPS el ${fecha}, precisión ${Math.round(p.precision)} m.`, { x: 60, y: 630, size: 10, font: fuente, color: rgb(0.35, 0.35, 0.4) })
  const bytes = await pdf.save()
  return new File([bytes as BlobPart], 'coordenadas.pdf', { type: 'application/pdf' })
}

export interface ResultadoSincronizacion {
  ok: boolean
  mensaje: string
  /** El expediente ya no existe (se borró): lo del celular no se puede subir. */
  expedienteBorrado?: boolean
}

/** Sube un relevamiento: audios, fotos, croquis y coordenadas como PDF, y las respuestas a la ficha. */
export async function sincronizarRelevamiento(r: RelevamientoCampo, numero: string): Promise<ResultadoSincronizacion> {
  const inicio = Date.now()
  const supabase = createClient()
  const { data: sesion } = await supabase.auth.getSession()
  if (!sesion.session) return { ok: false, mensaje: 'La sesión venció. Volvé a ingresar con tu usuario para subir lo relevado.' }
  if (!(await expedienteExiste(r.expedienteId))) {
    return { ok: false, expedienteBorrado: true, mensaje: 'el expediente de este relevamiento ya no existe en el sistema (se borró).' }
  }

  const base = { expedienteId: r.expedienteId, municipioId: r.municipioId }
  const rutasAudio: Record<string, string> = {}
  const subidos = { ...r.subidos }

  // 1. Audios de la entrevista (constancia de lo que dijo el vecino)
  for (const [clave, resp] of Object.entries(r.respuestas)) {
    if (!resp.audioId || resp.audioRuta) continue
    const blob = await leerArchivo(resp.audioId)
    if (!blob) continue
    const ruta = `${r.municipioId}/${r.expedienteId}/audio-${clave.replace(/\./g, '-')}-${resp.audioId.slice(0, 8)}.${extension(blob.type)}`
    const { error } = await supabase.storage.from('audios').upload(ruta, blob, { contentType: tipoBase(blob.type) })
    if (error && !/exists|duplicate/i.test(error.message)) return { ok: false, mensaje: `No se pudo subir un audio: ${error.message}` }
    rutasAudio[clave] = ruta
  }

  // 2. Las 4 fotos en un PDF (una por hoja, en el orden que pide Catastro). Si se reemplazan, se quita el PDF anterior.
  const idsFotos = ORDEN_FOTOS.map((c) => r.fotos[c])
  const firmaFotos = idsFotos.join('|')
  if (idsFotos.every(Boolean) && subidos.fotos !== firmaFotos) {
    const paginas = await Promise.all(idsFotos.map(async (id, i) => {
      const blob = await leerArchivo(id!)
      return new File([blob!], `${ORDEN_FOTOS[i]}.jpg`, { type: blob!.type || 'image/jpeg' })
    }))
    const ruta = await subirDocumento({ ...base, paso: 2, requisito: 'fotos_inmueble', paginas })
    if (subidos.fotosRuta) await quitarDocumentoPorRuta(r.expedienteId, subidos.fotosRuta)
    subidos.fotos = firmaFotos
    subidos.fotosRuta = ruta
  }

  // 3. Croquis
  if (r.croquisId && subidos.croquis !== r.croquisId) {
    const blob = await leerArchivo(r.croquisId)
    if (blob) {
      const ruta = await subirDocumento({ ...base, paso: 2, requisito: 'croquis', paginas: [new File([blob], 'croquis.png', { type: 'image/png' })] })
      if (subidos.croquisRuta) await quitarDocumentoPorRuta(r.expedienteId, subidos.croquisRuta)
      subidos.croquis = r.croquisId
      subidos.croquisRuta = ruta
    }
  }

  // 4. Coordenadas
  if (r.gps) {
    const firma = `${r.gps.lat.toFixed(6)},${r.gps.lng.toFixed(6)}`
    if (subidos.coordenadas !== firma) {
      const pdf = await pdfCoordenadas({ numero, ...r.gps })
      const ruta = await subirDocumento({ ...base, paso: 2, requisito: 'coordenadas', paginas: [pdf] })
      if (subidos.coordenadasRuta) await quitarDocumentoPorRuta(r.expedienteId, subidos.coordenadasRuta)
      subidos.coordenadas = firma
      subidos.coordenadasRuta = ruta
    }
  }

  // 5. Respuestas y observaciones → ficha del expediente
  const respuestas = Object.fromEntries(
    Object.entries(r.respuestas).map(([clave, resp]) => [
      clave,
      { texto: resp.texto, origen: resp.origen, audio: rutasAudio[clave] ?? resp.audioRuta ?? null, revisado: resp.revisado },
    ]),
  )
  const res = await guardarRelevamiento({
    id: r.id, expedienteId: r.expedienteId, estado: r.estado, gps: r.gps, respuestas, observaciones: { ...r.observaciones, ...observacionesDeCroquis(r.croquisDatos) },
  })
  if (res.error) return { ok: false, mensaje: res.error }

  await marcarSincronizado(r.id, inicio, (actual) => ({
    ...actual,
    subidos: { ...actual.subidos, ...subidos },
    respuestas: Object.fromEntries(
      Object.entries(actual.respuestas).map(([c, resp]) => [c, rutasAudio[c] && resp.audioId === r.respuestas[c]?.audioId ? { ...resp, audioRuta: rutasAudio[c] } : resp]),
    ),
  }))

  // Terminado y todo arriba: se liberan los archivos del celular.
  if (r.estado === 'completo') {
    const todos = [...Object.values(r.respuestas).map((x) => x.audioId), ...idsFotos, r.croquisId].filter(Boolean) as string[]
    const pendientesAudio = Object.entries(r.respuestas).some(([c, x]) => x.audioId && !(rutasAudio[c] ?? x.audioRuta))
    if (!pendientesAudio) await Promise.all(todos.map(borrarArchivo))
  }
  return { ok: true, mensaje: 'Subido al expediente.' }
}

function esFaltaDeConexion(e: unknown) {
  const m = e instanceof Error ? e.message : String(e)
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m)
}

type ResultadoPendientes = { subidos: number; errores: string[]; sinConexion: boolean; borrados: string[] }
let enCurso: Promise<ResultadoPendientes> | null = null

/**
 * Sube todo lo pendiente. Se llama al volver la señal y con el botón "Subir ahora".
 * Una sola subida a la vez: si ya hay una en marcha, se espera esa (dos a la vez subían las fotos repetidas).
 */
export function sincronizarPendientes(numeros: Record<string, string>): Promise<ResultadoPendientes> {
  enCurso ??= subirPendientes(numeros).finally(() => { enCurso = null })
  return enCurso
}

async function subirPendientes(numeros: Record<string, string>): Promise<ResultadoPendientes> {
  const lista = (await listarRelevamientos()).filter(estaPendiente)
  const errores: string[] = []
  const borrados: string[] = []
  let subidos = 0
  for (const r of lista) {
    try {
      const res = await sincronizarRelevamiento(r, numeros[r.expedienteId] ?? '')
      if (res.ok) subidos++
      else if (res.expedienteBorrado) borrados.push(r.id)
      else errores.push(`${numeros[r.expedienteId] ?? 'Expediente'}: ${res.mensaje}`)
    } catch (e) {
      // Sin conexión no es un error: queda guardado y se sube en el próximo intento.
      if (esFaltaDeConexion(e)) return { subidos, errores, sinConexion: true, borrados }
      errores.push(`${numeros[r.expedienteId] ?? 'Expediente'}: ${e instanceof Error ? e.message : 'error al subir'}`)
    }
  }
  return { subidos, errores, sinConexion: false, borrados }
}

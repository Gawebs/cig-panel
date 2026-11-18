'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { tieneFirmaDigital } from '@/lib/firma'

z.config(z.locales.es())

type Respuesta = { error?: string; ok?: string }

const uuid = z.string().uuid()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')

function revalidar(id: string) {
  revalidatePath(`/expedientes/${id}`)
  revalidatePath('/')
  revalidatePath('/tablero')
}

/** Mensaje de la base sin el prefijo técnico. */
function limpio(mensaje: string) {
  return mensaje.replace(/^.*?ERROR:\s*/, '')
}

/**
 * Registra el PDF firmado por la Dirección para un paso. El archivo ya está subido;
 * acá se controla que de verdad tenga firma digital y reemplaza al firmado anterior de ese paso.
 */
export async function registrarFirmado(expedienteId: string, paso: number, ruta: string, tamano: number): Promise<Respuesta> {
  await obtenerContexto()
  if (!uuid.safeParse(expedienteId).success || ![1, 2, 3, 4].includes(paso)) return { error: 'Datos inválidos.' }
  const supabase = await createClient()
  const { data: exp } = await supabase.from('case_files').select('municipality_id').eq('id', expedienteId).maybeSingle()
  if (!exp) return { error: 'Expediente inexistente o sin acceso.' }
  if (!ruta.startsWith(`${exp.municipality_id}/${expedienteId}/firmado-`)) return { error: 'El archivo no corresponde a este expediente.' }

  const { data: archivo, error: errBajar } = await supabase.storage.from('expedientes').download(ruta)
  if (errBajar || !archivo) return { error: 'No se pudo leer el archivo subido.' }
  if (!tieneFirmaDigital(new Uint8Array(await archivo.arrayBuffer()))) {
    await supabase.storage.from('expedientes').remove([ruta])
    return { error: 'Ese PDF no tiene firma digital. Subí el archivo que guardó la herramienta de firma, no el original.' }
  }

  const { data: anteriores } = await supabase
    .from('case_documents')
    .select('id, storage_path')
    .eq('case_file_id', expedienteId)
    .eq('requisito', 'pdf_firmado')
    .eq('paso', paso)

  const { error } = await supabase.from('case_documents').insert({
    case_file_id: expedienteId, paso, requisito: 'pdf_firmado', storage_path: ruta, nombre_archivo: ruta.split('/').pop(),
    tamano_bytes: tamano, firmado: true, origen: 'firmado',
  })
  if (error) {
    await supabase.storage.from('expedientes').remove([ruta])
    return { error: `No se pudo registrar: ${error.message}` }
  }
  for (const a of anteriores ?? []) {
    await supabase.from('case_documents').delete().eq('id', a.id)
    if (a.storage_path) await supabase.storage.from('expedientes').remove([a.storage_path])
  }
  revalidar(expedienteId)
  return { ok: `PDF firmado del paso ${paso} guardado.` }
}

export async function presentarEnCatastro(expedienteId: string, _prev: Respuesta | undefined, formData: FormData): Promise<Respuesta> {
  await obtenerContexto()
  const datos = z.object({ numero: z.string().trim().max(40), fecha }).safeParse(Object.fromEntries(formData))
  if (!datos.success || !uuid.safeParse(expedienteId).success) return { error: datos.error?.issues[0].message ?? 'Datos inválidos.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_presentacion', { p_case: expedienteId, p_numero: datos.data.numero, p_fecha: datos.data.fecha })
  if (error) return { error: limpio(error.message) }
  revalidar(expedienteId)
  return { ok: 'Quedó registrado como presentado en Catastro.' }
}

export async function registrarObservacion(expedienteId: string, _prev: Respuesta | undefined, formData: FormData): Promise<Respuesta> {
  await obtenerContexto()
  const datos = z.object({ fecha, texto: z.string().trim().min(3, 'Escribí qué observó Catastro.').max(4000) }).safeParse(Object.fromEntries(formData))
  if (!datos.success || !uuid.safeParse(expedienteId).success) return { error: datos.error?.issues[0].message ?? 'Datos inválidos.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_observacion', { p_case: expedienteId, p_recibida: datos.data.fecha, p_texto: datos.data.texto })
  if (error) return { error: limpio(error.message) }
  revalidar(expedienteId)
  return { ok: 'Observación registrada. El plazo ya corre.' }
}

export async function registrarProrroga(expedienteId: string, _prev: Respuesta | undefined, formData: FormData): Promise<Respuesta> {
  await obtenerContexto()
  const datos = z.object({ hasta: fecha.or(z.literal('')), nota: z.string().trim().max(1000) }).safeParse(Object.fromEntries(formData))
  if (!datos.success || !uuid.safeParse(expedienteId).success) return { error: 'Datos inválidos.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_prorroga', { p_case: expedienteId, p_hasta: datos.data.hasta || null, p_nota: datos.data.nota || null })
  if (error) return { error: limpio(error.message) }
  revalidar(expedienteId)
  return { ok: 'Prórroga registrada.' }
}

export async function registrarReingreso(expedienteId: string, _prev: Respuesta | undefined, formData: FormData): Promise<Respuesta> {
  await obtenerContexto()
  const datos = z.object({ fecha, nota: z.string().trim().max(1000) }).safeParse(Object.fromEntries(formData))
  if (!datos.success || !uuid.safeParse(expedienteId).success) return { error: 'Datos inválidos.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_reingreso', { p_case: expedienteId, p_fecha: datos.data.fecha, p_nota: datos.data.nota || null })
  if (error) return { error: limpio(error.message) }
  revalidar(expedienteId)
  return { ok: 'Reingreso registrado.' }
}

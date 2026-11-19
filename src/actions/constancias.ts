'use server'

import { textoError } from '@/lib/errores'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'

z.config(z.locales.es())

export type RespuestaConstancia = { error?: string; ok?: string; valores?: Record<string, string> } | undefined

const opcional = (max = 160) => z.string().trim().max(max).optional().transform((v) => v || null)

const esquema = z.object({
  vecino_nombre: z.string().trim().min(2, 'Falta el nombre del vecino.').max(160),
  dni: opcional(8).refine((v) => !v || /^\d{7,8}$/.test(v), 'El DNI tiene que tener 7 u 8 números, sin puntos.'),
  domicilio: opcional(),
  neighborhood_id: z.string().uuid().or(z.literal('')).optional().transform((v) => v || null),
  telefono: opcional(30),
  estado: z.enum(['pendiente', 'notificado', 'visitado', 'listo', 'entregado']).default('pendiente'),
  fecha_visita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().transform((v) => v || null),
  presentado_ante: opcional(),
  padron_catastral: opcional(40),
  matricula_catastral: opcional(40),
  propietario_legal: opcional(),
  agente_nombre: opcional(),
  observaciones: opcional(2000),
})

function conValores(formData: FormData, error: string): RespuestaConstancia {
  const valores: Record<string, string> = {}
  formData.forEach((v, k) => { if (typeof v === 'string' && !k.startsWith('$ACTION')) valores[k] = v })
  return { error, valores }
}

/** El nombre del barrio se guarda también como texto, para la constancia impresa. */
async function conBarrio(supabase: Awaited<ReturnType<typeof createClient>>, datos: z.output<typeof esquema>) {
  if (!datos.neighborhood_id) return { ...datos, barrio: null }
  const { data } = await supabase.from('neighborhoods').select('nombre').eq('id', datos.neighborhood_id).maybeSingle()
  return { ...datos, barrio: data?.nombre ?? null }
}

export async function crearConstancia(_prev: RespuestaConstancia, formData: FormData): Promise<RespuestaConstancia> {
  const ctx = await obtenerContexto()
  if (!ctx.municipio || !tieneRol(ctx, 'armado', 'relevamiento', 'subdireccion', 'direccion')) return conValores(formData, 'Tu usuario no puede cargar constancias.')
  const v = esquema.safeParse(Object.fromEntries(formData))
  if (!v.success) return conValores(formData, v.error.issues[0].message)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenure_certificates')
    .insert({ ...(await conBarrio(supabase, v.data)), municipality_id: ctx.municipio.id, numero: 'auto' })
    .select('id')
    .single()
  if (error) return conValores(formData, `No se pudo guardar: ${textoError(error)}`)
  revalidatePath('/constancias')
  redirect(`/constancias/${data.id}`)
}

export async function guardarConstancia(id: string, _prev: RespuestaConstancia, formData: FormData): Promise<RespuestaConstancia> {
  await obtenerContexto()
  const v = esquema.safeParse(Object.fromEntries(formData))
  if (!v.success) return conValores(formData, v.error.issues[0].message)
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenure_certificates').update(await conBarrio(supabase, v.data)).eq('id', id).select('id')
  if (error) return conValores(formData, `No se pudo guardar: ${textoError(error)}`)
  if (!data?.length) return conValores(formData, 'Tu usuario no puede cambiar esta constancia.')
  revalidatePath('/constancias')
  revalidatePath(`/constancias/${id}`)
  return { ok: 'Guardado.' }
}

export async function registrarArchivoConstancia(id: string, archivo: { ruta: string; nombre: string; tamano: number; paginas: number }): Promise<{ error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: c } = await supabase.from('tenure_certificates').select('municipality_id').eq('id', id).maybeSingle()
  if (!c || !archivo.ruta.startsWith(`${c.municipality_id}/${id}/`)) return { error: 'El archivo no corresponde a esta constancia.' }
  const { error } = await supabase.from('tenure_certificate_files').insert({
    certificate_id: id, storage_path: archivo.ruta, nombre_archivo: archivo.nombre.slice(0, 160), tamano_bytes: archivo.tamano, paginas: archivo.paginas,
  })
  if (error) {
    await supabase.storage.from('constancias').remove([archivo.ruta])
    return { error: `No se pudo registrar: ${textoError(error)}` }
  }
  revalidatePath(`/constancias/${id}`)
  return {}
}

export async function quitarArchivoConstancia(id: string, archivoId: string): Promise<{ error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data } = await supabase.from('tenure_certificate_files').delete().eq('id', archivoId).eq('certificate_id', id).select('storage_path')
  if (!data?.length) return { error: 'No se pudo quitar.' }
  await supabase.storage.from('constancias').remove([data[0].storage_path])
  revalidatePath(`/constancias/${id}`)
  return {}
}

export async function enlaceArchivoConstancia(id: string, archivoId: string): Promise<{ url?: string; error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data } = await supabase.from('tenure_certificate_files').select('storage_path').eq('id', archivoId).eq('certificate_id', id).maybeSingle()
  if (!data) return { error: 'No existe.' }
  const { data: firmado } = await supabase.storage.from('constancias').createSignedUrl(data.storage_path, 300)
  return firmado ? { url: firmado.signedUrl } : { error: 'No se pudo abrir.' }
}

export async function borrarConstancia(id: string): Promise<{ error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: archivos } = await supabase.from('tenure_certificate_files').select('storage_path').eq('certificate_id', id)
  const { data, error } = await supabase.from('tenure_certificates').delete().eq('id', id).select('id')
  if (error || !data?.length) return { error: 'Solo la Dirección o la Subdirección pueden borrar una constancia, y no si ya se entregó.' }
  if (archivos?.length) await supabase.storage.from('constancias').remove(archivos.map((a) => a.storage_path))
  revalidatePath('/constancias')
  redirect('/constancias')
}

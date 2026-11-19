'use server'

import { textoError } from '@/lib/errores'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'expedientes'

const esquemaDocumento = z.object({
  paso: z.number().int().min(1).max(4),
  requisito: z.string().regex(/^[a-z_]+$/),
  person_id: z.string().uuid().nullable(),
  anio: z.number().int().min(1950).max(2100).nullable(),
  tipo_prueba: z.string().max(40).nullable(),
  storage_path: z.string().max(300),
  nombre_archivo: z.string().max(160),
  tamano_bytes: z.number().int().nonnegative(),
  paginas: z.number().int().positive(),
  origen: z.enum(['archivo', 'escaneo', 'formulario']),
})

export type NuevoDocumento = z.input<typeof esquemaDocumento>

/** Registra un archivo ya subido al depósito privado contra un requisito del expediente. */
export async function registrarDocumento(expedienteId: string, doc: NuevoDocumento): Promise<{ error?: string }> {
  await obtenerContexto()
  const datos = esquemaDocumento.safeParse(doc)
  if (!datos.success) return { error: 'Los datos del documento no son válidos.' }

  const supabase = await createClient()
  const { data: exp } = await supabase.from('case_files').select('municipality_id').eq('id', expedienteId).maybeSingle()
  if (!exp) return { error: 'Expediente inexistente o sin acceso.' }

  // El archivo tiene que estar en la carpeta de este expediente.
  if (!datos.data.storage_path.startsWith(`${exp.municipality_id}/${expedienteId}/`)) {
    return { error: 'El archivo no corresponde a este expediente.' }
  }

  const { error } = await supabase.from('case_documents').insert({ ...datos.data, case_file_id: expedienteId })
  if (error) {
    await supabase.storage.from(BUCKET).remove([datos.data.storage_path])
    return { error: `No se pudo registrar el documento: ${textoError(error)}` }
  }
  revalidatePath(`/expedientes/${expedienteId}`)
  return {}
}

export async function quitarDocumento(expedienteId: string, documentoId: string): Promise<{ error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('case_documents')
    .select('storage_path')
    .eq('id', documentoId)
    .eq('case_file_id', expedienteId)
    .maybeSingle()
  if (!doc) return { error: 'El documento no existe.' }

  const { data: borrado, error } = await supabase.from('case_documents').delete().eq('id', documentoId).select('id')
  if (error || !borrado?.length) return { error: 'No se puede quitar: el expediente ya no se edita o el documento está firmado.' }
  if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
  revalidatePath(`/expedientes/${expedienteId}`)
  return {}
}

/** Quita un documento por su ruta (la usa el relevamiento cuando se reemplazan las fotos, el croquis o las coordenadas). */
export async function quitarDocumentoPorRuta(expedienteId: string, ruta: string): Promise<{ error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('case_documents')
    .select('id')
    .eq('case_file_id', expedienteId)
    .eq('storage_path', ruta)
    .maybeSingle()
  if (!doc) return {}
  return quitarDocumento(expedienteId, doc.id)
}

/** Enlaces temporales de varios documentos del expediente, en el orden pedido. */
export async function enlacesDocumentos(expedienteId: string, ids: string[]): Promise<{ urls?: string[]; error?: string }> {
  await obtenerContexto()
  if (ids.length === 0) return { urls: [] }
  const supabase = await createClient()
  const { data: docs } = await supabase
    .from('case_documents')
    .select('id, storage_path')
    .eq('case_file_id', expedienteId)
    .in('id', ids)
  const rutas = ids.map((id) => docs?.find((d) => d.id === id)?.storage_path).filter(Boolean) as string[]
  if (rutas.length !== ids.length) return { error: 'Algún documento ya no existe. Recargá la página.' }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 300)
  if (error || !data) return { error: 'No se pudieron abrir los documentos.' }
  if (data.some((d) => !d.signedUrl)) return { error: 'No se pudieron abrir los documentos.' }
  return { urls: data.map((d) => d.signedUrl as string) }
}

/** Enlace temporal (5 minutos) para ver un documento. */
export async function enlaceDocumento(expedienteId: string, documentoId: string): Promise<{ url?: string; error?: string }> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('case_documents')
    .select('storage_path')
    .eq('id', documentoId)
    .eq('case_file_id', expedienteId)
    .maybeSingle()
  if (!doc?.storage_path) return { error: 'El documento no existe.' }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300)
  if (error || !data) return { error: 'No se pudo abrir el documento.' }
  return { url: data.signedUrl }
}

'use client'

import { textoError } from '@/lib/errores'
import { registrarDocumento } from '@/actions/documentos'
import { unirEnPdf } from '@/lib/escaneo'
import { createClient } from '@/lib/supabase/client'

/** Une las páginas en un PDF, lo sube al depósito privado y lo registra contra el requisito. Devuelve la ruta. */
export async function subirDocumento(p: {
  expedienteId: string
  municipioId: string
  paso: number
  requisito: string
  personaId?: string | null
  anio?: number | null
  tipoPrueba?: string | null
  paginas: File[]
}): Promise<string> {
  const { bytes, paginas } = await unirEnPdf(p.paginas)
  const nombre = `${p.requisito}${p.anio ? `-${p.anio}` : ''}-${crypto.randomUUID().slice(0, 8)}.pdf`
  const ruta = `${p.municipioId}/${p.expedienteId}/${nombre}`
  const supabase = createClient()
  const { error } = await supabase.storage
    .from('expedientes')
    .upload(ruta, new Blob([bytes as BlobPart], { type: 'application/pdf' }), { contentType: 'application/pdf' })
  if (error) throw new Error(`No se pudo subir: ${textoError(error)}`)

  const resultado = await registrarDocumento(p.expedienteId, {
    paso: p.paso,
    requisito: p.requisito,
    person_id: p.personaId ?? null,
    anio: p.anio ?? null,
    tipo_prueba: p.tipoPrueba ?? null,
    storage_path: ruta,
    nombre_archivo: nombre,
    tamano_bytes: bytes.byteLength,
    paginas,
    origen: p.paginas.every((f) => f.type.startsWith('image/')) ? 'escaneo' : 'archivo',
  })
  if (resultado.error) throw new Error(resultado.error)
  return ruta
}

'use server'

import { textoError } from '@/lib/errores'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerContexto } from '@/lib/sesion'
import { planDeAplicacion, type PersonaFicha, type RespuestaGuardada } from '@/lib/relevamiento/aplicar'
import { preguntaPorClave } from '@/lib/relevamiento/cuestionario'

z.config(z.locales.es())

type Supabase = Awaited<ReturnType<typeof createClient>>

const esquemaRespuesta = z.object({
  texto: z.string().max(2000),
  origen: z.enum(['voz', 'mano']),
  audio: z.string().max(300).nullable().optional(),
  revisado: z.boolean().optional(),
})

const esquemaRelevamiento = z.object({
  id: z.string().uuid(),
  expedienteId: z.string().uuid(),
  estado: z.enum(['en_curso', 'completo']),
  gps: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), precision: z.number().nonnegative(), fecha: z.string().datetime() })
    .nullable(),
  respuestas: z.record(z.string().regex(/^[a-z0-9_.]+$/).max(60), esquemaRespuesta),
  observaciones: z.record(z.string().regex(/^[a-z_]+$/).max(40), z.union([z.string().max(1000), z.array(z.string().max(40)).max(20)])),
})

export type RelevamientoParaGuardar = z.input<typeof esquemaRelevamiento>

/**
 * Antes de subir lo relevado: ¿el expediente sigue existiendo (y este usuario lo ve)?
 * Si se borró (por ejemplo, uno de prueba), lo que quedó en el celular no se puede subir.
 */
export async function expedienteExiste(expedienteId: string): Promise<boolean> {
  await obtenerContexto()
  if (!z.string().uuid().safeParse(expedienteId).success) return false
  const supabase = await createClient()
  const { data } = await supabase.from('case_files').select('id').eq('id', expedienteId).maybeSingle()
  return Boolean(data)
}

/**
 * Lo que llega del celular. Se combina con lo que ya hay en la base: si en la oficina ya
 * confirmaron o transcribieron una respuesta, no se pierde por una sincronización vieja.
 */
export async function guardarRelevamiento(datos: RelevamientoParaGuardar): Promise<{ error?: string; ok?: string }> {
  const ctx = await obtenerContexto()
  const v = esquemaRelevamiento.safeParse(datos)
  if (!v.success) return { error: `Datos del relevamiento inválidos: ${v.error.issues[0].message}` }
  const d = v.data
  for (const clave of Object.keys(d.respuestas)) {
    if (!preguntaPorClave(clave)) return { error: `Pregunta desconocida: ${clave}` }
  }

  const supabase = await createClient()
  const { data: previo } = await supabase
    .from('field_surveys')
    .select('id, case_file_id, respuestas, relevador')
    .eq('case_file_id', d.expedienteId)
    .maybeSingle()
  // Un relevamiento por expediente. Si ya hay uno con otro número pero es de la misma persona
  // (por ejemplo, se empezó dos veces en el celular), lo del celular se guarda en ese mismo.
  // Si es de otra persona, no se pisa.
  if (previo && previo.id !== d.id && previo.relevador !== ctx.userId) {
    return { error: 'Este expediente ya tiene un relevamiento cargado por otra persona. Avisá en la oficina.' }
  }
  const idGuardado = previo?.id ?? d.id

  const anteriores = (previo?.respuestas ?? {}) as Record<string, RespuestaGuardada>
  const respuestas: Record<string, RespuestaGuardada> = {}
  for (const [clave, r] of Object.entries(d.respuestas)) {
    const antes = anteriores[clave]
    const ganaOficina = antes && ((antes.revisado && !r.revisado) || (!r.texto && antes.texto))
    respuestas[clave] = ganaOficina ? antes : { ...r, audio: r.audio ?? antes?.audio ?? null, aplicado: antes?.aplicado }
  }
  // Lo que ya estaba y el celular no mandó, queda.
  for (const [clave, r] of Object.entries(anteriores)) respuestas[clave] ??= r

  const fila = {
    id: idGuardado,
    case_file_id: d.expedienteId,
    estado: d.estado,
    gps_lat: d.gps?.lat ?? null,
    gps_lng: d.gps?.lng ?? null,
    gps_precision_m: d.gps?.precision ?? null,
    gps_fecha: d.gps?.fecha ?? null,
    respuestas,
    observaciones: d.observaciones,
  }
  const { error } = previo
    ? await supabase.from('field_surveys').update(fila).eq('id', idGuardado).select('id').single()
    : await supabase.from('field_surveys').insert(fila).select('id').single()
  if (error) return { error: `No se pudo guardar el relevamiento: ${textoError(error)} (${previo ? 'actualizar' : 'crear'}, código ${error.code ?? '?'})` }

  const aviso = await aplicarRelevamiento(supabase, idGuardado)
  revalidatePath(`/expedientes/${d.expedienteId}`)
  return aviso ? { error: aviso } : { ok: 'Relevamiento guardado en el expediente.' }
}

/** Respuesta editada, confirmada o transcrita en la oficina. */
export async function guardarRespuesta(
  relevamientoId: string,
  clave: string,
  cambio: { texto: string; origen: 'voz' | 'mano'; revisado: boolean },
): Promise<{ error?: string }> {
  await obtenerContexto()
  const v = esquemaRespuesta.safeParse(cambio)
  if (!v.success || !preguntaPorClave(clave) || !z.string().uuid().safeParse(relevamientoId).success) {
    return { error: 'Respuesta inválida.' }
  }
  const supabase = await createClient()
  const { data: rel } = await supabase.from('field_surveys').select('case_file_id, respuestas').eq('id', relevamientoId).maybeSingle()
  if (!rel) return { error: 'El relevamiento no existe o no tenés acceso.' }
  const respuestas = rel.respuestas as Record<string, RespuestaGuardada>
  respuestas[clave] = { ...respuestas[clave], ...v.data }
  const { data, error } = await supabase.from('field_surveys').update({ respuestas }).eq('id', relevamientoId).select('id')
  if (error || !data?.length) return { error: 'El expediente ya no se puede editar en este estado.' }
  const aviso = await aplicarRelevamiento(supabase, relevamientoId)
  revalidatePath(`/expedientes/${rel.case_file_id}`)
  return aviso ? { error: aviso } : {}
}

/** Lleva las respuestas a la ficha (personas y expediente) según las reglas de `planDeAplicacion`. */
async function aplicarRelevamiento(supabase: Supabase, relevamientoId: string): Promise<string | null> {
  const { data: rel } = await supabase
    .from('field_surveys')
    .select('case_file_id, respuestas, gps_lat, gps_lng')
    .eq('id', relevamientoId)
    .single()
  if (!rel) return 'No se encontró el relevamiento.'
  const expId = rel.case_file_id as string

  const [{ data: exp }, { data: personas }] = await Promise.all([
    supabase
      .from('case_files')
      .select('fecha_inicio_posesion, origen_posesion, origen_posesion_detalle, tiene_documentacion_ipvdu, coordenadas')
      .eq('id', expId)
      .single(),
    supabase
      .from('case_people')
      .select('id, rol, solicitante_numero, apellido, nombre, ocupacion, telefono, vinculo, edad_declarada, origen_datos')
      .eq('case_file_id', expId),
  ])
  if (!exp) return 'No se encontró el expediente.'
  const lista = (personas ?? []) as (PersonaFicha & { solicitante_numero: number })[]
  const titular = lista.find((p) => p.rol === 'solicitante' && p.solicitante_numero === 1) ?? null

  const plan = planDeAplicacion({ respuestas: rel.respuestas as Record<string, RespuestaGuardada>, expediente: exp, titular, personas: lista })
  const errores: string[] = []

  const cambiosExp: Record<string, unknown> = { ...plan.expediente }
  // Coordenadas del GPS: solo si el expediente todavía no tiene.
  if (!exp.coordenadas && rel.gps_lat !== null && rel.gps_lng !== null) {
    cambiosExp.coordenadas = `${Number(rel.gps_lat).toFixed(6)},${Number(rel.gps_lng).toFixed(6)}`
  }
  if (Object.keys(cambiosExp).length) {
    const { error } = await supabase.from('case_files').update(cambiosExp).eq('id', expId)
    if (error) errores.push(textoError(error))
  }
  if (titular && Object.keys(plan.titular).length) {
    const { error } = await supabase.from('case_people').update(plan.titular).eq('id', titular.id)
    if (error) errores.push(textoError(error))
  }
  for (const f of plan.familiaresNuevos) {
    const { error } = await supabase.from('case_people').insert({ ...f, case_file_id: expId, rol: 'grupo_familiar', solicitante_numero: 1 })
    if (error) errores.push(textoError(error))
  }
  for (const f of plan.familiaresCambios) {
    const { error } = await supabase.from('case_people').update(f.cambios).eq('id', f.id).eq('case_file_id', expId)
    if (error) errores.push(textoError(error))
  }
  await supabase.from('field_surveys').update({ respuestas: plan.respuestas }).eq('id', relevamientoId)

  return errores.length ? `Algunos datos no se pasaron a la ficha: ${errores[0]}` : null
}

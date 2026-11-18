'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerContexto, tieneRol } from '@/lib/sesion'

z.config(z.locales.es())

export type Resultado = { error?: string; ok?: string; id?: string; valores?: Record<string, string> } | undefined

/** Devuelve lo que se escribió, para que el formulario no se vacíe cuando hay un error. */
function conValores(formData: FormData, error: string): Resultado {
  const valores: Record<string, string> = {}
  formData.forEach((v, k) => { if (typeof v === 'string' && !k.startsWith('$ACTION')) valores[k] = v })
  return { error, valores }
}

const texto = (max = 120) => z.string().trim().max(max)
// Campo que la pantalla puede no mandar: si no viene, no se toca (undefined no se envía a la base);
// si viene vacío, se guarda como null.
const opcional = (max = 120) =>
  z.string().trim().max(max).optional().transform((v) => (v === undefined ? undefined : v === '' ? null : v))

const esquemaApertura = z.object({
  ley: z.enum(['ley_pierri', 'ley_5670', 'ley_8162']),
  apellido: texto().min(1, 'Falta el apellido del titular.'),
  nombre: texto(),
  dni: opcional(8).refine((v) => !v || /^\d{7,8}$/.test(v), 'El DNI tiene que tener 7 u 8 números, sin puntos.'),
  estado_civil: z.enum(['', 'soltero', 'casado', 'viudo', 'divorciado', 'conviviente']),
  padron: opcional(20),
  padron_confirmacion: opcional(20),
  // CUIL y domicilio: se completan solos al escanear el DNI, o a mano
  cuil: opcional(13)
    .transform((v) => (v && /^\d{11}$/.test(v) ? `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}` : v))
    .refine((v) => !v || /^\d{2}-\d{7,8}-\d$/.test(v), 'El CUIL va con guiones: 20-12345678-3.'),
  telefono: opcional(30),
  ciudad: opcional(80),
  sexo: z.enum(['', 'F', 'M', 'X']).optional(),
  fecha_nacimiento: opcional(10).refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha de nacimiento inválida.'),
  domicilio: opcional(160),
  origen_datos: z.string().optional(),
})

export async function abrirExpediente(_prev: Resultado, formData: FormData): Promise<Resultado> {
  const ctx = await obtenerContexto()
  if (!ctx.municipio || !tieneRol(ctx, 'armado', 'subdireccion', 'direccion')) {
    return conValores(formData, 'Tu usuario no puede abrir expedientes.')
  }

  const datos = esquemaApertura.safeParse(Object.fromEntries(formData))
  if (!datos.success) return conValores(formData, datos.error.issues[0].message)
  const d = datos.data

  // Catastro no deja corregir el padrón después de presentado: se confirma dos veces.
  if (d.padron && d.padron !== d.padron_confirmacion) {
    return conValores(formData, 'Los dos padrones no coinciden. Revisalos: Catastro no deja corregirlo después.')
  }

  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc('abrir_expediente', {
    p_municipality: ctx.municipio.id,
    p_framework: d.ley,
    p_padron: d.padron ?? '',
    p_titular: {
      apellido: d.apellido, nombre: d.nombre, dni: d.dni ?? '', estado_civil: d.estado_civil,
      cuil: d.cuil ?? '', sexo: d.sexo ?? '', fecha_nacimiento: d.fecha_nacimiento ?? '', domicilio: d.domicilio ?? '',
      origen_datos: (() => { try { return JSON.parse(d.origen_datos || '{}') } catch { return {} } })(),
    },
  })
  if (error) return conValores(formData, `No se pudo abrir el expediente: ${error.message}`)

  const { data: titular } = await supabase
    .from('case_people')
    .select('id')
    .eq('case_file_id', id)
    .eq('rol', 'solicitante')
    .eq('solicitante_numero', 1)
    .single()

  // Teléfono y ciudad no los recibe abrir_expediente: se guardan aparte en el titular.
  if (titular?.id && (d.telefono || d.ciudad)) {
    await supabase.from('case_people').update({ telefono: d.telefono ?? null, ciudad: d.ciudad ?? null }).eq('id', titular.id)
  }

  revalidatePath('/')
  // La pantalla sube las fotos del DNI (si hay) y después navega a la ficha.
  return { ok: 'Expediente abierto.', id: `${id}|${titular?.id ?? ''}|${ctx.municipio.id}` }
}

const esquemaPersona = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  rol: z.enum(['solicitante', 'conyuge', 'grupo_familiar']),
  solicitante_numero: z.coerce.number().int().min(1).max(10),
  apellido: texto().min(1, 'Falta el apellido.'),
  nombre: texto(),
  dni: opcional(8).refine((v) => !v || /^\d{7,8}$/.test(v), 'El DNI tiene que tener 7 u 8 números, sin puntos.'),
  cuil: opcional(13).refine((v) => !v || /^\d{2}-\d{7,8}-\d$/.test(v), 'El CUIL va con guiones: 20-12345678-3.'),
  telefono: opcional(30),
  domicilio: opcional(160),
  ciudad: opcional(80),
  estado_civil: z.enum(['', 'soltero', 'casado', 'viudo', 'divorciado', 'conviviente']).optional().transform((v) => (v === undefined ? undefined : v || null)),
  vinculo: opcional(40),
  ocupacion: opcional(60),
  sexo: z.enum(['', 'F', 'M', 'X']).optional().transform((v) => (v === undefined ? undefined : v || null)),
  fecha_nacimiento: opcional(10).refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha de nacimiento inválida.'),
  origen_datos: z.string().optional().transform((v) => {
    try {
      return v ? (JSON.parse(v) as Record<string, string>) : undefined
    } catch {
      return undefined
    }
  }),
})

export async function guardarPersona(expedienteId: string, _prev: Resultado, formData: FormData): Promise<Resultado> {
  await obtenerContexto()
  const datos = esquemaPersona.safeParse(Object.fromEntries(formData))
  if (!datos.success) return conValores(formData, datos.error.issues[0].message)
  const { id, origen_datos, ...campos } = datos.data

  const supabase = await createClient()

  // El mismo DNI no puede estar dos veces en el expediente; en otro expediente, se avisa.
  let avisoDuplicado = ''
  if (campos.dni) {
    const { data: repetido } = await supabase
      .from('case_people')
      .select('id, apellido')
      .eq('case_file_id', expedienteId)
      .eq('dni', campos.dni)
      .neq('id', id || '00000000-0000-0000-0000-000000000000')
      .limit(1)
    if (repetido?.length) {
      return conValores(formData, `El DNI ${campos.dni} ya está cargado en este expediente (${repetido[0].apellido}).`)
    }
    const { data: exp } = await supabase.from('case_files').select('municipality_id').eq('id', expedienteId).single()
    const { data: otros } = await supabase.rpc('buscar_duplicados', {
      p_municipality: exp!.municipality_id, p_padron: '', p_dni: campos.dni, p_excluir: expedienteId,
    })
    if (otros?.length) {
      avisoDuplicado = ` Ojo: este DNI también figura en ${otros.map((o: { numero_interno: string }) => o.numero_interno).join(', ')}.`
    }
  }

  // De dónde salió cada dato (DNI, CUIL calculado, voz, a mano): se suma a lo que ya había.
  let fila: typeof campos & { origen_datos?: Record<string, string> } = campos
  if (origen_datos && Object.keys(origen_datos).length) {
    const previo = id
      ? ((await supabase.from('case_people').select('origen_datos').eq('id', id).maybeSingle()).data?.origen_datos as Record<string, string> | undefined)
      : undefined
    fila = { ...campos, origen_datos: { ...(previo ?? {}), ...origen_datos } }
  }
  const consulta = id
    ? supabase.from('case_people').update(fila).eq('id', id).eq('case_file_id', expedienteId).select('id')
    : supabase.from('case_people').insert({ ...fila, case_file_id: expedienteId }).select('id')
  const { data, error } = await consulta
  if (error) return conValores(formData, `No se pudo guardar: ${error.message}`)
  if (!data?.length) return conValores(formData, 'No se pudo guardar: el expediente ya no se puede editar o no tenés permiso.')

  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: `Guardado. Los datos se actualizan en todos los formularios del expediente.${avisoDuplicado}`, id: data[0].id }
}

export async function quitarPersona(expedienteId: string, personaId: string) {
  await obtenerContexto()
  const supabase = await createClient()
  await supabase.from('case_people').delete().eq('id', personaId).eq('case_file_id', expedienteId)
  revalidatePath(`/expedientes/${expedienteId}`)
}

export async function cambiarEstado(expedienteId: string, estado: string, _prev: Resultado, formData: FormData): Promise<Resultado> {
  await obtenerContexto()
  const nota = String(formData.get('nota') ?? '').trim()
  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_estado', { p_case: expedienteId, p_estado: estado, p_nota: nota || null })
  if (error) return { error: error.message }
  revalidatePath(`/expedientes/${expedienteId}`)
  revalidatePath('/')
  return { ok: 'Listo.' }
}

const esquemaInmueble = z.object({
  domicilio_inmueble: opcional(160),
  neighborhood_id: z.string().uuid().or(z.literal('')).transform((v) => v || null),
  locality_id: z.string().uuid().or(z.literal('')).optional().transform((v) => v || null),
  manzana: opcional(20),
  lote: opcional(20),
  coordenadas: opcional(60).refine(
    (v) => !v || /^-?\d{1,2}\.\d+,\s?-?\d{1,3}\.\d+$/.test(v),
    'Las coordenadas van como las da Google Maps: -26.832206,-65.195481',
  ),
  notas: opcional(2000),
})

export async function guardarInmueble(expedienteId: string, _prev: Resultado, formData: FormData): Promise<Resultado> {
  await obtenerContexto()
  const datos = esquemaInmueble.safeParse(Object.fromEntries(formData))
  if (!datos.success) return conValores(formData, datos.error.issues[0].message)
  const supabase = await createClient()
  const cambios = { ...datos.data }
  // Sin localidad elegida: la del barrio; si el municipio tiene una sola, esa.
  if (!cambios.locality_id) {
    if (cambios.neighborhood_id) {
      const { data: barrio } = await supabase.from('neighborhoods').select('locality_id').eq('id', cambios.neighborhood_id).maybeSingle()
      cambios.locality_id = barrio?.locality_id ?? null
    }
    if (!cambios.locality_id) {
      const { data: exp } = await supabase.from('case_files').select('municipality_id').eq('id', expedienteId).maybeSingle()
      const { data: locs } = exp ? await supabase.from('localities').select('id').eq('municipality_id', exp.municipality_id) : { data: [] }
      if (locs?.length === 1) cambios.locality_id = locs[0].id
    }
  }
  const { data, error } = await supabase.from('case_files').update(cambios).eq('id', expedienteId).select('id')
  if (error) return conValores(formData, `No se pudo guardar: ${error.message}`)
  if (!data?.length) return conValores(formData, 'El expediente ya no se puede editar en este estado.')
  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: 'Guardado.' }
}

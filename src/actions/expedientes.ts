'use server'

import { textoError } from '@/lib/errores'
import { completarBarrioDeLaLey } from '@/lib/barrio-ley'
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

/** Datos catastrales que vienen en el formulario (los que no vienen no se tocan; vacío = se borra). */
function catastralesDelFormulario(formData: FormData, previos: Record<string, string> = {}): Record<string, string> {
  const salida = { ...previos }
  for (const k of CLAVES_CATASTRALES) {
    if (!formData.has(k)) continue
    const v = String(formData.get(k) ?? '').trim().slice(0, 60)
    if (v) salida[k] = v
    else delete salida[k]
  }
  return salida
}

/** Inmueble y posesión cargados en la pantalla de apertura (los que no vienen no se tocan). */
function inmuebleDelFormulario(formData: FormData): { error?: string; campos: Record<string, string | boolean | null> } {
  const campos: Record<string, string | boolean | null> = {}
  const f = (k: string) => (formData.has(k) ? String(formData.get(k) ?? '').trim() : undefined)
  const domicilio = f('domicilio_inmueble')
  if (domicilio !== undefined) campos.domicilio_inmueble = domicilio.slice(0, 160) || null
  const origen = f('origen_posesion')
  if (origen !== undefined) {
    if (origen && origen !== 'compra' && origen !== 'otro') return { error: 'Elegí cómo empezó la posesión.', campos }
    campos.origen_posesion = origen || null
    campos.origen_posesion_detalle = origen === 'otro' ? (f('origen_posesion_detalle') ?? '').slice(0, 200) || null : null
  }
  // En la apertura se pide solo el año: se guarda como 1 de enero y los formularios imprimen solo el año.
  const anio = f('anio_inicio_posesion')
  if (anio !== undefined) {
    if (anio && (!/^\d{4}$/.test(anio) || Number(anio) < 1900 || Number(anio) > new Date().getFullYear())) {
      return { error: 'El año de inicio de la posesión no es válido (ej.: 2005).', campos }
    }
    campos.fecha_inicio_posesion = anio ? `${anio}-01-01` : null
  }
  const fecha = f('fecha_inicio_posesion')
  if (fecha !== undefined) {
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'La fecha de inicio de la posesión no es válida.', campos }
    campos.fecha_inicio_posesion = fecha || null
  }
  const localidad = f('locality_id')
  if (localidad !== undefined) {
    if (localidad && !/^[0-9a-f-]{36}$/i.test(localidad)) return { error: 'Elegí la localidad de la lista.', campos }
    campos.locality_id = localidad || null
  }
  const ipvdu = f('tiene_documentacion_ipvdu')
  if (ipvdu !== undefined) campos.tiene_documentacion_ipvdu = ipvdu === 'true' ? true : ipvdu === 'false' ? false : null
  return { campos }
}

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
  correo: opcional(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'El correo no es válido: revisalo (ejemplo: nombre@gmail.com).'),
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
  const inmueble = inmuebleDelFormulario(formData)
  if (inmueble.error) return conValores(formData, inmueble.error)

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
  if (error) return conValores(formData, `No se pudo abrir el expediente: ${textoError(error)}`)

  const { data: titular } = await supabase
    .from('case_people')
    .select('id')
    .eq('case_file_id', id)
    .eq('rol', 'solicitante')
    .eq('solicitante_numero', 1)
    .single()

  // Teléfono, correo y ciudad no los recibe abrir_expediente: se guardan aparte en el titular.
  if (titular?.id && (d.telefono || d.ciudad || d.correo)) {
    await supabase.from('case_people').update({ telefono: d.telefono ?? null, ciudad: d.ciudad ?? null, correo: d.correo ?? null }).eq('id', titular.id)
  }

  // Datos catastrales pegados o escritos al abrir (circunscripción, sección, manzana, parcela, matrícula...).
  const catastrales = catastralesDelFormulario(formData)
  if (Object.keys(catastrales).length || Object.keys(inmueble.campos).length) {
    await supabase.from('case_files').update({ ...inmueble.campos, ...(Object.keys(catastrales).length ? { datos_catastrales: catastrales } : {}) }).eq('id', id)
  }

  // La Milagrosa y Menem son de un solo barrio: se pone solo, con su localidad.
  await completarBarrioDeLaLey(supabase, { id, framework_id: d.ley, municipality_id: ctx.municipio.id, neighborhood_id: null, locality_id: null })

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
  correo: opcional(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'El correo no es válido: revisalo (ejemplo: nombre@gmail.com).'),
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

/**
 * Corrige lo cargado al abrir el expediente (titular y padrón), desde la misma pantalla de apertura.
 * La ley no se cambia acá: define formularios y documentos ya generados.
 */
export async function corregirDatosIniciales(expedienteId: string, titularId: string, _prev: Resultado, formData: FormData): Promise<Resultado> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data: exp } = await supabase.from('case_files').select('padron, datos_catastrales').eq('id', expedienteId).maybeSingle()
  if (!exp) return conValores(formData, 'No se encontró el expediente.')

  const inmueble = inmuebleDelFormulario(formData)
  if (inmueble.error) return conValores(formData, inmueble.error)
  const padron = String(formData.get('padron') ?? '').replace(/\s/g, '')
  if (padron && !/^\d{1,12}$/.test(padron)) return conValores(formData, 'El padrón va solo con números, sin puntos ni espacios.')
  // Catastro no deja corregir el padrón después de presentado: si cambia, se confirma dos veces.
  if (padron !== (exp.padron ?? '') && padron !== String(formData.get('padron_confirmacion') ?? '').replace(/\s/g, '')) {
    return conValores(formData, 'Cambiaste el padrón: repetilo en el segundo casillero, los dos tienen que coincidir.')
  }

  // El titular se guarda con las mismas reglas que en Personas (DNI repetido, CUIL, correo, de dónde salió cada dato).
  const persona = new FormData()
  for (const k of ['apellido', 'nombre', 'dni', 'estado_civil', 'cuil', 'telefono', 'correo', 'domicilio', 'ciudad', 'sexo', 'fecha_nacimiento', 'origen_datos']) {
    const v = formData.get(k)
    if (typeof v === 'string') persona.set(k, v)
  }
  const cuil = String(persona.get('cuil') ?? '').trim()
  if (/^\d{11}$/.test(cuil)) persona.set('cuil', `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`)
  persona.set('id', titularId)
  persona.set('rol', 'solicitante')
  persona.set('solicitante_numero', '1')
  const r = await guardarPersona(expedienteId, undefined, persona)
  if (r?.error) return conValores(formData, r.error)

  {
    const datos_catastrales = catastralesDelFormulario(formData, (exp.datos_catastrales ?? {}) as Record<string, string>)
    const { data, error } = await supabase.from('case_files').update({ padron: padron || null, datos_catastrales, ...inmueble.campos }).eq('id', expedienteId).select('id')
    if (error) return conValores(formData, `No se pudo guardar el padrón: ${textoError(error)}`)
    if (!data?.length) return conValores(formData, 'El expediente ya no se puede editar en este estado.')
  }

  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: 'Datos corregidos.', id: `${expedienteId}|${titularId}` }
}

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
  if (error) return conValores(formData, `No se pudo guardar: ${textoError(error)}`)
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
  if (error) return { error: textoError(error) }
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
  if (error) return conValores(formData, `No se pudo guardar: ${textoError(error)}`)
  if (!data?.length) return conValores(formData, 'El expediente ya no se puede editar en este estado.')
  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: 'Guardado.' }
}

// Datos que se copian de Catastro: padrón (con doble confirmación) y datos catastrales del inmueble.
const CLAVES_CATASTRALES = ['circ', 'secc', 'mzna', 'parcela', 'matricula', 'orden', 'antecedente_dominio', 'libro', 'folio', 'serie', 'anio_dominio'] as const

export async function guardarDatosCatastro(expedienteId: string, _prev: Resultado, formData: FormData): Promise<Resultado> {
  await obtenerContexto()
  const f = (k: string) => String(formData.get(k) ?? '').trim()
  const padron = f('padron').replace(/\s/g, '')
  const padron2 = f('padron_2').replace(/\s/g, '')
  if (padron && !/^\d{1,12}$/.test(padron)) return conValores(formData, 'El padrón va solo con números, sin puntos ni espacios.')
  if (padron2 && !/^\d{1,12}$/.test(padron2)) return conValores(formData, 'El segundo padrón va solo con números, sin puntos ni espacios.')

  const supabase = await createClient()
  const { data: exp } = await supabase.from('case_files').select('municipality_id, padron, datos_catastrales').eq('id', expedienteId).maybeSingle()
  if (!exp) return conValores(formData, 'No se encontró el expediente.')
  // Catastro no deja corregir el padrón después de presentado: si cambia, se confirma dos veces.
  if (padron !== (exp.padron ?? '') && padron !== f('padron_confirmacion').replace(/\s/g, '')) {
    return conValores(formData, 'Repetí el padrón en el segundo casillero: los dos tienen que coincidir.')
  }
  const catastrales = { ...((exp.datos_catastrales ?? {}) as Record<string, string>) }
  for (const k of CLAVES_CATASTRALES) {
    if (!formData.has(k)) continue
    const v = f(k).slice(0, 60)
    if (v) catastrales[k] = v
    else delete catastrales[k]
  }
  const { data, error } = await supabase
    .from('case_files')
    .update({ padron: padron || null, padron_2: padron2 || null, datos_catastrales: catastrales })
    .eq('id', expedienteId)
    .select('id')
  if (error) return conValores(formData, `No se pudo guardar: ${textoError(error)}`)
  if (!data?.length) return conValores(formData, 'El expediente ya no se puede editar en este estado.')

  let aviso = ''
  if (padron) {
    const { data: otros } = await supabase.rpc('buscar_duplicados', { p_municipality: exp.municipality_id, p_padron: padron, p_dni: '', p_excluir: expedienteId })
    if (otros?.length) aviso = ` Ojo: el padrón ${padron} también figura en ${otros.map((o: { numero_interno: string }) => o.numero_interno).join(', ')}.`
  }
  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: `Guardado.${aviso}` }
}

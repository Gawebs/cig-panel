'use server'

import { revalidatePath } from 'next/cache'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { CAMPOS_CATASTRALES, familiaresDe, personaDeSlot, plantillaDe, type FichaPersona, type Slot } from '@/lib/formularios/plantillas'
import { observacionesEfectivas, type Observaciones } from '@/lib/relevamiento/observaciones'

const ESTADOS_CIVILES = ['soltero', 'casado', 'viudo', 'divorciado', 'conviviente']
const SOLO_LECTURA = new Set(['padron', 'localidad'])

function aIso(fecha: string): string | null | 'invalida' {
  const t = fecha.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 'invalida'
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Separa "Apellido Nombre" respetando el apellido que ya estaba cargado. */
function separarNombre(texto: string, apellidoPrevio?: string): { apellido: string; nombre: string } {
  const t = texto.trim().replace(/\s+/g, ' ')
  if (t.includes(',')) {
    const [a, ...n] = t.split(',')
    return { apellido: a.trim(), nombre: n.join(',').trim() }
  }
  if (apellidoPrevio && t.toLowerCase().startsWith(apellidoPrevio.toLowerCase() + ' ')) {
    return { apellido: t.slice(0, apellidoPrevio.length), nombre: t.slice(apellidoPrevio.length).trim() }
  }
  const [a, ...n] = t.split(' ')
  return { apellido: a, nombre: n.join(' ') }
}

/**
 * Guarda lo que se corrigió a mano sobre un formulario. Cada casillero escribe en la ficha
 * (persona o expediente), así el cambio aparece en todos los demás formularios.
 */
export async function guardarFormulario(
  expedienteId: string,
  formulario: string,
  cambios: Record<string, string>,
): Promise<{ error?: string; ok?: string }> {
  await obtenerContexto()
  const supabase = await createClient()

  const { data: exp } = await supabase
    .from('case_files')
    .select('framework_id, datos_catastrales, valores_formularios')
    .eq('id', expedienteId)
    .maybeSingle()
  if (!exp) return { error: 'Expediente inexistente o sin acceso.' }
  const plantilla = plantillaDe(exp.framework_id, formulario)
  if (!plantilla) return { error: 'Formulario desconocido.' }

  const { data: personasDb } = await supabase.from('case_people').select('*').eq('case_file_id', expedienteId)
  const personas = (personasDb ?? []) as FichaPersona[]

  const cambiosExp: Record<string, unknown> = {}
  const catastrales = { ...(exp.datos_catastrales as Record<string, string>) }
  const valoresForm = { ...(exp.valores_formularios as Record<string, Record<string, string>>) }
  const cambiosPersona = new Map<Slot, Record<string, string | null>>()
  const cambiosFamiliar = new Map<string, Record<string, string | number | null>>()

  // Lo del relevamiento en el lugar (casillas y observaciones) se guarda en el relevamiento.
  const { data: relevamiento } = await supabase.from('field_surveys').select('id, observaciones, respuestas').eq('case_file_id', expedienteId).maybeSingle()
  let observaciones: Observaciones | null = relevamiento
    ? observacionesEfectivas({ observaciones: relevamiento.observaciones as Observaciones, respuestas: relevamiento.respuestas as Record<string, { texto: string }> })
    : null
  let tocaRelevamiento = false

  for (const [id, valorCrudo] of Object.entries(cambios)) {
    const valor = valorCrudo.trim()
    const casilla = plantilla.casillas.find((c) => c.id === id)
    if (casilla) {
      const fc = casilla.fuente
      if (casilla.valor === '*') continue // se marca sola según el texto de al lado
      if (fc.tipo === 'expediente') {
        // Las casillas de sí/no (IPVDU) guardan un valor verdadero o falso.
        if (valor) cambiosExp[fc.campo] = casilla.valor === 'true' ? true : casilla.valor === 'false' ? false : casilla.valor
        else if (cambiosExp[fc.campo] === undefined) cambiosExp[fc.campo] = null
        continue
      }
      if (!observaciones) return { error: 'Todavía no hay relevamiento en el lugar: estas casillas se marcan desde la aplicación del celular o después de la visita.' }
      tocaRelevamiento = true
      const actual = observaciones[fc.clave]
      if (casilla.multiple) {
        const lista = new Set(Array.isArray(actual) ? actual : [])
        if (valor) lista.add(casilla.valor)
        else lista.delete(casilla.valor)
        observaciones = { ...observaciones, [fc.clave]: [...lista] }
      } else if (valor) {
        observaciones = { ...observaciones, [fc.clave]: casilla.valor }
      } else if (actual === casilla.valor) {
        const { [fc.clave]: _quitado, ...resto } = observaciones
        void _quitado
        observaciones = resto
      }
      continue
    }
    const campo = plantilla.campos.find((c) => c.id === id)
    if (!campo) continue
    const f = campo.fuente

    if (f.tipo === 'marco' || f.tipo === 'fijo') continue // sale de la ley o es fijo: no se edita

    if (f.tipo === 'relevamiento') {
      if (f.clave === 'fecha') {
        valoresForm[plantilla.clave] = { ...(valoresForm[plantilla.clave] ?? {}), fecha: valor }
        continue
      }
      if (!observaciones) return { error: 'Todavía no hay relevamiento en el lugar para guardar este dato.' }
      observaciones = { ...observaciones, [f.clave]: valor }
      tocaRelevamiento = true
      continue
    }

    if (f.tipo === 'familiar') {
      const clave = `${f.solicitante}.${f.indice}`
      const datos = cambiosFamiliar.get(clave) ?? {}
      if (f.campo === 'apellido_nombre') Object.assign(datos, separarNombre(valor, familiaresDe(personas, f.solicitante)[f.indice - 1]?.apellido))
      else if (f.campo === 'dni') {
        if (valor && !/^\d{7,8}$/.test(valor)) return { error: `${campo.etiqueta}: 7 u 8 números, sin puntos.` }
        datos.dni = valor || null
      } else if (f.campo === 'edad') {
        if (valor && !/^\d{1,3}$/.test(valor)) return { error: `${campo.etiqueta}: solo el número de años.` }
        datos.edad_declarada = valor ? Number(valor) : null
      } else datos[f.campo] = valor || null
      cambiosFamiliar.set(clave, datos)
      continue
    }

    if (f.tipo === 'formulario') {
      valoresForm[plantilla.clave] = { ...(valoresForm[plantilla.clave] ?? {}), [f.clave]: valor }
      continue
    }

    if (f.tipo === 'expediente') {
      if (SOLO_LECTURA.has(f.campo)) continue
      if ((CAMPOS_CATASTRALES as readonly string[]).includes(f.campo)) catastrales[f.campo] = valor
      else if (f.campo === 'fecha_inicio_posesion') {
        const iso = aIso(valor)
        if (iso === 'invalida') return { error: 'La fecha de inicio de la posesión va como dd/mm/aaaa.' }
        cambiosExp.fecha_inicio_posesion = iso
      } else cambiosExp[f.campo] = valor || null
      continue
    }

    // Persona
    const persona = cambiosPersona.get(f.slot) ?? {}
    if (f.campo === 'apellido_nombre') {
      Object.assign(persona, separarNombre(valor, personaDeSlot(personas, f.slot)?.apellido))
    } else if (f.campo === 'dni') {
      if (valor && !/^\d{7,8}$/.test(valor)) return { error: `${campo.etiqueta}: 7 u 8 números, sin puntos.` }
      persona.dni = valor || null
    } else if (f.campo === 'cuil') {
      if (valor && !/^\d{2}-\d{7,8}-\d$/.test(valor)) return { error: `${campo.etiqueta}: va con guiones, 20-12345678-3.` }
      persona.cuil = valor || null
    } else if (f.campo === 'estado_civil') {
      if (valor && !ESTADOS_CIVILES.includes(valor)) return { error: `${campo.etiqueta}: elegí una opción de la lista.` }
      persona.estado_civil = valor || null
    } else {
      persona[f.campo] = valor || null
    }
    cambiosPersona.set(f.slot, persona)
  }

  // Personas: actualizar las que existen; crear las que se escribieron por primera vez en el formulario.
  for (const [slot, datos] of cambiosPersona) {
    const existente = personaDeSlot(personas, slot)
    if (existente) {
      const { error } = await supabase.from('case_people').update(datos).eq('id', existente.id)
      if (error) return { error: `No se pudo guardar: ${error.message}` }
    } else if (Object.values(datos).some((v) => v)) {
      if (!datos.apellido) return { error: 'Para agregar una persona desde el formulario, escribí al menos su apellido.' }
      const { error } = await supabase.from('case_people').insert({
        ...datos,
        case_file_id: expedienteId,
        rol: slot.startsWith('s') ? 'solicitante' : 'conyuge',
        solicitante_numero: Number(slot.slice(1)),
      })
      if (error) return { error: `No se pudo guardar: ${error.message}` }
    }
  }

  // Grupo familiar: se actualiza el integrante que corresponde al renglón, o se agrega.
  for (const [clave, datos] of cambiosFamiliar) {
    const [solicitante, indice] = clave.split('.').map(Number)
    const lista = familiaresDe(personas, solicitante)
    const existente = lista[indice - 1]
    if (existente) {
      const { error } = await supabase.from('case_people').update(datos).eq('id', existente.id)
      if (error) return { error: `No se pudo guardar: ${error.message}` }
    } else if (Object.values(datos).some((v) => v !== null && v !== '')) {
      if (!datos.apellido) return { error: 'Para agregar a alguien del grupo familiar, escribí al menos su apellido.' }
      const { error } = await supabase.from('case_people').insert({
        ...datos, case_file_id: expedienteId, rol: 'grupo_familiar', solicitante_numero: solicitante,
        orden: Math.max(0, ...lista.map((x) => x.orden ?? 0)) + 1,
      })
      if (error) return { error: `No se pudo guardar: ${error.message}` }
    }
  }

  if (tocaRelevamiento && relevamiento && observaciones) {
    const { data: rel, error } = await supabase.from('field_surveys').update({ observaciones }).eq('id', relevamiento.id).select('id')
    if (error || !rel?.length) return { error: 'No se pudo guardar lo del relevamiento: el expediente ya no se puede editar.' }
  }

  const { data: actualizado, error } = await supabase
    .from('case_files')
    .update({ ...cambiosExp, datos_catastrales: catastrales, valores_formularios: valoresForm })
    .eq('id', expedienteId)
    .select('id')
  if (error) return { error: `No se pudo guardar: ${error.message}` }
  if (!actualizado?.length) return { error: 'El expediente ya no se puede editar en este estado.' }

  revalidatePath(`/expedientes/${expedienteId}`)
  return { ok: 'Cambios guardados en la ficha del expediente.' }
}

/** Anota que el formulario se imprimió con estos datos (para avisar si después cambian). */
export async function registrarImpresion(expedienteId: string, formulario: string, huella: string): Promise<void> {
  await obtenerContexto()
  const supabase = await createClient()
  const { data } = await supabase.from('case_files').select('formularios_impresos').eq('id', expedienteId).maybeSingle()
  if (!data) return
  const impresos = { ...(data.formularios_impresos as Record<string, unknown>), [formulario]: { huella, fecha: new Date().toISOString() } }
  await supabase.from('case_files').update({ formularios_impresos: impresos }).eq('id', expedienteId)
  revalidatePath(`/expedientes/${expedienteId}`)
}

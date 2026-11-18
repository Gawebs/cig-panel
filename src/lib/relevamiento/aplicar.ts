/**
 * Cómo pasan las respuestas de la entrevista a la ficha del expediente.
 *
 * Regla: lo que viene del relevamiento llena casilleros vacíos, o casilleros que todavía tienen
 * lo que el mismo relevamiento escribió la vez anterior. Nunca pisa un dato que alguien cargó
 * o corrigió a mano en la oficina.
 *
 * Función pura, con pruebas en aplicar.test.ts.
 */
import { interpretar, preguntaPorClave, separarNombre, type Valor } from './cuestionario'

export interface RespuestaGuardada {
  texto: string
  origen: 'voz' | 'mano'
  revisado?: boolean
  audio?: string | null
  /** Lo que este relevamiento escribió en la ficha la última vez (para saber si se puede actualizar). */
  aplicado?: Valor
}

export interface PersonaFicha {
  id: string
  rol: string
  apellido: string
  nombre: string
  ocupacion: string | null
  telefono: string | null
  vinculo: string | null
  edad_declarada: number | null
  origen_datos: Record<string, string>
}

export interface ExpedienteFicha {
  fecha_inicio_posesion: string | null
  origen_posesion: string | null
  origen_posesion_detalle: string | null
  tiene_documentacion_ipvdu: boolean | null
}

export interface Plan {
  expediente: Partial<ExpedienteFicha>
  titular: Partial<Pick<PersonaFicha, 'ocupacion' | 'telefono' | 'origen_datos'>>
  familiaresNuevos: { orden: number; apellido: string; nombre: string; edad_declarada: number | null; vinculo: string | null; ocupacion: string | null; origen_datos: Record<string, string> }[]
  familiaresCambios: { id: string; cambios: Partial<PersonaFicha> }[]
  /** Respuestas con lo aplicado actualizado, para guardar en el relevamiento. */
  respuestas: Record<string, RespuestaGuardada>
}

type Comparable = string | number | boolean | null | undefined

function igual(a: Comparable | Valor | undefined, b: Comparable | Valor | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Se puede escribir si el casillero está vacío o todavía tiene lo que escribió el relevamiento. */
function sePuede(actual: Comparable, anterior: Valor | undefined) {
  return actual === null || actual === undefined || actual === '' || (anterior !== undefined && igual(actual, anterior))
}

export function planDeAplicacion(p: {
  respuestas: Record<string, RespuestaGuardada>
  expediente: ExpedienteFicha
  titular: PersonaFicha | null
  personas: PersonaFicha[]
  hoy?: Date
}): Plan {
  const plan: Plan = { expediente: {}, titular: {}, familiaresNuevos: [], familiaresCambios: [], respuestas: {} }
  const familiares = new Map<number, Record<string, Valor>>()
  const origenTitular: Record<string, string> = {}

  for (const [clave, r] of Object.entries(p.respuestas)) {
    plan.respuestas[clave] = { ...r }
    const pregunta = preguntaPorClave(clave)
    if (!pregunta) continue
    const { valor, extra } = interpretar(pregunta, r.texto, p.hoy)
    if (valor === null || (Array.isArray(valor) && valor.length === 0)) continue
    const d = pregunta.destino
    const origen = r.origen === 'voz' && !r.revisado ? 'voz' : 'relevamiento'

    if (d.tipo === 'titular' && p.titular) {
      if (sePuede(p.titular[d.campo], r.aplicado)) {
        plan.titular[d.campo] = String(valor)
        origenTitular[d.campo] = origen
        plan.respuestas[clave].aplicado = String(valor)
      }
    } else if (d.tipo === 'expediente') {
      if (d.campo === 'origen_posesion') {
        if (sePuede(p.expediente.origen_posesion, r.aplicado)) {
          plan.expediente.origen_posesion = String(valor)
          plan.expediente.origen_posesion_detalle = extra?.detalle ?? null
          plan.respuestas[clave].aplicado = valor
        }
      } else if (sePuede(p.expediente[d.campo] as Comparable, r.aplicado)) {
        ;(plan.expediente as Record<string, Valor>)[d.campo] = valor
        plan.respuestas[clave].aplicado = valor
      }
    } else if (d.tipo === 'familiar') {
      const n = Number(clave.split('.')[1])
      const datos = familiares.get(n) ?? {}
      datos[d.campo] = valor
      datos[`origen_${d.campo}`] = origen
      familiares.set(n, datos)
    }
  }

  if (Object.keys(origenTitular).length && p.titular) {
    plan.titular.origen_datos = { ...p.titular.origen_datos, ...origenTitular }
  }

  for (const [n, datos] of [...familiares.entries()].sort((a, b) => a[0] - b[0])) {
    const marca = `familiar.${n}`
    const existente = p.personas.find((x) => x.rol === 'grupo_familiar' && x.origen_datos?.relevamiento === marca)
    const { nombre, apellido } = separarNombre(String(datos.nombre ?? ''))
    const origenDatos: Record<string, string> = { relevamiento: marca }
    for (const campo of ['nombre', 'edad', 'vinculo', 'ocupacion']) {
      if (datos[`origen_${campo}`]) origenDatos[campo === 'nombre' ? 'apellido_nombre' : campo] = String(datos[`origen_${campo}`])
    }
    if (!existente) {
      if (!datos.nombre) continue // sin nombre no se crea la persona
      plan.familiaresNuevos.push({
        orden: n, apellido, nombre,
        edad_declarada: typeof datos.edad === 'number' ? datos.edad : null,
        vinculo: datos.vinculo ? String(datos.vinculo) : null,
        ocupacion: datos.ocupacion ? String(datos.ocupacion) : null,
        origen_datos: origenDatos,
      })
      for (const campo of ['nombre', 'edad', 'vinculo', 'ocupacion']) {
        const r = plan.respuestas[`${marca}.${campo}`]
        if (r && datos[campo] !== undefined) r.aplicado = datos[campo]
      }
      continue
    }
    const cambios: Partial<PersonaFicha> = {}
    const anterior = (campo: string) => plan.respuestas[`${marca}.${campo}`]?.aplicado
    const completoActual = `${existente.nombre} ${existente.apellido}`.trim()
    if (datos.nombre && completoActual !== `${nombre} ${apellido}`.trim() && sePuede(completoActual, anterior('nombre'))) {
      cambios.nombre = nombre
      cambios.apellido = apellido
      plan.respuestas[`${marca}.nombre`].aplicado = `${nombre} ${apellido}`.trim()
    }
    if (typeof datos.edad === 'number' && datos.edad !== existente.edad_declarada && sePuede(existente.edad_declarada, anterior('edad'))) {
      cambios.edad_declarada = datos.edad
      plan.respuestas[`${marca}.edad`].aplicado = datos.edad
    }
    for (const campo of ['vinculo', 'ocupacion'] as const) {
      if (datos[campo] && String(datos[campo]) !== existente[campo] && sePuede(existente[campo], anterior(campo))) {
        cambios[campo] = String(datos[campo])
        plan.respuestas[`${marca}.${campo}`].aplicado = String(datos[campo])
      }
    }
    if (Object.keys(cambios).length) {
      cambios.origen_datos = { ...existente.origen_datos, ...origenDatos }
      plan.familiaresCambios.push({ id: existente.id, cambios })
    }
  }

  return plan
}

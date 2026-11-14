/**
 * Lo que el relevador ve y marca en el lugar (hojas 2 y 3 del relevamiento social).
 * Destino, servicios y mejoras se proponen con lo que dijo el vecino en la entrevista
 * hasta que el relevador los confirma o corrige.
 */
import { DESTINOS, MEJORAS, SERVICIOS, interpretar, preguntaPorClave } from './cuestionario'

type Respuestas = Record<string, { texto: string } | undefined>
export type Observaciones = Record<string, string | string[]>

type Opcion = { valor: string; etiqueta: string }
export type Grupo = { clave: string; titulo: string; opciones: Opcion[]; varias?: boolean; desdeEntrevista?: string; obligatorio?: boolean; detalle?: string }

const SI_NO: Opcion[] = [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]
const solo = (ops: { valor: string; etiqueta: string }[]) => ops.map(({ valor, etiqueta }) => ({ valor, etiqueta }))

export const GRUPOS: Grupo[] = [
  { clave: 'presencia_ocupante', titulo: '¿Se constató la presencia del ocupante?', opciones: SI_NO, obligatorio: true },
  { clave: 'signos_residencia', titulo: '¿Se ven signos de residencia efectiva?', opciones: SI_NO, obligatorio: true, detalle: 'signos_residencia_detalle' },
  { clave: 'entorno', titulo: 'Entorno', opciones: [{ valor: 'urbano', etiqueta: 'Urbano' }, { valor: 'rural', etiqueta: 'Rural' }], obligatorio: true },
  { clave: 'ocupacion', titulo: 'Situación ocupacional aparente', opciones: [{ valor: 'exclusiva', etiqueta: 'Exclusiva' }, { valor: 'compartida', etiqueta: 'Compartida' }], obligatorio: true },
  {
    clave: 'tipologia', titulo: 'Tipología edilicia', obligatorio: true, detalle: 'tipologia_otro',
    opciones: [{ valor: 'casa', etiqueta: 'Casa' }, { valor: 'departamento', etiqueta: 'Departamento' }, { valor: 'precaria', etiqueta: 'Construcción precaria' }, { valor: 'otro', etiqueta: 'Otro' }],
  },
  { clave: 'destino', titulo: 'Destino', opciones: solo(DESTINOS).reverse(), desdeEntrevista: 'casa.destino', obligatorio: true },
  { clave: 'estado', titulo: 'Estado general de la edificación', opciones: [{ valor: 'bueno', etiqueta: 'Bueno' }, { valor: 'regular', etiqueta: 'Regular' }, { valor: 'malo', etiqueta: 'Malo' }], obligatorio: true },
  {
    clave: 'materiales', titulo: 'Materiales predominantes', obligatorio: true,
    opciones: [{ valor: 'mamposteria', etiqueta: 'Mampostería' }, { valor: 'chapa', etiqueta: 'Chapa' }, { valor: 'madera', etiqueta: 'Madera' }, { valor: 'mixto', etiqueta: 'Mixto' }],
  },
  { clave: 'servicios', titulo: 'Servicios disponibles', opciones: solo(SERVICIOS), varias: true, desdeEntrevista: 'casa.servicios', detalle: 'servicios_otros' },
  { clave: 'mejoras', titulo: 'Mejoras observadas', opciones: solo(MEJORAS), varias: true, desdeEntrevista: 'casa.mejoras', detalle: 'mejoras_otras' },
]

export const TEXTOS: { clave: string; titulo: string; ayuda?: string }[] = [
  { clave: 'infraestructura', titulo: 'Infraestructura del entorno', ayuda: 'Calles, alumbrado, desagües.' },
  { clave: 'accesos', titulo: 'Accesos', ayuda: 'Calle de tierra, pavimento, pasillo.' },
  { clave: 'observaciones_inmueble', titulo: 'Observaciones sobre el inmueble' },
  { clave: 'observaciones_generales', titulo: 'Observaciones generales' },
]

/** Valor de una casilla: lo que marcó el relevador o, si no tocó nada, lo que dijo el vecino. */
export function valorObservacion(r: { observaciones: Observaciones; respuestas: Respuestas }, g: Grupo): { valor: string | string[] | undefined; deEntrevista: boolean } {
  const propio = r.observaciones[g.clave]
  if (propio !== undefined) return { valor: propio, deEntrevista: false }
  if (g.desdeEntrevista) {
    const resp = r.respuestas[g.desdeEntrevista]
    const pregunta = preguntaPorClave(g.desdeEntrevista)
    if (resp?.texto && pregunta) {
      const { valor } = interpretar(pregunta, resp.texto)
      if (typeof valor === 'string' || (Array.isArray(valor) && valor.length)) return { valor, deEntrevista: true }
    }
  }
  return { valor: undefined, deEntrevista: false }
}

export function observacionesCompletas(obs: Observaciones): boolean {
  return GRUPOS.filter((g) => g.obligatorio && g.clave !== 'destino').every((g) => obs[g.clave] !== undefined)
}

/** Todas las observaciones, con lo de la entrevista ya resuelto (para imprimir el formulario). */
export function observacionesEfectivas(r: { observaciones: Observaciones; respuestas: Respuestas }): Observaciones {
  const salida: Observaciones = { ...r.observaciones }
  for (const g of GRUPOS) {
    const { valor } = valorObservacion(r, g)
    if (valor !== undefined) salida[g.clave] = valor
  }
  return salida
}

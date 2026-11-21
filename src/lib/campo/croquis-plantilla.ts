/**
 * Croquis prediseñado: la manzana del lote con las cuatro calles alrededor y las manzanas vecinas.
 * Lo que el relevador carga (medidas, distancia a la esquina, calles, referencia) se dibuja solo.
 * Acá está la geometría (pura, con pruebas); el dibujo en el lienzo está en `src/app/campo/croquis.tsx`.
 */

/** Lo dibujado a mano encima de la plantilla (se guarda para poder seguir editando). */
export type Trazo =
  | { tipo: 'lapiz'; puntos: [number, number][]; grosor: number }
  | { tipo: 'linea' | 'rectangulo'; desde: [number, number]; hasta: [number, number]; grosor: number }
  | { tipo: 'texto'; en: [number, number]; texto: string }

export type Lado = 'frente' | 'fondo' | 'izquierda' | 'derecha'

export interface DatosCroquis {
  /** Calle donde está la entrada del lote (abajo en el dibujo). */
  calleFrente: string
  /** Calle de atrás de la manzana. */
  calleFondo: string
  /** Calles de los costados, mirando el lote de frente desde la calle. */
  calleIzquierda: string
  calleDerecha: string
  /** Medidas del lote en metros: frente (ancho) y fondo (largo). */
  frente: string
  fondo: string
  /** Metros desde el lote hasta la esquina más cercana. */
  distancia: string
  /** Qué esquina es la más cercana, mirando el lote de frente. */
  esquina: 'izquierda' | 'derecha'
  /** Un lugar conocido cerca (escuela, almacén, plaza) y de qué lado de la manzana está. */
  referencia: string
  referenciaLado: Lado
}

export const DATOS_VACIOS: DatosCroquis = {
  calleFrente: '', calleFondo: '', calleIzquierda: '', calleDerecha: '',
  frente: '', fondo: '', distancia: '', esquina: 'izquierda',
  referencia: '', referenciaLado: 'frente',
}

export const LADO_LIENZO = 1200
/** Ancho de cada calle y de la franja de manzanas vecinas, en el dibujo. */
export const CALLE = 130
/** La manzana del lote (cuadrada, en el medio). */
export const MANZANA = { x0: 2 * CALLE, y0: 2 * CALLE, x1: LADO_LIENZO - 2 * CALLE, y1: LADO_LIENZO - 2 * CALLE }
const LADO_MANZANA = MANZANA.x1 - MANZANA.x0
/** Escala máxima: una cuadra de 100 m ocupa el lado de la manzana. */
const ESCALA_MAXIMA = LADO_MANZANA / 100
/** Lo que pueden ocupar el lote y la distancia sin salirse de la manzana. */
const UTIL = LADO_MANZANA - 40

/** Lee "12,5" o "12.5 m" como número; vacío o inválido da null. */
export function metros(texto: string): number | null {
  const n = Number(texto.replace(',', '.').replace(/[^\d.]/g, ''))
  return texto.trim() && Number.isFinite(n) && n > 0 ? n : null
}

/** "12.5" → "12,5 m" (como se escribe en Argentina). */
export function textoMetros(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace('.', ',')} m`
}

export interface GeometriaCroquis {
  /** Rectángulo del lote en el dibujo. */
  lote: { x0: number; y0: number; x1: number; y1: number }
  /** Si faltan las medidas, el lote se dibuja de ejemplo (punteado). */
  medidasCargadas: boolean
  /** Línea de la distancia a la esquina (en la calle del frente), si se cargó. */
  cota: { x0: number; x1: number } | null
  escala: number
}

export function geometria(d: DatosCroquis): GeometriaCroquis {
  const frente = metros(d.frente)
  const fondo = metros(d.fondo)
  const distancia = metros(d.distancia)
  const f = frente ?? 10
  const g = fondo ?? 30
  const escala = Math.min(ESCALA_MAXIMA, UTIL / ((distancia ?? 0) + f), UTIL / g)

  const ancho = f * escala
  const largo = g * escala
  const y1 = MANZANA.y1
  let x0: number
  if (distancia === null) x0 = (MANZANA.x0 + MANZANA.x1 - ancho) / 2
  else if (d.esquina === 'derecha') x0 = MANZANA.x1 - distancia * escala - ancho
  else x0 = MANZANA.x0 + distancia * escala
  const lote = { x0, y0: y1 - largo, x1: x0 + ancho, y1 }

  const cota = distancia === null ? null : d.esquina === 'derecha' ? { x0: lote.x1, x1: MANZANA.x1 } : { x0: MANZANA.x0, x1: lote.x0 }
  return { lote, medidasCargadas: frente !== null && fondo !== null, cota, escala }
}

/** Qué falta para que el croquis esté completo (lo que pide Catastro). */
export function faltantesCroquis(d: DatosCroquis): string[] {
  const falta: string[] = []
  if (!metros(d.frente) || !metros(d.fondo)) falta.push('las medidas del lote')
  if (!metros(d.distancia)) falta.push('la distancia a la esquina')
  if (!d.calleFrente.trim()) falta.push('la calle del frente')
  if (!d.calleIzquierda.trim() && !d.calleDerecha.trim()) falta.push('al menos una calle del costado')
  if (!d.referencia.trim()) falta.push('una referencia')
  return falta
}

/** Los datos del croquis como observaciones del relevamiento (así llegan a la ficha y a los formularios). */
export function observacionesDeCroquis(d: DatosCroquis | undefined): Record<string, string> {
  if (!d) return {}
  const salida: Record<string, string> = {
    croquis_calle_frente: d.calleFrente, croquis_calle_fondo: d.calleFondo,
    croquis_calle_izquierda: d.calleIzquierda, croquis_calle_derecha: d.calleDerecha,
    croquis_frente_m: d.frente, croquis_fondo_m: d.fondo,
    croquis_distancia_esquina_m: d.distancia, croquis_esquina: d.esquina,
    croquis_referencia: d.referencia, croquis_referencia_lado: d.referenciaLado,
  }
  return Object.fromEntries(Object.entries(salida).map(([k, v]) => [k, v.trim().slice(0, 200)]).filter(([, v]) => v))
}

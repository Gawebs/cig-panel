/**
 * Informe para el intendente: números del avance y proyecciones.
 * Función pura (sin base ni navegador) para poder probarla.
 */
import type { EstadoExpediente } from '@/lib/textos'

// Etapas del trámite, agrupando estados (las mismas del Tablero).
export const ETAPAS: { clave: string; titulo: string; estados: EstadoExpediente[]; color: string }[] = [
  { clave: 'armado', titulo: 'En armado', estados: ['en_armado', 'devuelto'], color: 'bg-azul-suave text-azul' },
  { clave: 'oficina', titulo: 'Revisión y firma', estados: ['listo_para_revisar', 'aprobado', 'firmado'], color: 'bg-aviso-suave text-aviso' },
  { clave: 'catastro', titulo: 'En Catastro', estados: ['presentado', 'reingresado', 'prorroga_pedida'], color: 'bg-azul-suave text-azul' },
  { clave: 'observado', titulo: 'Observados', estados: ['observado'], color: 'bg-error-suave text-error' },
  { clave: 'aceptado', titulo: 'Aceptados', estados: ['aceptado'], color: 'bg-ok-suave text-ok' },
]

/** Roles que pueden generar el informe (el intendente entra con "consulta"). */
export const ROLES_INFORME = ['direccion', 'subdireccion', 'consulta'] as const

export const etapaDe = (estado: string) => ETAPAS.find((e) => (e.estados as string[]).includes(estado))?.clave

export interface CasoInforme {
  id: string
  estado: string
  /** AAAA-MM-DD */
  fecha_apertura: string
  barrio: string
  ley: string
}

export interface EventoInforme {
  case_file_id: string
  a_estado: string | null
  /** Fecha y hora ISO */
  created_at: string
}

export interface Mes { clave: string; titulo: string; abiertos: number; presentados: number; aceptados: number }

export interface Escenario {
  nombre: string
  factor: number
  /** Expedientes por mes que se esperan con este escenario. */
  porMes: number
  /** Aceptados acumulados a 3, 6 y 12 meses. */
  aceptadosA: { meses: number; total: number }[]
  /** Mes en que se terminarían los pendientes de hoy (AAAA-MM), o null si no hay ritmo. */
  terminaEn: string | null
}

export interface Informe {
  total: number
  porEtapa: { clave: string; titulo: string; cantidad: number }[]
  aceptados: number
  pendientes: number
  avance: number
  desistidos: number
  porBarrio: { nombre: string; total: number; aceptados: number; enCatastro: number; avance: number }[]
  porLey: { nombre: string; total: number; aceptados: number }[]
  meses: Mes[]
  ritmo: { abiertos: number; presentados: number; aceptados: number }
  tiempos: { aperturaAPresentacion: number | null; presentacionAAceptacion: number | null }
  /** De qué se proyecta: aceptaciones reales, o presentaciones si todavía no hay aceptaciones. */
  baseProyeccion: 'aceptados' | 'presentados' | null
  escenarios: Escenario[]
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const tituloMes = (clave: string) => {
  const [a, m] = clave.split('-').map(Number)
  return `${MESES[m - 1]} ${String(a).slice(2)}`
}
const sumarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const dias = (desde: string, hasta: string) => (new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000

function mediana(valores: number[]): number | null {
  if (!valores.length) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2)
}

const redondear1 = (n: number) => Math.round(n * 10) / 10

export function calcularInforme(casos: CasoInforme[], eventos: EventoInforme[], hoy = new Date()): Informe {
  const activos = casos.filter((c) => c.estado !== 'desistido' && c.estado !== 'archivado')
  const desistidos = casos.length - activos.length
  const contar = (lista: CasoInforme[], etapa: string) => lista.filter((c) => etapaDe(c.estado) === etapa).length
  const aceptados = contar(activos, 'aceptado')
  const pendientes = activos.length - aceptados

  // Primera vez que cada expediente llegó a "presentado" y a "aceptado".
  const primera = (estado: string) => {
    const m = new Map<string, string>()
    for (const e of [...eventos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (e.a_estado === estado && !m.has(e.case_file_id)) m.set(e.case_file_id, e.created_at)
    }
    return m
  }
  const presentadoEl = primera('presentado')
  const aceptadoEl = primera('aceptado')

  // Últimos 12 meses (incluye el actual).
  const inicio = sumarMeses(hoy, -11)
  const meses: Mes[] = Array.from({ length: 12 }, (_, i) => {
    const clave = claveMes(sumarMeses(inicio, i))
    return { clave, titulo: tituloMes(clave), abiertos: 0, presentados: 0, aceptados: 0 }
  })
  const delMes = (iso: string) => meses.find((m) => m.clave === iso.slice(0, 7))
  for (const c of casos) { const m = delMes(c.fecha_apertura); if (m) m.abiertos++ }
  for (const f of presentadoEl.values()) { const m = delMes(f); if (m) m.presentados++ }
  for (const f of aceptadoEl.values()) { const m = delMes(f); if (m) m.aceptados++ }

  // Ritmo: promedio mensual de los últimos 90 días.
  const hace90 = new Date(hoy.getTime() - 90 * 86400000).toISOString()
  const en90 = (fechas: Iterable<string>) => [...fechas].filter((f) => f >= hace90 && f <= hoy.toISOString()).length / 3
  const ritmo = {
    abiertos: redondear1(en90(casos.map((c) => `${c.fecha_apertura}T12:00:00`))),
    presentados: redondear1(en90(presentadoEl.values())),
    aceptados: redondear1(en90(aceptadoEl.values())),
  }

  const tiempos = {
    aperturaAPresentacion: mediana(casos.filter((c) => presentadoEl.has(c.id)).map((c) => dias(`${c.fecha_apertura}T12:00:00`, presentadoEl.get(c.id)!))),
    presentacionAAceptacion: mediana([...aceptadoEl.entries()].filter(([id]) => presentadoEl.has(id)).map(([id, f]) => dias(presentadoEl.get(id)!, f))),
  }

  const baseProyeccion = ritmo.aceptados > 0 ? 'aceptados' : ritmo.presentados > 0 ? 'presentados' : null
  const base = baseProyeccion === 'aceptados' ? ritmo.aceptados : baseProyeccion === 'presentados' ? ritmo.presentados : 0
  const escenarios: Escenario[] = [
    { nombre: 'Prudente', factor: 0.75 },
    { nombre: 'Ritmo actual', factor: 1 },
    { nombre: 'Si se acelera', factor: 1.25 },
  ].map(({ nombre, factor }) => {
    const porMes = redondear1(base * factor)
    return {
      nombre,
      factor,
      porMes,
      aceptadosA: [3, 6, 12].map((meses) => ({ meses, total: aceptados + Math.min(pendientes, Math.round(porMes * meses)) })),
      terminaEn: porMes > 0 && pendientes > 0 ? claveMes(sumarMeses(hoy, Math.ceil(pendientes / porMes))) : null,
    }
  })

  const agrupar = (clave: (c: CasoInforme) => string) => {
    const m = new Map<string, CasoInforme[]>()
    for (const c of activos) m.set(clave(c), [...(m.get(clave(c)) ?? []), c])
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }

  return {
    total: activos.length,
    porEtapa: ETAPAS.map((e) => ({ clave: e.clave, titulo: e.titulo, cantidad: contar(activos, e.clave) })),
    aceptados,
    pendientes,
    avance: activos.length ? Math.round((aceptados / activos.length) * 100) : 0,
    desistidos,
    porBarrio: agrupar((c) => c.barrio).map(([nombre, lista]) => ({
      nombre,
      total: lista.length,
      aceptados: contar(lista, 'aceptado'),
      enCatastro: contar(lista, 'catastro') + contar(lista, 'observado'),
      avance: Math.round((contar(lista, 'aceptado') / lista.length) * 100),
    })),
    porLey: agrupar((c) => c.ley).map(([nombre, lista]) => ({ nombre, total: lista.length, aceptados: contar(lista, 'aceptado') })),
    meses,
    ritmo,
    tiempos,
    baseProyeccion,
    escenarios,
  }
}

/** "2027-03" → "marzo de 2027" */
export function mesLargo(clave: string) {
  const [a, m] = clave.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

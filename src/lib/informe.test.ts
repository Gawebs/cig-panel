import { describe, expect, it } from 'vitest'
import { calcularInforme, type CasoInforme, type EventoInforme } from './informe'

const hoy = new Date('2026-11-24T12:00:00')
const caso = (id: string, estado: string, fecha: string, barrio = 'La Milagrosa', ley = 'Pierri'): CasoInforme => ({ id, estado, fecha_apertura: fecha, barrio, ley })
const ev = (id: string, a: string, f: string): EventoInforme => ({ case_file_id: id, a_estado: a, created_at: `${f}T15:00:00Z` })

describe('informe para el intendente', () => {
  it('cuenta por etapa, avance y deja afuera los desistidos', () => {
    const r = calcularInforme([
      caso('a', 'aceptado', '2026-09-01'), caso('b', 'presentado', '2026-10-01'),
      caso('c', 'en_armado', '2026-11-01'), caso('d', 'desistido', '2026-11-02'),
    ], [], hoy)
    expect(r.total).toBe(3)
    expect(r.desistidos).toBe(1)
    expect(r.aceptados).toBe(1)
    expect(r.pendientes).toBe(2)
    expect(r.avance).toBe(33)
    expect(r.porEtapa.find((e) => e.clave === 'catastro')?.cantidad).toBe(1)
  })

  it('mide el ritmo de los últimos 90 días y proyecta con tres escenarios', () => {
    const casos = Array.from({ length: 12 }, (_, i) => caso(`c${i}`, i < 6 ? 'aceptado' : 'en_armado', '2026-08-01'))
    const eventos = casos.slice(0, 6).flatMap((c, i) => [ev(c.id, 'presentado', '2026-09-01'), ev(c.id, 'aceptado', `2026-10-${String(10 + i).padStart(2, '0')}`)])
    const r = calcularInforme(casos, eventos, hoy)
    expect(r.ritmo.aceptados).toBe(2) // 6 en 3 meses
    expect(r.baseProyeccion).toBe('aceptados')
    const actual = r.escenarios.find((e) => e.nombre === 'Ritmo actual')!
    expect(actual.porMes).toBe(2)
    expect(actual.aceptadosA).toEqual([{ meses: 3, total: 12 }, { meses: 6, total: 12 }, { meses: 12, total: 12 }])
    expect(actual.terminaEn).toBe('2027-02') // 6 pendientes a 2 por mes
    expect(r.tiempos.aperturaAPresentacion).toBe(31)
  })

  it('sin aceptaciones todavía proyecta con las presentaciones, y sin nada no proyecta', () => {
    const conPresentados = calcularInforme([caso('a', 'presentado', '2026-10-01')], [ev('a', 'presentado', '2026-11-01')], hoy)
    expect(conPresentados.baseProyeccion).toBe('presentados')
    const vacio = calcularInforme([caso('a', 'en_armado', '2026-11-01')], [], hoy)
    expect(vacio.baseProyeccion).toBeNull()
    expect(vacio.escenarios.every((e) => e.terminaEn === null)).toBe(true)
  })

  it('arma los 12 meses con lo abierto, presentado y aceptado', () => {
    const r = calcularInforme([caso('a', 'aceptado', '2026-11-03')], [ev('a', 'presentado', '2026-11-10'), ev('a', 'aceptado', '2026-11-20')], hoy)
    expect(r.meses).toHaveLength(12)
    expect(r.meses.at(-1)).toMatchObject({ clave: '2026-11', abiertos: 1, presentados: 1, aceptados: 1 })
    expect(r.meses[0].clave).toBe('2025-12')
  })
})

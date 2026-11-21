import { describe, expect, it } from 'vitest'
import { DATOS_VACIOS, MANZANA, faltantesCroquis, geometria, metros, observacionesDeCroquis, textoMetros } from './croquis-plantilla'

describe('croquis prediseñado', () => {
  it('lee metros con coma o con unidad', () => {
    expect(metros('12,5')).toBe(12.5)
    expect(metros('30 m')).toBe(30)
    expect(metros('')).toBeNull()
    expect(metros('abc')).toBeNull()
    expect(textoMetros(12.5)).toBe('12,5 m')
  })

  it('sin medidas dibuja un lote de ejemplo en el medio, sin cota', () => {
    const g = geometria(DATOS_VACIOS)
    expect(g.medidasCargadas).toBe(false)
    expect(g.cota).toBeNull()
    expect(Math.round((g.lote.x0 + g.lote.x1) / 2)).toBe((MANZANA.x0 + MANZANA.x1) / 2)
    expect(g.lote.y1).toBe(MANZANA.y1)
  })

  it('ubica el lote a la distancia cargada de la esquina izquierda', () => {
    const g = geometria({ ...DATOS_VACIOS, frente: '10', fondo: '30', distancia: '20' })
    expect(g.medidasCargadas).toBe(true)
    expect(g.lote.x0).toBeCloseTo(MANZANA.x0 + 20 * g.escala)
    expect(g.lote.x1 - g.lote.x0).toBeCloseTo(10 * g.escala)
    expect(g.lote.y1 - g.lote.y0).toBeCloseTo(30 * g.escala)
    expect(g.cota).toEqual({ x0: MANZANA.x0, x1: g.lote.x0 })
  })

  it('con la esquina a la derecha, la cota va del lote a la esquina derecha', () => {
    const g = geometria({ ...DATOS_VACIOS, frente: '10', fondo: '30', distancia: '15', esquina: 'derecha' })
    expect(g.lote.x1).toBeCloseTo(MANZANA.x1 - 15 * g.escala)
    expect(g.cota).toEqual({ x0: g.lote.x1, x1: MANZANA.x1 })
  })

  it('medidas grandes se achican para entrar en la manzana', () => {
    const g = geometria({ ...DATOS_VACIOS, frente: '40', fondo: '200', distancia: '150' })
    expect(g.lote.x1).toBeLessThanOrEqual(MANZANA.x1)
    expect(g.lote.y0).toBeGreaterThanOrEqual(MANZANA.y0)
  })

  it('dice qué falta y pasa los datos a observaciones', () => {
    expect(faltantesCroquis(DATOS_VACIOS)).toHaveLength(5)
    const completo = { ...DATOS_VACIOS, frente: '10', fondo: '30', distancia: '20', calleFrente: 'Belgrano', calleIzquierda: 'Mitre', referencia: 'Escuela N° 5' }
    expect(faltantesCroquis(completo)).toEqual([])
    const obs = observacionesDeCroquis(completo)
    expect(obs.croquis_calle_frente).toBe('Belgrano')
    expect(obs.croquis_calle_fondo).toBeUndefined()
    expect(Object.keys(obs).every((k) => /^[a-z_]+$/.test(k) && k.length <= 40)).toBe(true)
  })
})

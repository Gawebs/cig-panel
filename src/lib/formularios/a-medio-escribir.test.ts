import { describe, expect, it } from 'vitest'
import { aMedioEscribir } from './a-medio-escribir'

const cuil = { tipo: 'persona', slot: 's1', campo: 'cuil' } as never
describe('a medio escribir', () => {
  it('CUIL incompleto espera; completo o vacío se guarda', () => {
    expect(aMedioEscribir(cuil, '20-3012')).toBe(true)
    expect(aMedioEscribir(cuil, '20-30123456-5')).toBe(false)
    expect(aMedioEscribir(cuil, '20301234565')).toBe(false)
    expect(aMedioEscribir(cuil, '')).toBe(false)
  })
  it('los campos sin formato fijo nunca esperan', () => {
    expect(aMedioEscribir({ tipo: 'persona', slot: 's1', campo: 'apellido_nombre' } as never, 'PER')).toBe(false)
  })
})

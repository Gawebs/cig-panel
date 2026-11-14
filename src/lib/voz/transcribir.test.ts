import { describe, expect, it } from 'vitest'
import { limpiarTranscripcion } from './transcribir'

describe('limpiarTranscripcion', () => {
  it('quita las marcas de sonidos que no son habla', () => {
    expect(limpiarTranscripcion('(Música)')).toBe('')
    expect(limpiarTranscripcion(' [Risas] soy albañil (ruido de fondo)')).toBe('soy albañil')
  })
  it('deja el texto normal como está', () => {
    expect(limpiarTranscripcion('Desde marzo del 2005, más o menos.')).toBe('Desde marzo del 2005, más o menos.')
  })
})

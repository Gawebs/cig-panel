import { describe, expect, it } from 'vitest'
import { barrioDeLaLey } from './barrio-ley'

const barrios = [{ nombre: 'Ampliación La Milagrosa' }, { nombre: 'La Milagrosa' }, { nombre: 'Presidente Menem' }, { nombre: 'Centro' }]

describe('barrio según la ley', () => {
  it('La Milagrosa y Menem eligen su barrio exacto', () => {
    expect(barrioDeLaLey('ley_5670', barrios)?.nombre).toBe('La Milagrosa')
    expect(barrioDeLaLey('ley_8162', barrios)?.nombre).toBe('Presidente Menem')
  })
  it('Pierri no elige barrio, y si el municipio no lo tiene tampoco', () => {
    expect(barrioDeLaLey('ley_pierri', barrios)).toBeUndefined()
    expect(barrioDeLaLey('ley_5670', [{ nombre: 'Centro' }])).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { calcularCuil, extraerDomicilio, interpretarCodigoDni } from './dni'

describe('Código de barras del DNI', () => {
  it('formato tarjeta', () => {
    const d = interpretarCodigoDni('00512345678@RODRIGUEZ@MARTIN DANIEL@M@28123456@B@15/03/1980@20/05/2016@200')
    expect(d).toEqual({
      tramite: '00512345678', apellido: 'Rodriguez', nombre: 'Martin Daniel', sexo: 'M',
      dni: '28123456', ejemplar: 'B', fechaNacimiento: '1980-03-15',
    })
  })

  it('formato anterior (empieza con @)', () => {
    const d = interpretarCodigoDni('@28123456    @A@1@GOMEZ@ANA MARIA@ARGENTINA@02/11/1985@F@10/04/2010@00123456789@7055 @10/04/2025@421@0@ILR:2.01')
    expect(d?.dni).toBe('28123456')
    expect(d?.apellido).toBe('Gomez')
    expect(d?.nombre).toBe('Ana Maria')
    expect(d?.sexo).toBe('F')
    expect(d?.fechaNacimiento).toBe('1985-11-02')
  })

  it('texto que no es un DNI', () => {
    expect(interpretarCodigoDni('hola mundo')).toBeNull()
    expect(interpretarCodigoDni('a@b@c@d@NODNI@f@g@h')).toBeNull()
  })
})

describe('CUIL calculado', () => {
  it('casos conocidos', () => {
    expect(calcularCuil('12345678', 'M')).toBe('20-12345678-6')
    expect(calcularCuil('12345678', 'F')).toBe('27-12345678-0')
  })
  it('DNI de 7 dígitos', () => {
    expect(calcularCuil('5123456', 'M')).toMatch(/^20-05123456-\d$/)
  })
  it('DNI inválido', () => {
    expect(calcularCuil('12', 'M')).toBeNull()
  })
})

describe('Domicilio del dorso', () => {
  it('en una línea', () => {
    const texto = 'DOMICILIO: AV. INDEPENDENCIA 1234 - BANDA DEL RIO SALI - CRUZ ALTA - TUCUMAN\nLUGAR DE NACIMIENTO: TUCUMAN'
    expect(extraerDomicilio(texto)).toBe('AV. INDEPENDENCIA 1234 - BANDA DEL RIO SALI - CRUZ ALTA - TUCUMAN')
  })
  it('partido en dos líneas', () => {
    const texto = 'DOMICILIO: B° LA MILAGROSA MZA 4 CASA 12 -\nBANDA DEL RIO SALI - CRUZ ALTA\nLUGAR DE NACIMIENTO: TUCUMAN'
    expect(extraerDomicilio(texto)).toBe('B° LA MILAGROSA MZA 4 CASA 12 - BANDA DEL RIO SALI - CRUZ ALTA')
  })
  it('sin rótulo', () => {
    expect(extraerDomicilio('IDARG28123456<<<<')).toBeNull()
  })
})

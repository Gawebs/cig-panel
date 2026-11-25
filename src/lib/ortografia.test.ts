import { describe, expect, it } from 'vitest'
import { nombrePropio, oracion, soloNumeros } from './ortografia'

describe('corrección automática', () => {
  it('nombres y apellidos con mayúscula inicial y conectores en minúscula', () => {
    expect(nombrePropio('PAEZ GRACIELA DEL VALLE')).toBe('Paez Graciela del Valle')
    expect(nombrePropio('  paez   graciela  ')).toBe('Paez Graciela')
    expect(nombrePropio('de la fuente')).toBe('De la Fuente')
    expect(nombrePropio('maría-josé d\'angelo')).toBe("María-José D'Angelo")
    expect(nombrePropio('ÑANDÚ ÁLVAREZ')).toBe('Ñandú Álvarez')
  })

  it('domicilios: abreviaturas y números', () => {
    expect(nombrePropio('av. independencia 1234')).toBe('Av. Independencia 1234')
    expect(nombrePropio('B° LA MILAGROSA MZA 4 CASA 12')).toBe('B° La Milagrosa Mza 4 Casa 12')
    expect(nombrePropio('domingo garcia s/n')).toBe('Domingo Garcia S/N')
    expect(nombrePropio('banda del rio sali')).toBe('Banda del Rio Sali')
    expect(nombrePropio('barrio los pinos calle el ceibo 45')).toBe('Barrio Los Pinos Calle El Ceibo 45')
  })

  it('vínculo y ocupación: solo la primera letra', () => {
    expect(oracion('HIJO')).toBe('Hijo')
    expect(oracion('empleada doméstica')).toBe('Empleada doméstica')
    expect(oracion('Empleado de la UNT')).toBe('Empleado de la UNT')
  })

  it('DNI con puntos', () => {
    expect(soloNumeros('28.123.456')).toBe('28123456')
    expect(soloNumeros('28 123 456')).toBe('28123456')
  })
})

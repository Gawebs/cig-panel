import { describe, expect, it, vi } from 'vitest'
import { textoError } from './errores'

describe('mensajes de error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  it('los nuestros pasan tal cual', () => {
    expect(textoError({ code: 'P0001', message: 'Para devolver un expediente hay que escribir qué corregir' })).toBe('Para devolver un expediente hay que escribir qué corregir')
  })
  it('los técnicos se traducen', () => {
    expect(textoError({ code: '42501', message: 'new row violates row-level security policy for table "case_files"' })).toMatch(/^No tenés permiso/)
    expect(textoError({ code: '22007', message: 'invalid input syntax for type date: "31/02"' })).toMatch(/formato/)
    expect(textoError({ message: 'TypeError: fetch failed' })).toMatch(/conexión/)
    expect(textoError({ code: 'XX000', message: 'something odd' })).toMatch(/inesperado/)
  })
})

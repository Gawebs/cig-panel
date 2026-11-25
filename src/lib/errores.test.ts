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

describe('avisos de validación con el nombre del casillero', () => {
  it('reescribe el genérico "Demasiado grande" y respeta los propios', async () => {
    const { z } = await import('zod')
    const { mensajeValidacion } = await import('./errores')
    z.config(z.locales.es())
    const largo = z.object({ padron: z.string().max(8) }).safeParse({ padron: '123456789' })
    expect(mensajeValidacion(largo.error!)).toBe('Padrón: es demasiado largo (hasta 8 caracteres).')
    const propio = z.object({ apellido: z.string().min(1, 'Falta el apellido.') }).safeParse({ apellido: '' })
    expect(mensajeValidacion(propio.error!)).toBe('Falta el apellido.')
  })
})

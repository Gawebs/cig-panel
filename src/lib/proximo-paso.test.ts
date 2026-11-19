import { describe, expect, it } from 'vitest'
import { proximoPaso, type EntradaProximoPaso } from './proximo-paso'

const base: EntradaProximoPaso = { estado: 'en_armado', roles: ['armado'], cantidadDatosFaltantes: 0, cantidadDocumentosFaltantes: 0 }
const dato = { texto: 'Padrón del inmueble', href: '#datos-catastro', boton: 'Ir a Datos de Catastro' }
const doc = { paso: 1, titulo: 'DNI', persona: 'PEREZ Ana', href: '#req-dni' }

describe('próximo paso', () => {
  it('primero los datos, después los documentos, después enviar', () => {
    expect(proximoPaso({ ...base, datoFaltante: dato, cantidadDatosFaltantes: 3, documentoFaltante: doc, cantidadDocumentosFaltantes: 1 })).toMatchObject({
      titulo: 'Cargá: Padrón del inmueble', detalle: 'Es un dato que Catastro pide (y 2 dato(s) más).', boton: { href: '#datos-catastro' },
    })
    expect(proximoPaso({ ...base, documentoFaltante: doc, cantidadDocumentosFaltantes: 1 })).toMatchObject({ titulo: 'Paso 1: subí DNI de PEREZ Ana', boton: { href: '#req-dni' } })
    expect(proximoPaso(base)).toMatchObject({ titulo: 'Está todo cargado: envialo a revisión', boton: { href: '#acciones' } })
  })
  it('a cada rol le muestra lo suyo o que está esperando', () => {
    expect(proximoPaso({ ...base, estado: 'listo_para_revisar' })?.tono).toBe('esperar')
    expect(proximoPaso({ ...base, estado: 'listo_para_revisar', roles: ['subdireccion'] })?.tono).toBe('hacer')
    expect(proximoPaso({ ...base, estado: 'aprobado', roles: ['subdireccion'] })?.titulo).toBe('Esperando la firma de la Dirección')
    expect(proximoPaso({ ...base, estado: 'aprobado', roles: ['direccion'] })?.boton?.href).toBe('#catastro')
    expect(proximoPaso({ ...base, roles: ['consulta'] })?.tono).toBe('esperar')
  })
  it('firma completa y prórroga', () => {
    expect(proximoPaso({ ...base, estado: 'aprobado', roles: ['direccion'], firmados: 4 })?.titulo).toBe('Están los 4 firmados: marcalo como firmado')
    expect(proximoPaso({ ...base, estado: 'prorroga_pedida', roles: ['subdireccion'], prorrogaHasta: '18/12/2026' })?.titulo).toBe('Corregí lo observado y reingresalo antes del 18/12/2026')
  })
  it('terminado y cerrado', () => {
    expect(proximoPaso({ ...base, estado: 'aceptado' })?.tono).toBe('listo')
    expect(proximoPaso({ ...base, estado: 'desistido' })).toBeNull()
  })
})

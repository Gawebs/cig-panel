import { describe, expect, it } from 'vitest'
import { datosFaltantes, type ExpedienteDatos, type PersonaDatos } from './datos-obligatorios'

const persona = (p: Partial<PersonaDatos>): PersonaDatos => ({
  rol: 'solicitante', solicitante_numero: 1, apellido: 'PEREZ', nombre: 'Ana', dni: '30123456', cuil: '27-30123456-5',
  telefono: '381', correo: 'ana@gmail.com', domicilio: 'Calle 1', ciudad: 'BRS', ...p,
})
const exp = (e: Partial<ExpedienteDatos>): ExpedienteDatos => ({
  framework_id: 'ley_pierri', padron: '123', domicilio_inmueble: 'Calle 1', origen_posesion: 'compra',
  origen_posesion_detalle: null, fecha_inicio_posesion: '2005-01-01', tiene_documentacion_ipvdu: null, ...e,
})

describe('datos obligatorios', () => {
  it('completo: no falta nada', () => {
    expect(datosFaltantes(exp({}), [persona({})])).toEqual([])
  })
  it('avisa padrón, domicilio y posesión vacíos en Pierri', () => {
    const t = datosFaltantes(exp({ padron: null, domicilio_inmueble: '', origen_posesion: null, fecha_inicio_posesion: null }), [persona({})]).map((f) => f.texto)
    expect(t).toEqual(['Padrón del inmueble', 'Domicilio del inmueble', 'Origen de la posesión (compra u otro)', 'Fecha de inicio de la posesión'])
  })
  it('origen "otro" pide el detalle', () => {
    expect(datosFaltantes(exp({ origen_posesion: 'otro' }), [persona({})]).map((f) => f.texto)).toEqual(['Detalle del origen de la posesión'])
  })
  it('junta lo que falta de cada persona en un renglón', () => {
    const t = datosFaltantes(exp({}), [persona({ dni: null, cuil: '', telefono: null, correo: null }), persona({ rol: 'conyuge', cuil: null, telefono: null, domicilio: null, ciudad: null })])
    expect(t.map((f) => f.texto)).toEqual([
      'PEREZ Ana (Solicitante 1): falta DNI, CUIL, teléfono, correo',
      'PEREZ Ana (Cónyuge del solicitante 1): falta CUIL',
    ])
  })
  it('La Milagrosa pide IPVDU en vez de origen y fecha, y DNI del grupo familiar', () => {
    const t = datosFaltantes(exp({ framework_id: 'ley_5670', origen_posesion: null, fecha_inicio_posesion: null }), [persona({}), persona({ rol: 'grupo_familiar', dni: null })])
    expect(t.map((f) => f.texto)).toEqual(['PEREZ Ana (Grupo familiar del solicitante 1): falta DNI', 'Si cuenta con documentación del IPVDU (sí o no)'])
  })
  it('Pierri no controla el grupo familiar', () => {
    expect(datosFaltantes(exp({}), [persona({}), persona({ rol: 'grupo_familiar', dni: null })])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { planDeAplicacion, type ExpedienteFicha, type PersonaFicha } from './aplicar'

const hoy = new Date('2026-11-14T12:00:00')
const vacio: ExpedienteFicha = { fecha_inicio_posesion: null, origen_posesion: null, origen_posesion_detalle: null, tiene_documentacion_ipvdu: null }
const titular: PersonaFicha = {
  id: 't1', rol: 'solicitante', apellido: 'Gómez', nombre: 'Ana', ocupacion: null, telefono: null, vinculo: null, edad_declarada: null, origen_datos: {},
}

describe('planDeAplicacion', () => {
  it('llena los casilleros vacíos con lo que dijo el vecino', () => {
    const plan = planDeAplicacion({
      hoy, expediente: vacio, titular, personas: [titular],
      respuestas: {
        'titular.ocupacion': { texto: 'ama de casa', origen: 'voz' },
        'titular.telefono': { texto: '381 555 1234', origen: 'voz' },
        'casa.desde': { texto: 'desde marzo del 2005', origen: 'voz' },
        'casa.origen': { texto: 'me la dejó mi abuela', origen: 'voz' },
      },
    })
    expect(plan.titular).toMatchObject({ ocupacion: 'Ama de casa', telefono: '3815551234' })
    expect(plan.titular.origen_datos).toEqual({ ocupacion: 'voz', telefono: 'voz' })
    expect(plan.expediente).toEqual({ fecha_inicio_posesion: '2005-03-01', origen_posesion: 'otro', origen_posesion_detalle: 'Me la dejó mi abuela' })
    expect(plan.respuestas['casa.desde'].aplicado).toBe('2005-03-01')
  })

  it('no pisa un dato cargado a mano en la oficina', () => {
    const plan = planDeAplicacion({
      hoy, expediente: { ...vacio, fecha_inicio_posesion: '2004-06-15' }, titular: { ...titular, telefono: '3814000000' }, personas: [],
      respuestas: {
        'titular.telefono': { texto: '381 555 1234', origen: 'voz' },
        'casa.desde': { texto: 'desde marzo del 2005', origen: 'voz' },
      },
    })
    expect(plan.titular.telefono).toBeUndefined()
    expect(plan.expediente.fecha_inicio_posesion).toBeUndefined()
  })

  it('sí actualiza lo que el mismo relevamiento escribió antes (corrección del relevador)', () => {
    const plan = planDeAplicacion({
      hoy, expediente: { ...vacio, fecha_inicio_posesion: '2005-03-01' }, titular, personas: [],
      respuestas: { 'casa.desde': { texto: 'desde abril del 2005', origen: 'mano', aplicado: '2005-03-01' } },
    })
    expect(plan.expediente.fecha_inicio_posesion).toBe('2005-04-01')
  })

  it('crea a los familiares y después los actualiza sin duplicarlos', () => {
    const respuestas = {
      'familiar.1.nombre': { texto: 'Juan Carlos Pérez', origen: 'voz' as const },
      'familiar.1.edad': { texto: 'doce años', origen: 'voz' as const },
      'familiar.1.vinculo': { texto: 'hijo', origen: 'voz' as const },
      'familiar.2.edad': { texto: '40', origen: 'voz' as const }, // sin nombre: no se crea
    }
    const primero = planDeAplicacion({ hoy, expediente: vacio, titular, personas: [titular], respuestas })
    expect(primero.familiaresNuevos).toEqual([
      { orden: 1, apellido: 'Pérez', nombre: 'Juan Carlos', edad_declarada: 12, vinculo: 'Hijo', ocupacion: null, origen_datos: { relevamiento: 'familiar.1', apellido_nombre: 'voz', edad: 'voz', vinculo: 'voz' } },
    ])

    const creado: PersonaFicha = {
      id: 'f1', rol: 'grupo_familiar', apellido: 'Pérez', nombre: 'Juan Carlos', ocupacion: null, telefono: null,
      vinculo: 'Hijo', edad_declarada: 12, origen_datos: { relevamiento: 'familiar.1' },
    }
    const segundo = planDeAplicacion({
      hoy, expediente: vacio, titular, personas: [titular, creado],
      respuestas: { ...primero.respuestas, 'familiar.1.edad': { ...primero.respuestas['familiar.1.edad'], texto: 'trece años', origen: 'mano' } },
    })
    expect(segundo.familiaresNuevos).toEqual([])
    expect(segundo.familiaresCambios).toEqual([
      { id: 'f1', cambios: { edad_declarada: 13, origen_datos: { relevamiento: 'familiar.1', apellido_nombre: 'voz', edad: 'relevamiento', vinculo: 'voz' } } },
    ])
  })

  it('una respuesta que no se entiende no escribe nada', () => {
    const plan = planDeAplicacion({
      hoy, expediente: vacio, titular, personas: [],
      respuestas: { 'casa.desde': { texto: 'hace mucho tiempo', origen: 'voz' } },
    })
    expect(plan.expediente).toEqual({})
  })
})

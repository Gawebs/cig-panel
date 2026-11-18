import { describe, expect, it } from 'vitest'
import { cuestionario, interpretar, palabrasACifras, preguntaPorClave, separarNombre } from './cuestionario'

const p = (clave: string) => preguntaPorClave(clave)!
const hoy = new Date('2026-11-14T12:00:00')

describe('palabrasACifras', () => {
  it('convierte años y números dichos en palabras', () => {
    expect(palabrasACifras('desde el dos mil cinco')).toBe('desde el 2005')
    expect(palabrasACifras('mil novecientos noventa y ocho')).toBe('1998')
    expect(palabrasACifras('tiene doce años')).toBe('tiene 12 anos')
  })
  it('no suma cifras dichas una por una', () => {
    expect(palabrasACifras('tres ocho uno').replace(/\s/g, '')).toBe('381')
  })
})

describe('interpretar', () => {
  it('fecha con mes y año', () => {
    const r = interpretar(p('casa.desde'), 'Desde marzo del 2005, más o menos.', hoy)
    expect(r.valor).toBe('2005-03-01')
    expect(r.extra?.precision).toBe('mes')
  })
  it('fecha solo con año, en palabras o de dos cifras', () => {
    expect(interpretar(p('casa.desde'), 'Desde el dos mil ocho', hoy).valor).toBe('2008-01-01')
    expect(interpretar(p('casa.desde'), 'Vivo acá desde el 98', hoy).valor).toBe('1998-01-01')
  })
  it('fecha que no se entiende o futura queda vacía', () => {
    expect(interpretar(p('casa.desde'), 'hace mucho', hoy).valor).toBeNull()
    expect(interpretar(p('casa.desde'), 'desde el 2030', hoy).valor).toBeNull()
  })
  it('teléfono con cifras o palabras', () => {
    expect(interpretar(p('titular.telefono'), '381 555-1234', hoy).valor).toBe('3815551234')
    expect(interpretar(p('titular.telefono'), 'tres ocho uno cinco cinco cinco uno dos tres cuatro', hoy).valor).toBe('3815551234')
    expect(interpretar(p('titular.telefono'), 'no tengo', hoy).valor).toBeNull()
  })
  it('servicios: marca los que tiene y no los negados', () => {
    expect(interpretar(p('casa.servicios'), 'Tenemos agua y luz, pero gas no, y sin cloacas', hoy).valor).toEqual(['agua', 'luz'])
    expect(interpretar(p('casa.servicios'), 'Agua, luz eléctrica, gas natural y cloacas', hoy).valor).toEqual(['agua', 'luz', 'gas', 'cloacas'])
  })
  it('servicios con el texto real que devolvió el reconocedor', () => {
    expect(interpretar(p('casa.servicios'), 'tenemos agua y luz, pero gas no, y tampoco cloacas.', hoy).valor).toEqual(['agua', 'luz'])
    expect(interpretar(p('titular.telefono'), '3-8-1, 5-5-5-1-2-3-4', hoy).valor).toBe('3815551234')
    expect(interpretar(p('casa.desde'), 'vivo acá desde marzo del 2005, más o menos.', hoy).valor).toBe('2005-03-01')
  })
  it('servicios: "no tenemos gas" no marca gas', () => {
    expect(interpretar(p('casa.servicios'), 'Luz sí. No tenemos gas.', hoy).valor).toEqual(['luz'])
  })
  it('destino de la casa', () => {
    expect(interpretar(p('casa.destino'), 'Solo para vivir con mi familia', hoy).valor).toBe('vivienda')
    expect(interpretar(p('casa.destino'), 'Las dos cosas, tengo un kiosco adelante', hoy).valor).toBe('ambas')
  })
  it('mejoras', () => {
    expect(interpretar(p('casa.mejoras'), 'Le hice una pieza más, el baño y la pinté', hoy).valor).toEqual(['ampliaciones', 'sanitaria', 'pintura'])
  })
  it('origen: compra u otro con detalle', () => {
    expect(interpretar(p('casa.origen'), 'La compré con boleto', hoy).valor).toBe('compra')
    const otro = interpretar(p('casa.origen'), 'me la dejó mi abuela', hoy)
    expect(otro.valor).toBe('otro')
    expect(otro.extra?.detalle).toBe('Me la dejó mi abuela')
    expect(interpretar(p('casa.origen'), 'No la compré, la heredé', hoy).valor).toBe('otro')
  })
  it('sí o no', () => {
    const q = p('casa.ipvdu')
    expect(interpretar(q, 'Sí, tengo uno', hoy).valor).toBe(true)
    expect(interpretar(q, 'No, nada', hoy).valor).toBe(false)
    expect(interpretar(q, 'puede ser', hoy).valor).toBeNull()
  })
  it('nombre y edad de un familiar', () => {
    expect(interpretar(p('familiar.1.nombre'), 'se llama juan carlos pérez.', hoy).valor).toBe('Juan Carlos Pérez')
    expect(interpretar(p('familiar.1.edad'), 'Doce años', hoy).valor).toBe(12)
    expect(interpretar(p('familiar.1.edad'), 'ocho meses', hoy).valor).toBe(0)
  })
  it('respuesta vacía no inventa nada', () => {
    expect(interpretar(p('titular.ocupacion'), '   ', hoy).valor).toBeNull()
  })
})

describe('cuestionario', () => {
  it('la pregunta del IPVDU va solo en La Milagrosa', () => {
    expect(cuestionario('ley_pierri', 0).some((q) => q.clave === 'casa.ipvdu')).toBe(false)
    expect(cuestionario('ley_5670', 0).some((q) => q.clave === 'casa.ipvdu')).toBe(true)
  })
  it('agrega las preguntas de cada familiar antes del cierre', () => {
    const q = cuestionario('ley_pierri', 2).map((x) => x.clave)
    expect(q).toContain('familiar.2.ocupacion')
    expect(q[q.length - 1]).toBe('cierre.observaciones')
  })
  it('separa nombre y apellido', () => {
    expect(separarNombre('Juan Carlos Pérez')).toEqual({ nombre: 'Juan Carlos', apellido: 'Pérez' })
  })
})

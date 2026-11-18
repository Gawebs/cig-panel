import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { generarPdf, huellaDe } from './imprimir'
import { PLANTILLAS } from './plantillas'

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const bytes = readFileSync(`public${url}`)
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
  })
})

describe('Impresión sobre el PDF original', () => {
  it('la solicitud Pierri sale de 1 hoja, con los datos escritos', async () => {
    const p = PLANTILLAS['ley_pierri/solicitud']
    const valores = {
      fecha: '13/11/2026', 's1.apellido_nombre': 'Gómez Ana María', 's1.dni': '30111222', 's1.cuil': '27-30111222-4',
      's1.estado_civil': 'casado', 'c1.apellido_nombre': 'Pérez Juan Carlos', padron: '471234', 'ubicacion.interior': 'X',
    }
    const bytes = await generarPdf(p, valores)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    if (process.env.GUARDAR_PDF) {
      mkdirSync(process.env.GUARDAR_PDF, { recursive: true })
      writeFileSync(`${process.env.GUARDAR_PDF}/solicitud.pdf`, bytes)
      writeFileSync(`${process.env.GUARDAR_PDF}/ddjj.pdf`, await generarPdf(PLANTILLAS['ley_pierri/ddjj'], {
        ...valores, domicilio_inmueble: 'Av. Independencia 1234', departamento: 'Cruz Alta', 'origen.compra': 'X', fecha_inicio_posesion: '01/03/2004',
      }))
    }
  })

  it('el relevamiento social sale de 4 hojas, con casillas, renglones, croquis y fotos', async () => {
    const p = PLANTILLAS['ley_pierri/relevamiento_social']
    // Un valor de prueba en cada casillero, para ver la alineación completa.
    const valores: Record<string, string> = Object.fromEntries(p.campos.map((c) => [c.id, c.etiqueta.split(':').pop()!.trim().slice(0, 18)]))
    valores.observaciones_inmueble = 'Vivienda de mampostería con techo de chapa. '.repeat(12)
    valores['s1.estado_civil'] = 'casado'
    for (const k of p.casillas) valores[k.id] = 'X'
    // PDF de prueba: 4 hojas de fotos y 1 de croquis
    const hojas = async (n: number, color: [number, number, number]) => {
      const d = await PDFDocument.create()
      const { rgb } = await import('pdf-lib')
      for (let i = 0; i < n; i++) d.addPage([400, 300]).drawRectangle({ x: 0, y: 0, width: 400, height: 300, color: rgb(...color) })
      return (await d.save()).buffer as ArrayBuffer
    }
    const bytes = await generarPdf(p, valores, { fotos_inmueble: await hojas(4, [0.2, 0.5, 0.8]), croquis: await hojas(1, [0.9, 0.9, 0.6]) })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(4)
    if (process.env.GUARDAR_PDF) writeFileSync(`${process.env.GUARDAR_PDF}/relevamiento_social.pdf`, bytes)
  })

  it.each([
    ['ley_5670/solicitud', 1], ['ley_5670/ddjj', 2], ['ley_8162/solicitud', 2], ['ley_8162/ddjj', 2], ['ley_pierri/anexo_i', 1],
  ])('%s sale con sus %i hoja(s) y todos los casilleros', async (clave, hojas) => {
    const p = PLANTILLAS[clave]
    const valores: Record<string, string> = Object.fromEntries(p.campos.map((c) => [c.id, c.etiqueta.split(':').pop()!.trim().slice(0, 16)]))
    for (const c of p.campos) if (c.partes) valores[c.id] = '14/11/2026'
    for (const c of p.campos) if (c.control === 'estado_civil') valores[c.id] = 'casado'
    for (const c of p.campos) if (c.fuente.tipo === 'fijo') valores[c.id] = c.fuente.valor
    if (valores.observaciones !== undefined) valores.observaciones = 'Casa de material con frente sobre calle de tierra. '.repeat(8)
    for (const k of p.casillas) valores[k.id] = 'X'
    const bytes = await generarPdf(p, valores)
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(hojas)
    if (process.env.GUARDAR_PDF) writeFileSync(`${process.env.GUARDAR_PDF}/${clave.replace('/', '-')}.pdf`, bytes)
  })

  it('la huella cambia si cambia un dato', () => {
    expect(huellaDe({ a: '1', b: '2' })).toBe(huellaDe({ b: '2', a: '1' }))
    expect(huellaDe({ a: '1' })).not.toBe(huellaDe({ a: '2' }))
  })
})

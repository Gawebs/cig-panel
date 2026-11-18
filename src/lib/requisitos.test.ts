import { describe, expect, it } from 'vitest'
import pierri from '../../supabase/marcos/ley_pierri.json'
import milagrosa from '../../supabase/marcos/ley_5670.json'
import menem from '../../supabase/marcos/ley_8162.json'
import { aniosDePrueba, armarChecklist, tiposDePrueba, type MarcoConfig, type PersonaExpediente } from './requisitos'

const configPierri = pierri.config as MarcoConfig
const configMilagrosa = milagrosa.config as MarcoConfig
const configMenem = menem.config as MarcoConfig
const apertura = new Date(2026, 10, 13)

const titular = (estado_civil: PersonaExpediente['estado_civil']): PersonaExpediente => ({
  id: 'p1', rol: 'solicitante', solicitante_numero: 1, apellido: 'Rodríguez', nombre: 'Martín', estado_civil,
})
const conyuge: PersonaExpediente = {
  id: 'p2', rol: 'conyuge', solicitante_numero: 1, apellido: 'Gómez', nombre: 'Ana', estado_civil: 'casado',
}
const hijo: PersonaExpediente = {
  id: 'p3', rol: 'grupo_familiar', solicitante_numero: 1, apellido: 'Rodríguez', nombre: 'Daniel', estado_civil: null,
}

const claves = (c: ReturnType<typeof armarChecklist>, paso: number) =>
  c.pasos[paso - 1].items.map((i) => i.id)

describe('Ley Pierri, paso 1', () => {
  it('soltero: sin actas de estado civil, con actas de nacimiento propias y de los padres', () => {
    const c = armarChecklist({ config: configPierri, personas: [titular('soltero')], documentos: [], fechaApertura: apertura })
    expect(claves(c, 1)).toEqual([
      'formulario_solicitud', 'ddjj', 'dni:p1', 'cuil:p1', 'acta_nacimiento:p1', 'acta_nacimiento_padres:p1',
    ])
  })

  it('casado: pide acta de matrimonio y los documentos del cónyuge', () => {
    const c = armarChecklist({ config: configPierri, personas: [titular('casado'), conyuge], documentos: [], fechaApertura: apertura })
    const paso1 = claves(c, 1)
    expect(paso1).toContain('acta_matrimonio:p1')
    expect(paso1).toContain('dni:p2')
    expect(paso1).toContain('acta_nacimiento_padres:p2')
    expect(paso1).not.toContain('acta_defuncion:p1')
  })

  it('casado sin cónyuge cargado: avisa', () => {
    const c = armarChecklist({ config: configPierri, personas: [titular('casado')], documentos: [], fechaApertura: apertura })
    expect(c.avisos.join(' ')).toMatch(/falta cargar al cónyuge/)
    expect(c.completo).toBe(false)
  })

  it('viudo: pide matrimonio y defunción', () => {
    const c = armarChecklist({ config: configPierri, personas: [titular('viudo')], documentos: [], fechaApertura: apertura })
    expect(claves(c, 1)).toEqual(expect.arrayContaining(['acta_matrimonio:p1', 'acta_defuncion:p1']))
  })

  it('más de 2 solicitantes: pide el Anexo I', () => {
    const extra = (n: number): PersonaExpediente => ({ ...titular('soltero'), id: `s${n}`, solicitante_numero: n })
    const c = armarChecklist({ config: configPierri, personas: [extra(1), extra(2), extra(3)], documentos: [], fechaApertura: apertura })
    expect(claves(c, 1)).toContain('anexo_i')
  })

  it('sin estado civil: avisa y no inventa actas', () => {
    const c = armarChecklist({ config: configPierri, personas: [titular(null)], documentos: [], fechaApertura: apertura })
    expect(c.avisos.join(' ')).toMatch(/estado civil/)
    expect(claves(c, 1)).not.toContain('acta_matrimonio:p1')
  })
})

describe('La Milagrosa y Menem: grupo familiar, sin actas de los padres', () => {
  it('La Milagrosa pide DNI y acta del grupo familiar y no las de los padres', () => {
    const c = armarChecklist({ config: configMilagrosa, personas: [titular('soltero'), hijo], documentos: [], fechaApertura: apertura })
    const paso1 = claves(c, 1)
    expect(paso1).toContain('dni:p3')
    expect(paso1).toContain('acta_nacimiento:p3')
    expect(paso1.some((k) => k.startsWith('acta_nacimiento_padres'))).toBe(false)
  })

  it('avisa si falta el grupo familiar', () => {
    const c = armarChecklist({ config: configMenem, personas: [titular('soltero')], documentos: [], fechaApertura: apertura })
    expect(c.avisos.join(' ')).toMatch(/grupo familiar/)
  })
})

describe('Pruebas de posesión por año', () => {
  it('Pierri: 2006, 2007, 2008 y el año en curso', () => {
    expect(aniosDePrueba(configPierri.pruebas_posesion, apertura)).toEqual([2006, 2007, 2008, 2026])
  })

  it('La Milagrosa: los 3 años anteriores al inicio, 2 pruebas por año', () => {
    expect(aniosDePrueba(configMilagrosa.pruebas_posesion, apertura)).toEqual([2023, 2024, 2025])
    const docs = [
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2024 },
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2024 },
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2023 },
    ]
    const c = armarChecklist({ config: configMilagrosa, personas: [titular('soltero'), hijo], documentos: docs, fechaApertura: apertura })
    const paso3 = c.pasos[2].items
    expect(paso3.find((i) => i.anio === 2024)?.completo).toBe(true)
    expect(paso3.find((i) => i.anio === 2023)?.completo).toBe(false)
    expect(paso3.find((i) => i.id === 'certificado_residencia_policial')).toBeDefined()
    expect(c.pasos[2].estado).toBe('incompleto')
  })

  it('cuando se piden 2 por año, tienen que ser de distinto tipo', () => {
    const docs = [
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2024, tipo_prueba: 'edet' },
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2024, tipo_prueba: 'edet' },
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2025, tipo_prueba: 'edet' },
      { paso: 3, requisito: 'prueba_posesion', person_id: null, anio: 2025, tipo_prueba: 'sat' },
    ]
    const c = armarChecklist({ config: configMilagrosa, personas: [titular('soltero'), hijo], documentos: docs, fechaApertura: apertura })
    const de = (anio: number) => c.pasos[2].items.find((i) => i.anio === anio)!
    expect(de(2024).completo).toBe(false)
    expect(de(2024).cantidadCargada).toBe(1)
    expect(de(2024).aviso).toMatch(/mismo tipo/)
    expect(de(2025).completo).toBe(true)
  })

  it('"servicio_impuesto" se abre en cada servicio e impuesto', () => {
    expect(tiposDePrueba(['servicio_impuesto', 'boleto_compraventa'])).toEqual(['edet', 'gasnor', 'sat', 'dgr', 'tasa_municipal', 'otro_servicio', 'boleto_compraventa'])
  })

  it('Menem: 5 años antes de 2003 y 2 pruebas del año en curso', () => {
    expect(aniosDePrueba(configMenem.pruebas_posesion, apertura)).toEqual([1998, 1999, 2000, 2001, 2002, 2026])
    const c = armarChecklist({ config: configMenem, personas: [titular('soltero'), hijo], documentos: [], fechaApertura: apertura })
    expect(c.pasos[2].items.find((i) => i.anio === 2026)?.cantidadMinima).toBe(2)
  })
})

describe('Estado general', () => {
  it('un expediente con todo cargado queda completo', () => {
    const personas = [titular('soltero')]
    const vacio = armarChecklist({ config: configPierri, personas, documentos: [], fechaApertura: apertura })
    const documentos = vacio.faltantes.flatMap((i) =>
      Array.from({ length: i.cantidadMinima }, () => ({
        paso: i.paso, requisito: i.requisito, person_id: i.personaId ?? null, anio: i.anio ?? null,
      })),
    )
    const lleno = armarChecklist({ config: configPierri, personas, documentos, fechaApertura: apertura })
    expect(lleno.completo).toBe(true)
    expect(lleno.pasos.every((p) => p.estado === 'completo')).toBe(true)
  })
})

describe('Coordenadas escritas en la ficha', () => {
  const item = (coordenadas?: string | null) =>
    armarChecklist({ config: configPierri, personas: [titular('soltero')], documentos: [], fechaApertura: apertura, coordenadas }).pasos.flatMap((p) => p.items).find((i) => i.requisito === 'coordenadas')!
  it('con coordenadas válidas el requisito queda cumplido sin subir archivo', () => {
    const i = item('-26.832206,-65.195481')
    expect(i.completo).toBe(true)
    expect(i.deFicha).toBe('-26.832206,-65.195481')
  })
  it('sin coordenadas o mal escritas sigue faltando', () => {
    expect(item(null).completo).toBe(false)
    expect(item('frente a la plaza').completo).toBe(false)
  })
})

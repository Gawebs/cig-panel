import { describe, expect, it } from 'vitest'
import { interpretarTextoCatastro } from './catastro-lectura'

// Texto como queda al copiar las pantallas del Acceso GIS (datos inventados).
const PARCELARIOS = `Datos Parcelarios Generales
Número de Padrón: 474111
CATEGORÍA PARCELARIA
1- URBANO C.S.M.P.
MUNICIPIO
MUNICIPALIDAD BANDA DEL RIO SALI
CARÁCTER PARCELARIO
No Constituida
FECHA DE CREACIÓN
03/01/1980
DEPARTAMENTO
06- CRUZ ALTA
CIRCUNSCRIPCIÓN
I
SECCIÓN
33
LÁMINA
77
MANZANA
62
MANZANA PARCELA
1209-A
PARCELA
12
SUBPARCELA
0
CÓDIGO DE ORIGEN
0- NO DETERMINADO
MATRÍCULA CATASTRAL
1541B
ORDEN CATASTRAL
6881
PADRONES ORÍGENES
474501 -`

const DOMINIO = `Antecedentes de Dominio
Padrón de Referencia: 474111
PEREZ JUAN
MATRÍCULA
A -11846
LIBRO / FOLIO / SERIE
12 / 345 / B
DOCUMENTO
_: 20111222
CUIT / CUIL
20-20111222-3`

describe('Texto copiado de Catastro', () => {
  it('Datos Parcelarios Generales', () => {
    expect(interpretarTextoCatastro(PARCELARIOS)).toEqual({
      padron: '474111', circ: 'I', secc: '33', mzna: '62', parcela: '12', matricula: '1541B', orden: '6881',
    })
  })
  it('Antecedentes de Dominio', () => {
    expect(interpretarTextoCatastro(DOMINIO)).toEqual({
      padron: '474111', antecedente_dominio: 'A-11846', libro: '12', folio: '345', serie: 'B',
    })
  })
  it('libro, folio y serie vacíos', () => {
    const r = interpretarTextoCatastro('MATRÍCULA\nA -11846\nLIBRO / FOLIO / SERIE\n/ /\nDOCUMENTO\n1')
    expect(r).toEqual({ antecedente_dominio: 'A-11846' })
  })
  it('rótulo sin valor no toma el rótulo siguiente', () => {
    expect(interpretarTextoCatastro('SECCIÓN\nLÁMINA\n77')).toEqual({})
  })
  it('texto que no es de Catastro', () => {
    expect(interpretarTextoCatastro('hola, esto no es nada')).toEqual({})
  })
})

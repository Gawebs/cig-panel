/**
 * Lectura del texto copiado de las pantallas del Acceso GIS de Catastro (Ctrl+A, Ctrl+C y pegar en el sistema).
 * Pantallas: "Datos Parcelarios Generales" y "Antecedentes de Dominio". Al copiarlas, cada rótulo queda
 * en una línea y su valor en la siguiente. Función pura, sin dependencias del navegador.
 */

export type ClaveLectura =
  | 'padron' | 'circ' | 'secc' | 'mzna' | 'parcela' | 'matricula' | 'orden'
  | 'antecedente_dominio' | 'libro' | 'folio' | 'serie'

export type LecturaCatastro = Partial<Record<ClaveLectura, string>>

export const ETIQUETAS_LECTURA: Record<ClaveLectura, string> = {
  padron: 'Padrón', circ: 'Circunscripción', secc: 'Sección', mzna: 'Manzana', parcela: 'Parcela',
  matricula: 'Matrícula', orden: 'Orden', antecedente_dominio: 'Antecedente de dominio',
  libro: 'Libro', folio: 'Folio', serie: 'Serie',
}

function normal(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z/]+/g, ' ').trim()
}

// Rótulo de Catastro (normalizado) → dato de la ficha. Los que no se usan igual cuentan como rótulo,
// para no tomarlos como valor de otro. La "MATRICULA" sola es la del dominio (pantalla de Antecedentes).
const ROTULOS: Record<string, ClaveLectura | 'libro_folio_serie' | null> = {
  'CIRCUNSCRIPCION': 'circ',
  'SECCION': 'secc',
  'MANZANA': 'mzna',
  'PARCELA': 'parcela',
  'MATRICULA CATASTRAL': 'matricula',
  'ORDEN CATASTRAL': 'orden',
  'MATRICULA': 'antecedente_dominio',
  'LIBRO / FOLIO / SERIE': 'libro_folio_serie',
  'CATEGORIA PARCELARIA': null, 'MUNICIPIO': null, 'CARACTER PARCELARIO': null, 'FECHA DE CREACION': null,
  'DEPARTAMENTO': null, 'LAMINA': null, 'MANZANA PARCELA': null, 'SUBPARCELA': null, 'CODIGO DE ORIGEN': null,
  'PADRONES ORIGENES': null, 'DOCUMENTO': null, 'CUIT / CUIL': null, 'PERSONA': null, 'PORCENTAJE': null,
  'TIPO DOMINIO': null, 'ACTUALIZACION': null,
}

const esRotulo = (linea: string) => normal(linea).replace(/\s*\/\s*/g, ' / ') in ROTULOS

function limpiar(clave: ClaveLectura, valor: string): string | null {
  let v = valor.replace(/\s+/g, ' ').trim()
  if (clave === 'orden') v = v.replace(/\D/g, '')
  else if (clave === 'antecedente_dominio') v = v.replace(/\s*-\s*/g, '-')
  else v = v.replace(/^[-:.,;\s]+|[-:.,;\s]+$/g, '')
  return v && /[\p{L}\d]/u.test(v) ? v.slice(0, 60) : null
}

/** Busca los datos de Catastro en el texto pegado. Devuelve solo lo que encontró. */
export function interpretarTextoCatastro(texto: string): LecturaCatastro {
  const salida: LecturaCatastro = {}
  const padron = texto.match(/(?:N[uú]mero de Padr[oó]n|Padr[oó]n de Referencia)\s*:?\s*(\d{1,12})/i)
  if (padron) salida.padron = padron[1]

  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim()).filter(Boolean)
  for (let i = 0; i < lineas.length - 1; i++) {
    const destino = ROTULOS[normal(lineas[i]).replace(/\s*\/\s*/g, ' / ')]
    if (!destino) continue
    const valor = lineas[i + 1]
    if (esRotulo(valor)) continue

    if (destino === 'libro_folio_serie') {
      const partes = valor.split('/').map((x) => x.trim())
      ;(['libro', 'folio', 'serie'] as const).forEach((k, j) => {
        const v = partes[j] ? limpiar(k, partes[j]) : null
        if (v && !salida[k]) salida[k] = v
      })
      continue
    }
    const v = limpiar(destino, valor)
    if (v && !salida[destino]) salida[destino] = v
  }
  return salida
}

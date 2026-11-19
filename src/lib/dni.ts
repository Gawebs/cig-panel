/**
 * Lectura de datos del DNI argentino.
 * - Frente: código de barras PDF417 (formato de tarjeta desde 2012 y formato anterior que empieza con "@").
 * - Dorso: el domicilio está impreso; se obtiene con el lector de texto y se limpia acá.
 * Funciones puras, sin dependencias del navegador.
 */

export interface DatosDni {
  apellido: string
  nombre: string
  dni: string
  sexo: 'F' | 'M' | 'X'
  fechaNacimiento: string | null // AAAA-MM-DD
  ejemplar: string | null
  tramite: string | null
}

function titulo(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())
}

function fechaIso(ddmmaaaa: string | undefined): string | null {
  const m = ddmmaaaa?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function sexo(valor: string | undefined): DatosDni['sexo'] {
  const v = valor?.trim().toUpperCase()
  return v === 'F' ? 'F' : v === 'X' ? 'X' : 'M'
}

/** Interpreta el texto del código PDF417 del frente del DNI. Devuelve null si no lo reconoce. */
export function interpretarCodigoDni(texto: string): DatosDni | null {
  const crudo = texto.replace(/\r?\n/g, '').trim()
  const partes = crudo.split('@')

  // Formato anterior: @DNI@EJEMPLAR@?@APELLIDO@NOMBRES@NACIONALIDAD@NACIMIENTO@SEXO@EMISION@TRAMITE...
  if (crudo.startsWith('@') && partes.length >= 11) {
    const dni = partes[1].replace(/\D/g, '')
    if (!/^\d{7,8}$/.test(dni)) return null
    return {
      dni,
      ejemplar: partes[2].trim() || null,
      apellido: titulo(partes[4]),
      nombre: titulo(partes[5]),
      fechaNacimiento: fechaIso(partes[7]),
      sexo: sexo(partes[8]),
      tramite: partes[10].replace(/\D/g, '') || null,
    }
  }

  // Formato tarjeta: TRAMITE@APELLIDO@NOMBRES@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISION@...
  if (partes.length >= 8) {
    const dni = partes[4].replace(/\D/g, '')
    if (!/^\d{7,8}$/.test(dni)) return null
    return {
      tramite: partes[0].replace(/\D/g, '') || null,
      apellido: titulo(partes[1]),
      nombre: titulo(partes[2]),
      sexo: sexo(partes[3]),
      dni,
      ejemplar: partes[5].trim() || null,
      fechaNacimiento: fechaIso(partes[6]),
    }
  }

  return null
}

/**
 * CUIL calculado a partir del DNI y el sexo, con el algoritmo de AFIP/ARCA.
 * Es una ayuda: la constancia de CUIL es la que vale y siempre se confirma.
 */
export function calcularCuil(dni: string, sexoPersona: DatosDni['sexo']): string | null {
  const numero = dni.replace(/\D/g, '')
  if (!/^\d{7,8}$/.test(numero)) return null
  const base = numero.padStart(8, '0')
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

  const verificador = (prefijo: string) => {
    const digitos = (prefijo + base).split('').map(Number)
    const suma = digitos.reduce((acc, d, i) => acc + d * pesos[i], 0)
    const resto = 11 - (suma % 11)
    return resto === 11 ? 0 : resto
  }

  let prefijo = sexoPersona === 'F' ? '27' : '20'
  let digito = verificador(prefijo)
  if (digito === 10) {
    prefijo = '23'
    digito = sexoPersona === 'F' ? 4 : 9
  }
  return `${prefijo}-${base}-${digito}`
}

const OTRO_ROTULO = /(LUGAR|NACIM|CUIL|MINISTR|FIRMA|PULGAR|IDARG|REGISTRO|NACIONAL|REPUBLICA|PERSONAS)/i

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return fila[b.length]
}

// El lector de texto confunde letras parecidas: se llevan a una sola forma antes de comparar.
function normalizarRotulo(palabra: string): string {
  return palabra.toUpperCase().replace(/0/g, 'O').replace(/[1L|!Í]/g, 'I').replace(/G/g, 'C').replace(/[^A-Z]/g, '')
}

/** Posición donde termina el rótulo "DOMICILIO" en la línea (tolera errores de lectura), o -1. */
function finDelRotulo(linea: string): number {
  for (const m of linea.matchAll(/[\p{L}0-9|!]{6,12}/gu)) {
    const palabra = normalizarRotulo(m[0])
    if (palabra.length >= 6 && distancia(palabra, 'DOMICIIIO') <= 2) return m.index! + m[0].length
  }
  return -1
}

function limpiar(valor: string): string {
  return valor
    .replace(/^[\s:.;,'"`´-]+/, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/[\s-]+$/, '')
    .trim()
}

/** Busca el domicilio en el texto leído del dorso del DNI. */
export function extraerDomicilio(textoDorso: string): string | null {
  const lineas = textoDorso
    .split(/\r?\n/)
    .map((l) => l.replace(/[_~]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (let i = 0; i < lineas.length; i++) {
    const fin = finDelRotulo(lineas[i])
    if (fin === -1) continue
    let valor = lineas[i].slice(fin).replace(/\|/g, ' ')
    // Si el valor sigue en la línea de abajo (o el rótulo quedó solo), se une.
    const siguiente = lineas[i + 1]
    if (siguiente && !OTRO_ROTULO.test(siguiente) && limpiar(valor).length < 60) {
      valor = `${valor} ${siguiente}`
    }
    valor = limpiar(valor)
    if (valor.length >= 5) return valor
  }

  // Sin rótulo legible: la línea con forma de domicilio ("CALLE 123 - LOCALIDAD - DEPTO - PROVINCIA").
  const candidata = lineas.find(
    (l) => !OTRO_ROTULO.test(l) && /\d/.test(l) && (l.match(/\s-\s/g)?.length ?? 0) >= 2,
  )
  return candidata ? limpiar(candidata.replace(/\|/g, ' ')) : null
}

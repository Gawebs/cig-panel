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

// Localidades que suelen aparecer en los DNI de la zona (Cruz Alta y Gran San Miguel de Tucumán).
const LOCALIDADES_CONOCIDAS = [
  'BANDA DEL RÍO SALÍ', 'LASTENIA', 'ALDERETES', 'SAN MIGUEL DE TUCUMÁN', 'YERBA BUENA', 'LAS TALITAS',
  'TAFÍ VIEJO', 'COLOMBRES', 'LOS RALOS', 'RANCHILLOS', 'DELFÍN GALLO', 'EL BRACHO', 'LA FLORIDA',
  'LOS PÉREZ', 'SAN ANDRÉS', 'EL CHAÑAR', 'LULES', 'FAMAILLÁ', 'CEVIL REDONDO', 'EL MANANTIAL',
]

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/**
 * El dorso del DNI trae "CALLE 123 - BARRIO - LOCALIDAD - DEPARTAMENTO - PROVINCIA" (el lector a veces
 * pierde algún guion). La solicitud de Catastro pide solo calle y número en "Domicilio" y la localidad en
 * "Ciudad". Si no se reconoce la forma, devuelve el texto como vino y la ciudad vacía.
 */
export function separarDomicilio(domicilio: string, localidades: string[] = []): { calle: string; ciudad: string | null } {
  const texto = domicilio.replace(/\s+/g, ' ').trim()
  const partes = texto.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  // Calle y número: hasta el primer número que tenga algo escrito antes ("25 DE MAYO 120" → el 120).
  const calle = partes[0].match(/^(.+?\s\d{1,5}(?:\s?[A-Z](?=\s|$))?)(?=\s|$)/)?.[1] ?? null
  if (!calle) return { calle: texto, ciudad: null }

  let ciudad: string | null = null
  if (partes.length >= 4) ciudad = partes[partes.length - 3]
  // El nombre de la localidad, buscado en lo que sigue a la calle (sin departamento ni provincia).
  const resto = sinTildes([partes[0].slice(calle.length), ...partes.slice(1, Math.max(1, partes.length - 2))].join(' '))
  const conocida = [...localidades, ...LOCALIDADES_CONOCIDAS].find((l) => resto.includes(sinTildes(l)))
  if (conocida && (!ciudad || sinTildes(ciudad).includes(sinTildes(conocida)))) ciudad = conocida.toUpperCase()
  return { calle: calle.trim(), ciudad: ciudad?.replace(/^(B[º°*O.]|BARRIO)\s.*$/i, '').trim() || null }
}

/**
 * DNI para mostrar o imprimir: con puntos ("28123456" → "28.123.456").
 * En la base se guarda solo con números (así se comparan repetidos y se lee el código de barras).
 */
export function formatoDni(dni: string | null | undefined): string {
  const limpio = (dni ?? '').replace(/[\s.\-]/g, '')
  if (!/^\d{7,8}$/.test(limpio)) return dni ?? ''
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * CUIL escrito de cualquier forma ("20123456783", "20 12345678 3", "20.12345678.3") → "20-12345678-3".
 * Si no tiene 10 u 11 números se devuelve como vino, para que la validación avise.
 */
export function normalizarCuil(cuil: string): string {
  const numeros = cuil.replace(/\D/g, '')
  if (numeros.length === 11) return `${numeros.slice(0, 2)}-${numeros.slice(2, 10)}-${numeros.slice(10)}`
  if (numeros.length === 10) return `${numeros.slice(0, 2)}-${numeros.slice(2, 9)}-${numeros.slice(9)}`
  return cuil.trim()
}

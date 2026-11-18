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

/** Busca el domicilio en el texto leído del dorso del DNI. */
export function extraerDomicilio(textoDorso: string): string | null {
  const lineas = textoDorso
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const i = lineas.findIndex((l) => /DOMICILIO/i.test(l))
  if (i === -1) return null

  let valor = lineas[i].replace(/.*DOMICILIO\s*[:.;]?\s*/i, '')
  // Si el valor sigue en la línea de abajo (y no es otro rótulo), se une.
  const siguiente = lineas[i + 1]
  if (siguiente && !/(LUGAR|NACIMIENTO|CUIL|MINISTRO|FIRMA|PULGAR|IDARG)/i.test(siguiente) && valor.length < 60) {
    valor = `${valor} ${siguiente}`.trim()
  }
  valor = valor.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim()
  return valor.length >= 5 ? valor : null
}

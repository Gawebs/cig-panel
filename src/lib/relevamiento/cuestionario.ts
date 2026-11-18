/**
 * Cuestionario de la entrevista del relevamiento social y cómo se interpreta cada respuesta.
 *
 * El relevador lee la pregunta tal como está, graba la respuesta del vecino y pasa a la siguiente.
 * El reconocimiento de voz devuelve texto; acá se convierte ese texto en el dato de la ficha
 * (un año, un teléfono, una casilla marcada). Si no se entiende, queda vacío para completar a mano:
 * es preferible un casillero vacío a un dato equivocado.
 *
 * Funciones puras, con pruebas en cuestionario.test.ts.
 */

export type Destino =
  | { tipo: 'titular'; campo: 'ocupacion' | 'telefono' }
  | { tipo: 'familiar'; campo: 'nombre' | 'edad' | 'vinculo' | 'ocupacion' }
  | { tipo: 'expediente'; campo: 'fecha_inicio_posesion' | 'origen_posesion' | 'tiene_documentacion_ipvdu' }
  | { tipo: 'observacion'; campo: 'destino' | 'servicios' | 'mejoras' }
  | { tipo: 'nota' }

export type TipoPregunta = 'texto' | 'telefono' | 'fecha' | 'opcion' | 'varias' | 'si_no' | 'edad' | 'nombre' | 'origen'

export interface Opcion {
  valor: string
  etiqueta: string
  /** Palabras que, dichas por el vecino, eligen esta opción (sin tildes, en minúscula). */
  dice: string[]
}

export interface Pregunta {
  clave: string
  texto: string
  ayuda?: string
  tipo: TipoPregunta
  opciones?: Opcion[]
  destino: Destino
  /** Solo para estas leyes. Sin dato: todas. */
  leyes?: string[]
}

export const SERVICIOS: Opcion[] = [
  { valor: 'agua', etiqueta: 'Agua', dice: ['agua'] },
  { valor: 'luz', etiqueta: 'Luz eléctrica', dice: ['luz', 'electricidad', 'electrica'] },
  { valor: 'gas', etiqueta: 'Gas natural', dice: ['gas'] },
  { valor: 'cloacas', etiqueta: 'Cloacas', dice: ['cloaca', 'cloacas'] },
]

export const MEJORAS: Opcion[] = [
  { valor: 'ampliaciones', etiqueta: 'Ampliaciones', dice: ['ampli', 'pieza', 'habitacion', 'cuarto', 'agrand'] },
  { valor: 'sanitaria', etiqueta: 'Instalación sanitaria', dice: ['bano', 'sanitari', 'inodoro', 'cañeria', 'caneria'] },
  { valor: 'revoque', etiqueta: 'Revoque', dice: ['revoque', 'revoc', 'revoq'] },
  { valor: 'pisos', etiqueta: 'Pisos', dice: ['piso', 'ceramic', 'contrapiso'] },
  { valor: 'cielorraso', etiqueta: 'Cielorraso', dice: ['cielorraso', 'cielo raso', 'cieloraso', 'techo'] },
  { valor: 'pintura', etiqueta: 'Pintura', dice: ['pint'] },
]

export const DESTINOS: Opcion[] = [
  { valor: 'ambas', etiqueta: 'Ambas', dice: ['las dos', 'ambas', 'los dos', 'tambien'] },
  { valor: 'comercio', etiqueta: 'Comercio', dice: ['comercio', 'negocio', 'kiosco', 'quiosco', 'almacen', 'despensa', 'local'] },
  { valor: 'vivienda', etiqueta: 'Vivienda', dice: ['vivir', 'vivienda', 'vivo', 'vivimos', 'casa', 'familia'] },
]

export const PREGUNTAS_TITULAR: Pregunta[] = [
  { clave: 'titular.ocupacion', texto: '¿A qué se dedica usted?', tipo: 'texto', destino: { tipo: 'titular', campo: 'ocupacion' } },
  { clave: 'titular.telefono', texto: '¿Cuál es su número de teléfono?', ayuda: 'Que lo diga número por número.', tipo: 'telefono', destino: { tipo: 'titular', campo: 'telefono' } },
  { clave: 'casa.desde', texto: '¿Desde qué mes y año vive en esta casa?', tipo: 'fecha', destino: { tipo: 'expediente', campo: 'fecha_inicio_posesion' } },
  { clave: 'casa.origen', texto: '¿Cómo llegó a esta casa? ¿La compró o fue de otra forma?', ayuda: 'Si no la compró, que cuente cómo.', tipo: 'origen', destino: { tipo: 'expediente', campo: 'origen_posesion' } },
  { clave: 'casa.destino', texto: '¿La casa la usa solo para vivir, para un negocio, o para las dos cosas?', tipo: 'opcion', opciones: DESTINOS, destino: { tipo: 'observacion', campo: 'destino' } },
  { clave: 'casa.servicios', texto: '¿Qué servicios tiene la casa: agua, luz, gas natural, cloacas?', tipo: 'varias', opciones: SERVICIOS, destino: { tipo: 'observacion', campo: 'servicios' } },
  { clave: 'casa.mejoras', texto: '¿Qué arreglos o mejoras le hizo a la casa? Por ejemplo una pieza más, el baño, revoque, pisos, cielorraso o pintura.', tipo: 'varias', opciones: MEJORAS, destino: { tipo: 'observacion', campo: 'mejoras' } },
  { clave: 'casa.ipvdu', texto: '¿Tiene algún papel del Instituto de la Vivienda, el IPVDU?', tipo: 'si_no', destino: { tipo: 'expediente', campo: 'tiene_documentacion_ipvdu' }, leyes: ['ley_5670'] },
]

/** Preguntas por cada persona que vive con el titular. La clave lleva el número de persona. */
export function preguntasFamiliar(n: number): Pregunta[] {
  return [
    { clave: `familiar.${n}.nombre`, texto: '¿Cómo se llama? Nombre y apellido.', tipo: 'nombre', destino: { tipo: 'familiar', campo: 'nombre' } },
    { clave: `familiar.${n}.edad`, texto: '¿Qué edad tiene?', tipo: 'edad', destino: { tipo: 'familiar', campo: 'edad' } },
    { clave: `familiar.${n}.vinculo`, texto: '¿Qué es de usted? Hijo, pareja, nieto…', tipo: 'texto', destino: { tipo: 'familiar', campo: 'vinculo' } },
    { clave: `familiar.${n}.ocupacion`, texto: '¿A qué se dedica? Si estudia, trabaja o está en la casa.', tipo: 'texto', destino: { tipo: 'familiar', campo: 'ocupacion' } },
  ]
}

export const PREGUNTA_CIERRE: Pregunta = {
  clave: 'cierre.observaciones', texto: '¿Quiere agregar algo más sobre la casa o su situación?', tipo: 'texto', destino: { tipo: 'nota' },
}

/** Orden completo de la entrevista para una ley y una cantidad de familiares. */
export function cuestionario(ley: string, familiares: number): Pregunta[] {
  const titular = PREGUNTAS_TITULAR.filter((p) => !p.leyes || p.leyes.includes(ley))
  const familia = Array.from({ length: familiares }, (_, i) => preguntasFamiliar(i + 1)).flat()
  return [...titular, ...familia, PREGUNTA_CIERRE]
}

export function preguntaPorClave(clave: string): Pregunta | null {
  const familiar = /^familiar\.(\d+)\./.exec(clave)
  if (familiar) return preguntasFamiliar(Number(familiar[1])).find((p) => p.clave === clave) ?? null
  return [...PREGUNTAS_TITULAR, PREGUNTA_CIERRE].find((p) => p.clave === clave) ?? null
}

// ───────────────────────── Interpretar lo que dijo el vecino ─────────────────────────

export type Valor = string | string[] | boolean | number | null

export interface Interpretacion {
  valor: Valor
  /** Texto para mostrar: el valor tal como queda en el formulario. */
  muestra: string
  /** Datos de más: el detalle del origen, la precisión de la fecha. */
  extra?: Record<string, string>
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
}

/** Convierte números dichos en palabras a cifras: "dos mil cinco" → "2005". El resto del texto no cambia. */
export function palabrasACifras(texto: string): string {
  const palabras = normalizar(texto).split(' ')
  const salida: string[] = []
  let total = 0
  let actual = 0
  let enNumero = false
  const cerrar = () => {
    if (enNumero) salida.push(String(total + actual))
    total = 0
    actual = 0
    enNumero = false
  }
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i]
    if (p in UNIDADES) {
      // "uno dos tres" dicho cifra por cifra: no se suman, son números aparte.
      if (enNumero && actual % 10 !== 0) cerrar()
      actual += UNIDADES[p]
      enNumero = true
    } else if (p in DECENAS) {
      if (enNumero && actual % 100 !== 0) cerrar()
      actual += DECENAS[p]
      enNumero = true
    } else if (p in CENTENAS) {
      if (enNumero && actual !== 0) cerrar()
      actual += CENTENAS[p]
      enNumero = true
    } else if (p === 'mil') {
      total += (actual || 1) * 1000
      actual = 0
      enNumero = true
    } else if (p === 'y' && enNumero && i + 1 < palabras.length && palabras[i + 1] in UNIDADES) {
      continue
    } else {
      cerrar()
      salida.push(p)
    }
  }
  cerrar()
  return salida.join(' ')
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function interpretarFecha(texto: string, hoy = new Date()): Interpretacion {
  const t = palabrasACifras(texto).replace(/setiembre/g, 'septiembre')
  const anio4 = /\b(19[4-9]\d|20[0-9]\d)\b/.exec(t)
  // "en el 98", "desde el noventa y ocho": año de dos cifras
  const anio2 = anio4 ? null : /\b(?:el|del|en|año|ano)\s+(\d{2})\b/.exec(t)
  let anio = anio4 ? Number(anio4[1]) : anio2 ? Number(anio2[1]) + (Number(anio2[1]) > hoy.getFullYear() % 100 ? 1900 : 2000) : null
  if (anio !== null && anio > hoy.getFullYear()) anio = null
  if (anio === null) return { valor: null, muestra: '' }
  const mes = MESES.findIndex((m) => t.includes(m))
  const fecha = `${anio}-${String(mes >= 0 ? mes + 1 : 1).padStart(2, '0')}-01`
  return {
    valor: fecha,
    muestra: mes >= 0 ? `${MESES[mes]} de ${anio}` : `${anio}`,
    extra: { precision: mes >= 0 ? 'mes' : 'anio' },
  }
}

function interpretarTelefono(texto: string): Interpretacion {
  const digitos = palabrasACifras(texto).replace(/\D/g, '')
  if (digitos.length < 7 || digitos.length > 13) return { valor: null, muestra: '' }
  return { valor: digitos, muestra: digitos }
}

function interpretarEdad(texto: string): Interpretacion {
  const t = palabrasACifras(texto)
  const meses = /\b(\d{1,2})\s+mes/.exec(t)
  const n = /\b(\d{1,3})\b/.exec(t)
  if (meses && !/\bano/.test(t)) return { valor: 0, muestra: `${meses[1]} meses` }
  if (!n || Number(n[1]) > 120) return { valor: null, muestra: '' }
  return { valor: Number(n[1]), muestra: `${Number(n[1])} años` }
}

const NEGACIONES = ['no', 'sin', 'ni', 'falta', 'nunca', 'tampoco']

/** Opciones mencionadas, salvo las que vienen negadas ("no tenemos gas", "sin cloacas"). */
function opcionesMencionadas(texto: string, opciones: Opcion[]): string[] {
  const t = normalizar(texto)
  const palabras = t.split(' ')
  const elegidas: string[] = []
  for (const op of opciones) {
    let afirmada = false
    for (const termino of op.dice) {
      const idx = palabras.findIndex((_, i) => palabras.slice(i).join(' ').startsWith(termino))
      if (idx < 0) continue
      const antes = palabras.slice(Math.max(0, idx - 3), idx)
      const despues = palabras[idx + termino.split(' ').length]
      if (!antes.some((p) => NEGACIONES.includes(p)) && despues !== 'no') afirmada = true
    }
    if (afirmada) elegidas.push(op.valor)
  }
  return elegidas
}

function interpretarSiNo(texto: string): Interpretacion {
  const t = normalizar(texto)
  if (/^(no|nada|nunca|ninguno|ninguna)\b/.test(t) || /\bno (tengo|tenemos|hay)\b/.test(t)) return { valor: false, muestra: 'No' }
  if (/^(si|claro|tengo|tenemos|sip|correcto)\b/.test(t) || /\b(si tengo|si tenemos)\b/.test(t)) return { valor: true, muestra: 'Sí' }
  return { valor: null, muestra: '' }
}

function capitalizar(texto: string): string {
  return texto
    .trim()
    .replace(/[.?!,]+$/g, '')
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toUpperCase())
}

function limpiarFrase(texto: string): string {
  const t = texto.trim().replace(/\s+/g, ' ').replace(/[.]+$/g, '')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

/** Lo que dijo el vecino, convertido al dato que corresponde a la pregunta. */
export function interpretar(pregunta: Pregunta, texto: string, hoy = new Date()): Interpretacion {
  const crudo = (texto ?? '').trim()
  if (!crudo) return { valor: null, muestra: '' }
  switch (pregunta.tipo) {
    case 'fecha':
      return interpretarFecha(crudo, hoy)
    case 'telefono':
      return interpretarTelefono(crudo)
    case 'edad':
      return interpretarEdad(crudo)
    case 'si_no':
      return interpretarSiNo(crudo)
    case 'opcion': {
      const [primera] = opcionesMencionadas(crudo, pregunta.opciones ?? [])
      const op = pregunta.opciones?.find((o) => o.valor === primera)
      return op ? { valor: op.valor, muestra: op.etiqueta } : { valor: null, muestra: '' }
    }
    case 'varias': {
      const elegidas = opcionesMencionadas(crudo, pregunta.opciones ?? [])
      const etiquetas = elegidas.map((v) => pregunta.opciones!.find((o) => o.valor === v)!.etiqueta)
      return { valor: elegidas, muestra: etiquetas.join(', ') }
    }
    case 'origen': {
      const t = normalizar(crudo)
      if (/\bcompr/.test(t) && !/\bno (la |lo )?compr/.test(t)) return { valor: 'compra', muestra: 'Compra' }
      return { valor: 'otro', muestra: `Otro: ${limpiarFrase(crudo)}`, extra: { detalle: limpiarFrase(crudo) } }
    }
    case 'nombre': {
      const limpio = crudo.replace(/^(se llama|me llamo|es|mi nombre es)\s+/i, '')
      const nombre = capitalizar(limpio)
      return nombre ? { valor: nombre, muestra: nombre } : { valor: null, muestra: '' }
    }
    default: {
      const frase = limpiarFrase(crudo)
      return { valor: frase, muestra: frase }
    }
  }
}

/** Separa "Juan Carlos Pérez" en nombre y apellido: el apellido es la última palabra. Se revisa a mano. */
export function separarNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { nombre: '', apellido: partes[0] ?? '' }
  return { nombre: partes.slice(0, -1).join(' '), apellido: partes[partes.length - 1] }
}

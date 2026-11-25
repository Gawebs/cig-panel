/**
 * Corrección automática de lo que se carga a mano: espacios de más y mayúsculas.
 * Funciones puras (se usan al guardar y se prueban en ortografia.test.ts).
 *
 * No agrega ni quita acentos: un apellido puede escribirse con o sin tilde ("Paez" / "Páez")
 * y lo que vale es cómo figura en el DNI.
 */

// Palabras que van en minúscula dentro de un nombre o domicilio (salvo que sean la primera).
const MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'di', 'do', 'dos', 'van', 'von', 'al'])
// Se escriben siempre así.
const FIJAS: Record<string, string> = { 's/n': 'S/N', 'b°': 'B°', 'bº': 'B°', 'n°': 'N°', 'nº': 'N°', 'mza': 'Mza', 'mz': 'Mz', 'av': 'Av', 'av.': 'Av.', 'dpto': 'Dpto', 'dto': 'Dto', 'ii': 'II', 'iii': 'III', 'iv': 'IV' }

/** Saca espacios al principio y al final y deja uno solo entre palabras. */
export function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

const mayusculaInicial = (p: string) => (p ? p.charAt(0).toLocaleUpperCase('es') + p.slice(1) : p)

/** Una palabra con mayúscula inicial, respetando guiones y apóstrofos ("maría-josé" → "María-José", "d'angelo" → "D'Angelo"). */
function palabraPropia(palabra: string): string {
  const baja = palabra.toLocaleLowerCase('es')
  if (FIJAS[baja]) return FIJAS[baja]
  return baja.split(/(-|')/).map((parte) => (parte === '-' || parte === "'" ? parte : mayusculaInicial(parte))).join('')
}

/**
 * Nombres, apellidos, ciudades, barrios y domicilios: cada palabra con mayúscula inicial y el resto en minúscula,
 * salvo los conectores ("de", "del", "la"…) que van en minúscula si no son la primera palabra.
 * "PAEZ GRACIELA DEL VALLE" → "Paez Graciela del Valle"; "av. independencia 1234" → "Av. Independencia 1234".
 */
export function nombrePropio(texto: string): string {
  const limpio = limpiarEspacios(texto)
  if (!limpio) return limpio
  const palabras = limpio.split(' ')
  return palabras
    .map((palabra, i) => {
      const anterior = i > 0 ? palabras[i - 1].toLocaleLowerCase('es') : ''
      // Después de "Barrio", "B°", "Calle", "Av."… empieza un nombre propio: "B° La Milagrosa", "Calle Los Pinos".
      const empiezaNombre = i === 0 || INICIAN_NOMBRE.has(anterior) || anterior.endsWith('.')
      return !empiezaNombre && MINUSCULA.has(palabra.toLocaleLowerCase('es')) ? palabra.toLocaleLowerCase('es') : palabraPropia(palabra)
    })
    .join(' ')
}

const INICIAN_NOMBRE = new Set(['b°', 'bº', 'barrio', 'calle', 'av', 'avenida', 'pje', 'pasaje', 'villa', 'loteo', 'country', 'plaza'])

/** Texto común (vínculo, ocupación, observaciones cortas): solo la primera letra en mayúscula. "HIJO" → "Hijo". */
export function oracion(texto: string): string {
  const limpio = limpiarEspacios(texto)
  if (!limpio) return limpio
  // Si viene todo en mayúsculas se pasa a minúsculas; si no, se respeta lo escrito (puede tener siglas).
  const base = limpio === limpio.toLocaleUpperCase('es') ? limpio.toLocaleLowerCase('es') : limpio
  return mayusculaInicial(base)
}

/** DNI escrito con puntos o espacios ("28.123.456") → solo los números. */
export function soloNumeros(texto: string): string {
  return texto.replace(/[\s.\-]/g, '')
}

/**
 * Mensajes de error para el usuario. Los de nuestras funciones de la base ya vienen en castellano claro
 * (código P0001); los demás son técnicos (en inglés) y se traducen a algo que se entienda.
 * El original queda en la consola del servidor para soporte.
 */
export function textoError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  const code = error?.code ?? ''
  if (code === 'P0001') return msg.replace(/^.*?ERROR:\s*/, '')
  console.error('[error]', code, msg)
  if (code === '23505') return 'Ya hay un registro igual cargado.'
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'No tenés permiso para hacer esto, o el expediente ya no se puede editar en este estado.'
  }
  if (code === '23514' || code.startsWith('22')) return 'Algún dato tiene un formato que no es válido. Revisalo.'
  if (code === '23503') return 'Falta un dato relacionado o fue quitado. Recargá la página y probá de nuevo.'
  if (/fetch failed|network|timeout|ECONN/i.test(msg)) return 'Se cortó la conexión. Revisá internet y probá de nuevo.'
  if (/payload too large|exceeded the maximum/i.test(msg)) return 'El archivo es demasiado grande.'
  return 'Ocurrió un error inesperado. Probá de nuevo; si sigue, avisá a soporte.'
}

// Nombre de cada casillero para los avisos de validación.
const CASILLEROS: Record<string, string> = {
  apellido: 'Apellido', nombre: 'Nombre', dni: 'DNI', cuil: 'CUIL', telefono: 'Teléfono', correo: 'Correo',
  ciudad: 'Ciudad', domicilio: 'Domicilio', padron: 'Padrón', padron_confirmacion: 'Confirmación del padrón',
  vinculo: 'Vínculo', ocupacion: 'Ocupación', fecha_nacimiento: 'Fecha de nacimiento', estado_civil: 'Estado civil',
  sexo: 'Sexo', ley: 'Ley', texto: 'Texto', nota: 'Nota', numero: 'Número', fecha: 'Fecha',
}

/**
 * Primer error de un formulario en castellano claro y con el nombre del casillero.
 * Los mensajes propios ("Falta el apellido…") quedan como están; los genéricos de la validación
 * ("Demasiado grande: …") se reescriben: "DNI: es demasiado largo (hasta 8 caracteres)."
 */
export function mensajeValidacion(error: { issues: { code: string; path: PropertyKey[]; message: string; maximum?: unknown; minimum?: unknown }[] }): string {
  const issue = error.issues[0]
  if (!issue) return 'Algún dato no es válido. Revisalo.'
  const clave = String(issue.path[0] ?? '').replace(/^c_/, '')
  const casillero = CASILLEROS[clave] ?? (clave ? clave.replace(/_/g, ' ') : 'Un dato')
  const generico = /^(Demasiado|Entrada inválida|Opción inválida|Formato inválido|Valor inválido|Invalid|Too)/i.test(issue.message)
  if (!generico) return issue.message
  if (issue.code === 'too_big') return `${casillero}: es demasiado largo${typeof issue.maximum === 'number' ? ` (hasta ${issue.maximum} caracteres)` : ''}.`
  if (issue.code === 'too_small') return `${casillero}: falta completarlo.`
  return `${casillero}: el dato no es válido. Revisalo.`
}

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

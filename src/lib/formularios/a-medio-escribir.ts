/**
 * Datos con formato fijo (DNI, CUIL, fechas) que todavía no se terminaron de escribir.
 * El autoguardado no los manda: espera a que estén completos, así no aparece un error mientras se escribe.
 * Al salir, imprimir o pasar de formulario sí se mandan, y ahí el error avisa de verdad.
 */
import type { Fuente } from './plantillas'

const FORMATO: Record<string, RegExp> = {
  dni: /^\d{7,8}$/,
  cuil: /^(\d{2}-\d{7,8}-\d|\d{10,11})$/,
  fecha_inicio_posesion: /^(\d{4}|\d{1,2}\/\d{1,2}\/\d{4})$/,
  fecha_nacimiento: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
}

export function aMedioEscribir(fuente: Fuente | undefined, valor: string): boolean {
  if (!fuente || !valor.trim() || !('campo' in fuente)) return false
  const formato = FORMATO[fuente.campo as string]
  return Boolean(formato && !formato.test(valor.trim()))
}

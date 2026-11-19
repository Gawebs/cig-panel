/**
 * "Próximo paso" de la ficha: una sola cosa por hacer, la primera, con su botón.
 * Función pura: la pantalla le pasa lo que ya calculó (datos faltantes, checklist, estado y roles).
 */
import type { EstadoExpediente, RolUsuario } from './textos'

export interface ProximoPaso {
  titulo: string
  detalle?: string
  boton?: { texto: string; href: string }
  /** 'hacer': le toca a este usuario. 'esperar': le toca a otro (u otra oficina). 'listo': no queda nada. */
  tono: 'hacer' | 'esperar' | 'listo'
}

export interface EntradaProximoPaso {
  estado: EstadoExpediente
  roles: RolUsuario[]
  /** Primer dato obligatorio que falta, con a dónde ir a cargarlo. */
  datoFaltante?: { texto: string; href: string; boton: string }
  cantidadDatosFaltantes: number
  /** Primer documento del checklist que falta. */
  documentoFaltante?: { paso: number; titulo: string; persona?: string; href: string }
  cantidadDocumentosFaltantes: number
  /** PDF firmados ya subidos (de 4). */
  firmados?: number
  /** Hasta cuándo corre la prórroga (dd/mm/aaaa), si hay. */
  prorrogaHasta?: string
}

const puede = (roles: RolUsuario[], ...r: RolUsuario[]) => roles.some((x) => r.includes(x))
const mas = (n: number, cosa: string) => (n > 1 ? ` (y ${n - 1} ${cosa} más)` : '')

export function proximoPaso(e: EntradaProximoPaso): ProximoPaso | null {
  const arma = puede(e.roles, 'armado', 'subdireccion', 'direccion', 'relevamiento')
  const revisa = puede(e.roles, 'subdireccion', 'direccion')
  const direccion = puede(e.roles, 'direccion')

  switch (e.estado) {
    case 'en_armado':
    case 'devuelto': {
      if (!arma) return { tono: 'esperar', titulo: 'El expediente se está armando', detalle: 'Lo completa el área de atención y armado.' }
      if (e.datoFaltante) {
        return {
          tono: 'hacer',
          titulo: `Cargá: ${e.datoFaltante.texto}`,
          detalle: `Es un dato que Catastro pide${mas(e.cantidadDatosFaltantes, 'dato(s)')}.`,
          boton: { texto: e.datoFaltante.boton, href: e.datoFaltante.href },
        }
      }
      if (e.documentoFaltante) {
        const d = e.documentoFaltante
        return {
          tono: 'hacer',
          titulo: `Subí: ${d.titulo}${d.persona ? ` de ${d.persona}` : ''}`,
          detalle: `Sacale fotos o subí el archivo${mas(e.cantidadDocumentosFaltantes, 'documento(s)')}.`,
          boton: { texto: 'Ir al documento', href: d.href },
        }
      }
      return {
        tono: 'hacer',
        titulo: 'Está todo cargado: envialo a revisión',
        detalle: e.estado === 'devuelto' ? 'Revisá que esté corregido lo que pidió la nota de arriba.' : 'La Subdirección lo revisa antes de la firma.',
        boton: { texto: 'Enviar a revisión', href: '#acciones' },
      }
    }
    case 'listo_para_revisar':
      return revisa
        ? { tono: 'hacer', titulo: 'Revisalo y aprobalo, o devolvelo con una nota', detalle: 'Mirá la lista "Antes de aprobar" y los PDF de cada paso.', boton: { texto: 'Ir a aprobar', href: '#acciones' } }
        : { tono: 'esperar', titulo: 'Esperando la revisión de la Subdirección' }
    case 'aprobado':
      if (direccion && (e.firmados ?? 0) >= 4) {
        return { tono: 'hacer', titulo: 'Están los 4 firmados: marcalo como firmado', boton: { texto: 'Marcar como firmado', href: '#acciones' } }
      }
      return direccion
        ? { tono: 'hacer', titulo: 'Firmá los PDF de los 4 pasos y subilos', detalle: 'Bajá cada PDF, firmalo digitalmente y subilo firmado.', boton: { texto: 'Ir a la firma', href: '#catastro' } }
        : { tono: 'esperar', titulo: 'Esperando la firma de la Dirección' }
    case 'firmado':
      return revisa
        ? { tono: 'hacer', titulo: 'Presentalo en el portal de Catastro', detalle: 'Después registrá acá el número de expediente que te da Catastro.', boton: { texto: 'Ir a presentar', href: '#catastro' } }
        : { tono: 'esperar', titulo: 'Firmado: falta presentarlo en Catastro' }
    case 'prorroga_pedida':
      return revisa || arma
        ? {
            tono: 'hacer',
            titulo: `Corregí lo observado y reingresalo${e.prorrogaHasta ? ` antes del ${e.prorrogaHasta}` : ''}`,
            detalle: 'Cuando lo vuelvas a presentar en el portal, registrá el reingreso.',
            boton: { texto: 'Ver la observación', href: '#catastro' },
          }
        : { tono: 'esperar', titulo: 'Con prórroga: falta corregir y reingresar' }
    case 'presentado':
    case 'reingresado':
      return {
        tono: 'esperar',
        titulo: 'Esperando la respuesta de Catastro',
        detalle: revisa ? 'Si Catastro lo observa, registrá la observación para que corra el plazo. Si lo acepta, marcalo como aceptado.' : undefined,
        boton: revisa ? { texto: 'Ver Catastro', href: '#catastro' } : undefined,
      }
    case 'observado':
      return revisa || arma
        ? { tono: 'hacer', titulo: 'Catastro lo observó: corregí y volvé a presentarlo', detalle: 'Mirá la observación y el plazo que queda.', boton: { texto: 'Ver la observación', href: '#catastro' } }
        : { tono: 'esperar', titulo: 'Observado por Catastro' }
    case 'aceptado':
      return { tono: 'listo', titulo: 'Catastro lo aceptó. No queda nada por hacer.' }
    default:
      return null
  }
}

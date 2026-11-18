/**
 * Datos que no pueden faltar para que Catastro reciba el expediente.
 * Función pura: la usan la ficha, la revisión antes de aprobar y el aviso al imprimir un formulario.
 */

export type DondeSeCarga = 'personas' | 'catastro' | 'inmueble' | 'ddjj'

export interface DatoFaltante {
  texto: string
  donde: DondeSeCarga
}

export interface PersonaDatos {
  rol: string
  solicitante_numero: number
  apellido: string | null
  nombre: string | null
  dni: string | null
  cuil: string | null
  telefono: string | null
  domicilio: string | null
  ciudad: string | null
}

export interface ExpedienteDatos {
  framework_id: string
  padron: string | null
  domicilio_inmueble: string | null
  origen_posesion: string | null
  origen_posesion_detalle: string | null
  fecha_inicio_posesion: string | null
  tiene_documentacion_ipvdu?: boolean | null
}

const vacio = (v: string | null | undefined) => !v || !String(v).trim()
const nombre = (p: PersonaDatos) => [p.apellido, p.nombre].filter(Boolean).join(' ') || 'sin nombre'
const QUIEN: Record<string, string> = { solicitante: 'Solicitante', conyuge: 'Cónyuge del solicitante', grupo_familiar: 'Grupo familiar del solicitante' }

export function datosFaltantes(exp: ExpedienteDatos, personas: PersonaDatos[]): DatoFaltante[] {
  const f: DatoFaltante[] = []
  const conGrupoFamiliar = exp.framework_id === 'ley_5670' || exp.framework_id === 'ley_8162'

  if (vacio(exp.padron)) f.push({ texto: 'Padrón del inmueble', donde: 'catastro' })
  if (vacio(exp.domicilio_inmueble)) f.push({ texto: 'Domicilio del inmueble', donde: 'inmueble' })

  const orden = [...personas].sort((a, b) => a.solicitante_numero - b.solicitante_numero)
  for (const p of orden) {
    const quien = `${nombre(p)} (${QUIEN[p.rol] ?? p.rol} ${p.solicitante_numero})`
    const faltan: string[] = []
    if (vacio(p.dni)) faltan.push('DNI')
    if (p.rol === 'solicitante' || p.rol === 'conyuge') {
      if (vacio(p.cuil)) faltan.push('CUIL')
    }
    if (p.rol === 'solicitante') {
      if (vacio(p.domicilio)) faltan.push('domicilio')
      if (vacio(p.ciudad)) faltan.push('ciudad')
      if (p.solicitante_numero === 1 && vacio(p.telefono)) faltan.push('teléfono')
    }
    if (p.rol === 'grupo_familiar' && !conGrupoFamiliar) continue
    if (faltan.length) f.push({ texto: `${quien}: falta ${faltan.join(', ')}`, donde: 'personas' })
  }

  if (exp.framework_id === 'ley_5670') {
    if (exp.tiene_documentacion_ipvdu == null) f.push({ texto: 'Si cuenta con documentación del IPVDU (sí o no)', donde: 'ddjj' })
  } else {
    if (vacio(exp.origen_posesion)) f.push({ texto: 'Origen de la posesión (compra u otro)', donde: 'ddjj' })
    else if (exp.origen_posesion === 'otro' && vacio(exp.origen_posesion_detalle)) f.push({ texto: 'Detalle del origen de la posesión', donde: 'ddjj' })
    if (vacio(exp.fecha_inicio_posesion)) f.push({ texto: 'Fecha de inicio de la posesión', donde: 'ddjj' })
  }
  return f
}

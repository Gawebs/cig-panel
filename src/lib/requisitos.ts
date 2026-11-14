/**
 * Motor de requisitos: a partir de la ley del expediente y de sus datos
 * (personas, estado civil, fecha de apertura) arma la lista de lo que
 * Catastro pide en cada paso y marca qué falta.
 *
 * Es una función pura: no consulta la base. La configuración de cada ley
 * vive en supabase/marcos/*.json (tabla legal_frameworks.config).
 */

export type Rol = 'solicitante' | 'conyuge' | 'grupo_familiar'
export type EstadoCivil = 'soltero' | 'casado' | 'viudo' | 'divorciado' | 'conviviente'
export type Paso = 1 | 2 | 3 | 4

export const PASOS: Record<Paso, { titulo: string; campoCatastro: string }> = {
  1: { titulo: 'Datos de los solicitantes', campoCatastro: 'Datos del Solicitante' },
  2: { titulo: 'Individualización del inmueble', campoCatastro: 'Individualización del Inmueble' },
  3: { titulo: 'Acreditar posesión', campoCatastro: 'Acreditar Posesión' },
  4: { titulo: 'Verificación municipal', campoCatastro: 'Certificación Municipal' },
}

export interface RequisitoConfig {
  clave: string
  paso: Paso
  titulo: string
  ayuda?: string
  aplica: 'expediente' | 'persona'
  roles?: Rol[]
  formulario?: string
  condicion?: {
    estado_civil?: EstadoCivil[]
    solicitantes_mas_de?: number
  }
}

export interface PruebasPosesionConfig {
  paso: 3
  descripcion: string
  /** Años fijos exigidos (Ley Pierri). */
  anios_fijos?: number[]
  /** Cantidad de años completos anteriores al año de inicio del expediente (Ley 5670). */
  anios_previos_a_inicio?: number
  /** Año exigido por ley y cantidad de años anteriores a ese (Ley 8162). */
  anios_previos_a?: number
  cantidad_anios?: number
  incluir_anio_en_curso: boolean
  minimo_por_anio: number
  minimo_anio_en_curso?: number
  requisitos_extra: { clave: string; titulo: string }[]
  tipos_aceptados: string[]
}

export interface MarcoConfig {
  ley_provincial: string
  decreto_reglamentario: string | null
  grupo_familiar: boolean
  max_solicitantes_formulario: number
  plano_referencia?: string
  formularios: { clave: string; paso: Paso; titulo: string; plantilla: string }[]
  requisitos: RequisitoConfig[]
  pruebas_posesion: PruebasPosesionConfig
}

export interface PersonaExpediente {
  id: string
  rol: Rol
  solicitante_numero: number
  apellido: string
  nombre: string
  estado_civil: EstadoCivil | null
}

export interface DocumentoExpediente {
  paso: number
  requisito: string
  person_id: string | null
  anio: number | null
  tipo_prueba?: string | null
  firmado?: boolean
}

/**
 * Servicios e impuestos que sirven de prueba (siempre con el ticket de pago).
 * "servicio_impuesto" en la configuración de una ley quiere decir cualquiera de estos.
 * Cada uno cuenta como una prueba distinta: dos boletas de Edet del mismo año son una sola clase de prueba.
 */
export const SERVICIOS_IMPUESTOS = ['edet', 'gasnor', 'sat', 'dgr', 'tasa_municipal', 'otro_servicio'] as const

export function tiposDePrueba(aceptados: string[]): string[] {
  return aceptados.flatMap((t) => (t === 'servicio_impuesto' ? [...SERVICIOS_IMPUESTOS] : [t]))
}

export function esServicioOImpuesto(tipo: string | null | undefined): boolean {
  return tipo === 'servicio_impuesto' || (SERVICIOS_IMPUESTOS as readonly string[]).includes(tipo ?? '')
}

/** Cuántas pruebas distintas hay: las del mismo tipo cuentan una vez (las sin tipo, cada una por separado). */
export function pruebasDistintas(docs: DocumentoExpediente[]): number {
  const tipos = new Set<string>()
  let sinTipo = 0
  for (const d of docs) {
    if (d.tipo_prueba) tipos.add(d.tipo_prueba)
    else sinTipo++
  }
  return tipos.size + sinTipo
}

export interface ItemChecklist {
  /** Clave única del ítem dentro del expediente. */
  id: string
  paso: Paso
  requisito: string
  titulo: string
  ayuda?: string
  personaId?: string
  personaNombre?: string
  anio?: number
  cantidadMinima: number
  cantidadCargada: number
  completo: boolean
  /** Explicación cuando hay documentos cargados pero no alcanzan (por ejemplo, del mismo tipo). */
  aviso?: string
}

export interface EstadoPaso {
  paso: Paso
  titulo: string
  items: ItemChecklist[]
  completos: number
  total: number
  estado: 'completo' | 'incompleto' | 'sin_empezar'
}

export interface Checklist {
  pasos: EstadoPaso[]
  completo: boolean
  faltantes: ItemChecklist[]
  /** Avisos que no son documentos (ej.: falta definir el estado civil). */
  avisos: string[]
}

const ROL_TEXTO: Record<Rol, string> = {
  solicitante: 'Solicitante',
  conyuge: 'Cónyuge o conviviente',
  grupo_familiar: 'Grupo familiar',
}

function nombrePersona(p: PersonaExpediente): string {
  const nombre = `${p.apellido} ${p.nombre}`.trim()
  const etiqueta = p.rol === 'grupo_familiar' ? ROL_TEXTO[p.rol] : `${ROL_TEXTO[p.rol]} ${p.solicitante_numero}`
  return nombre ? `${nombre} (${etiqueta})` : etiqueta
}

/** Años de prueba exigidos según la regla de la ley. */
export function aniosDePrueba(regla: PruebasPosesionConfig, fechaApertura: Date): number[] {
  const anioInicio = fechaApertura.getFullYear()
  const anios = new Set<number>()

  if (regla.anios_fijos) regla.anios_fijos.forEach((a) => anios.add(a))

  if (regla.anios_previos_a_inicio) {
    for (let i = 1; i <= regla.anios_previos_a_inicio; i++) anios.add(anioInicio - i)
  }

  if (regla.anios_previos_a && regla.cantidad_anios) {
    for (let i = 1; i <= regla.cantidad_anios; i++) anios.add(regla.anios_previos_a - i)
  }

  if (regla.incluir_anio_en_curso) anios.add(anioInicio)

  return [...anios].sort((a, b) => a - b)
}

function cumpleCondicion(
  req: RequisitoConfig,
  persona: PersonaExpediente | null,
  cantidadSolicitantes: number,
): boolean {
  const c = req.condicion
  if (!c) return true
  if (c.solicitantes_mas_de !== undefined && cantidadSolicitantes <= c.solicitantes_mas_de) return false
  if (c.estado_civil) {
    if (!persona?.estado_civil) return false
    if (!c.estado_civil.includes(persona.estado_civil)) return false
  }
  return true
}

function contar(
  documentos: DocumentoExpediente[],
  requisito: string,
  personaId?: string,
  anio?: number,
): number {
  return documentos.filter(
    (d) =>
      d.requisito === requisito &&
      (personaId === undefined || d.person_id === personaId) &&
      (anio === undefined || d.anio === anio),
  ).length
}

export function armarChecklist(params: {
  config: MarcoConfig
  personas: PersonaExpediente[]
  documentos: DocumentoExpediente[]
  fechaApertura: Date
}): Checklist {
  const { config, personas, documentos, fechaApertura } = params
  const items: ItemChecklist[] = []
  const avisos: string[] = []

  const solicitantes = personas.filter((p) => p.rol === 'solicitante')
  const cantidadSolicitantes = solicitantes.length

  if (cantidadSolicitantes === 0) avisos.push('Falta cargar al menos un solicitante.')
  for (const s of solicitantes) {
    if (!s.estado_civil) avisos.push(`Falta el estado civil de ${nombrePersona(s)}: define qué actas hay que pedir.`)
    const tienePareja = s.estado_civil === 'casado' || s.estado_civil === 'conviviente'
    const parejaCargada = personas.some((p) => p.rol === 'conyuge' && p.solicitante_numero === s.solicitante_numero)
    if (tienePareja && !parejaCargada) {
      avisos.push(`${nombrePersona(s)} figura ${s.estado_civil === 'casado' ? 'casado/a' : 'en unión convivencial'}: falta cargar al cónyuge o conviviente.`)
    }
  }
  if (config.grupo_familiar && !personas.some((p) => p.rol === 'grupo_familiar')) {
    avisos.push('Esta ley pide el grupo familiar conviviente: cargalo aunque sea una sola persona.')
  }

  for (const req of config.requisitos) {
    if (req.aplica === 'expediente') {
      if (!cumpleCondicion(req, null, cantidadSolicitantes)) continue
      const cargados = contar(documentos, req.clave)
      items.push({
        id: req.clave,
        paso: req.paso,
        requisito: req.clave,
        titulo: req.titulo,
        ayuda: req.ayuda,
        cantidadMinima: 1,
        cantidadCargada: cargados,
        completo: cargados >= 1,
      })
      continue
    }

    for (const persona of personas) {
      if (req.roles && !req.roles.includes(persona.rol)) continue
      if (!cumpleCondicion(req, persona, cantidadSolicitantes)) continue
      const cargados = contar(documentos, req.clave, persona.id)
      items.push({
        id: `${req.clave}:${persona.id}`,
        paso: req.paso,
        requisito: req.clave,
        titulo: req.titulo,
        ayuda: req.ayuda,
        personaId: persona.id,
        personaNombre: nombrePersona(persona),
        cantidadMinima: 1,
        cantidadCargada: cargados,
        completo: cargados >= 1,
      })
    }
  }

  // Paso 3: requisitos extra (certificado policial) y pruebas por año
  const regla = config.pruebas_posesion
  for (const extra of regla.requisitos_extra) {
    const cargados = contar(documentos, extra.clave)
    items.push({
      id: extra.clave,
      paso: 3,
      requisito: extra.clave,
      titulo: extra.titulo,
      cantidadMinima: 1,
      cantidadCargada: cargados,
      completo: cargados >= 1,
    })
  }

  const anioInicio = fechaApertura.getFullYear()
  for (const anio of aniosDePrueba(regla, fechaApertura)) {
    const esAnioEnCurso = regla.incluir_anio_en_curso && anio === anioInicio
    const minimo = esAnioEnCurso ? (regla.minimo_anio_en_curso ?? regla.minimo_por_anio) : regla.minimo_por_anio
    const delAnio = documentos.filter((d) => d.requisito === 'prueba_posesion' && d.anio === anio)
    // Cuando se piden varias, tienen que ser distintas (Edet y SAT sí; dos de Edet no).
    const validas = minimo > 1 ? pruebasDistintas(delAnio) : delAnio.length
    items.push({
      id: `prueba_posesion:${anio}`,
      paso: 3,
      requisito: 'prueba_posesion',
      titulo: `Pruebas de posesión de ${anio}${esAnioEnCurso ? ' (año en curso)' : ''}`,
      ayuda: minimo > 1 ? `Mínimo ${minimo} pruebas distintas de ese año (por ejemplo, Edet y SAT).` : undefined,
      anio,
      cantidadMinima: minimo,
      cantidadCargada: validas,
      completo: validas >= minimo,
      aviso: delAnio.length > validas && validas < minimo
        ? `Hay ${delAnio.length} cargadas, pero son del mismo tipo: falta una de otro servicio o impuesto.`
        : undefined,
    })
  }

  const pasos: EstadoPaso[] = ([1, 2, 3, 4] as Paso[]).map((paso) => {
    const delPaso = items.filter((i) => i.paso === paso)
    const completos = delPaso.filter((i) => i.completo).length
    const algunoCargado = delPaso.some((i) => i.cantidadCargada > 0)
    return {
      paso,
      titulo: PASOS[paso].titulo,
      items: delPaso,
      completos,
      total: delPaso.length,
      estado:
        delPaso.length > 0 && completos === delPaso.length
          ? 'completo'
          : algunoCargado
            ? 'incompleto'
            : 'sin_empezar',
    }
  })

  const faltantes = items.filter((i) => !i.completo)
  return {
    pasos,
    faltantes,
    avisos,
    completo: faltantes.length === 0 && avisos.length === 0,
  }
}

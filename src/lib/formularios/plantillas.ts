/**
 * Plantillas de los formularios oficiales de Catastro: dónde va cada dato sobre el PDF original
 * y de qué parte de la ficha del expediente sale.
 *
 * Coordenadas en puntos PDF, origen arriba a la izquierda. "y" es la línea de base donde se apoya
 * el texto (el borde inferior del rótulo impreso). Medidas con PyMuPDF sobre los PDF del portal.
 * Si Catastro cambia un formulario, hay que volver a medir.
 */

/** Solicitante (s) o cónyuge (c) número 1 a 5. Del 3 al 5 van en el Anexo I. */
export type Slot = `${'s' | 'c'}${1 | 2 | 3 | 4 | 5}`
type SlotPrincipal = 's1' | 'c1' | 's2' | 'c2'
export type CampoPersona = 'apellido_nombre' | 'dni' | 'cuil' | 'telefono' | 'domicilio' | 'ciudad' | 'estado_civil'
export type CampoExpediente =
  | 'domicilio_inmueble' | 'localidad' | 'departamento' | 'padron' | 'fecha_inicio_posesion' | 'origen_posesion_detalle'
  | 'circ' | 'secc' | 'mzna' | 'parcela' | 'matricula' | 'orden' | 'antecedente_dominio'
  | 'coordenadas' | 'numero_expediente_catastro' | 'libro' | 'folio' | 'serie' | 'anio_dominio'
  | 'manzana' | 'lote'

export type CampoFamiliar = 'apellido_nombre' | 'dni' | 'edad' | 'vinculo' | 'ocupacion'

export type Fuente =
  | { tipo: 'persona'; slot: Slot; campo: CampoPersona }
  | { tipo: 'expediente'; campo: CampoExpediente }
  | { tipo: 'formulario'; clave: string }
  /** Integrante del grupo familiar conviviente de un solicitante (1.º, 2.º, 3.º…). */
  | { tipo: 'familiar'; solicitante: 1 | 2; indice: number; campo: CampoFamiliar }
  /** Lo que anotó el relevador en el lugar (observaciones) o la fecha de la visita. */
  | { tipo: 'relevamiento'; clave: string }
  /** Número de ley y decreto del marco normativo (no se editan en el formulario). */
  | { tipo: 'marco'; campo: 'ley_provincial' | 'decreto_reglamentario' }
  /** Texto fijo que se imprime (por ejemplo, el número de solicitante en el Anexo I). */
  | { tipo: 'fijo'; valor: string }

export interface CampoPlantilla {
  id: string
  etiqueta: string
  pagina: number
  x0: number
  x1: number
  y: number
  fuente: Fuente
  control?: 'texto' | 'estado_civil'
  /** Texto largo repartido en varios renglones del formulario. */
  lineas?: number
  interlineado?: number
  /** Altura exacta de cada renglón, cuando no están parejos (reemplaza lineas e interlineado). */
  renglones?: number[]
  /** Fecha repartida en espacios (día, mes, año): desde-hasta de cada uno. */
  partes?: [number, number][]
}

export interface CasillaPlantilla {
  id: string
  etiqueta: string
  pagina: number
  /** Centro de la casilla */
  x: number
  y: number
  fuente: { tipo: 'expediente'; campo: 'ubicacion' | 'origen_posesion' | 'tiene_documentacion_ipvdu' } | { tipo: 'relevamiento'; clave: string }
  valor: string
  /** Se pueden marcar varias del mismo grupo (servicios, mejoras). */
  multiple?: boolean
  // valor '*': se marca sola cuando el texto de al lado tiene algo (no se toca a mano)
}

/** Foto o croquis cargado en el expediente que se imprime dentro del formulario. */
export interface ImagenPlantilla {
  id: string
  etiqueta: string
  pagina: number
  x0: number
  y0: number
  x1: number
  y1: number
  requisito: string
  /** Página del PDF cargado (las 4 fotos van en un PDF de 4 hojas). */
  hoja: number
}

/** Grupo de casillas excluyentes: se marca una sola (salvo las múltiples). */
export function grupoCasilla(k: CasillaPlantilla): string {
  return k.fuente.tipo === 'expediente' ? k.fuente.campo : `rel:${k.fuente.clave}`
}

export interface Plantilla {
  clave: string
  titulo: string
  archivo: string
  paginas: number[] // páginas del PDF que se muestran e imprimen (0 = primera)
  campos: CampoPlantilla[]
  casillas: CasillaPlantilla[]
  imagenes?: ImagenPlantilla[]
  nota?: string
}

const PERSONA_FILAS: Record<SlotPrincipal, number[]> = {
  s1: [223.4, 237.6, 251.8, 266.0],
  c1: [304.2, 318.4],
  s2: [360.7, 374.9, 389.2, 403.4],
  c2: [440.4, 454.6],
}

export function nombreSlot(slot: Slot): string {
  const n = slot.slice(1)
  return slot.startsWith('s') ? `Solicitante ${n}` : `Cónyuge o conviviente del solicitante ${n}`
}

/** Bloque de datos personales: mismo dibujo en solicitud, DDJJ y relevamiento de Pierri. */
function bloquePersona(slot: Slot, filas: number[], forma: 'completa' | 'conyuge'): CampoPlantilla[] {
  const base: [CampoPersona, number, number, number, CampoPlantilla['control']?][] = [
    ['apellido_nombre', 0, 172, 566],
    ['dni', 1, 101, 190],
    ['cuil', 1, 224, 313],
    ['telefono', 1, 339, 566],
  ]
  const completa: [CampoPersona, number, number, number, CampoPlantilla['control']?][] = [
    ['domicilio', 2, 127, 314],
    ['ciudad', 2, 357, 566],
    ['estado_civil', 3, 140, 566, 'estado_civil'],
  ]
  const ETIQUETA: Record<CampoPersona, string> = {
    apellido_nombre: 'Apellido y nombre', dni: 'DNI', cuil: 'CUIL', telefono: 'Teléfono',
    domicilio: 'Domicilio', ciudad: 'Ciudad', estado_civil: 'Estado civil',
  }
  return [...base, ...(forma === 'completa' ? completa : [])].map(([campo, fila, x0, x1, control]) => ({
    id: `${slot}.${campo}`,
    etiqueta: `${nombreSlot(slot)}: ${ETIQUETA[campo]}`,
    pagina: 0,
    x0,
    x1,
    y: filas[fila],
    fuente: { tipo: 'persona', slot, campo },
    control,
  }))
}

function personas(filas: Record<SlotPrincipal, number[]>): CampoPlantilla[] {
  return [
    ...bloquePersona('s1', filas.s1, 'completa'),
    ...bloquePersona('c1', filas.c1, 'conyuge'),
    ...bloquePersona('s2', filas.s2, 'completa'),
    ...bloquePersona('c2', filas.c2, 'conyuge'),
  ]
}

const fecha = (x0: number, x1: number, y: number): CampoPlantilla => ({
  id: 'fecha', etiqueta: 'Fecha', pagina: 0, x0, x1, y, fuente: { tipo: 'formulario', clave: 'fecha' },
})

// ───────────────────────── Relevamiento social (4 hojas, igual para las 3 leyes) ─────────────────────────

type FilaPersona = [CampoPersona, number, number, number, CampoPlantilla['control']?] // campo, y, x0, x1

function personaRS(slot: Slot, filas: FilaPersona[]): CampoPlantilla[] {
  const ETIQUETA: Record<CampoPersona, string> = {
    apellido_nombre: 'Apellido y nombre', dni: 'DNI', cuil: 'CUIL', telefono: 'Teléfono',
    domicilio: 'Domicilio', ciudad: 'Ciudad', estado_civil: 'Estado civil',
  }
  return filas.map(([campo, y, x0, x1, control]) => ({
    id: `${slot}.${campo}`, etiqueta: `${nombreSlot(slot)}: ${ETIQUETA[campo]}`, pagina: 0, x0, x1, y, fuente: { tipo: 'persona', slot, campo }, control,
  }))
}

/** Tres renglones de grupo familiar por solicitante. y1: renglón de nombre/DNI/edad; y2: vínculo/ocupación. */
function familiaRS(solicitante: 1 | 2, renglones: [number, number][]): CampoPlantilla[] {
  return renglones.flatMap(([y1, y2], i) => {
    const indice = i + 1
    const base = `Grupo familiar del solicitante ${solicitante}, persona ${indice}`
    const f = (campo: CampoFamiliar) => ({ tipo: 'familiar' as const, solicitante, indice, campo })
    const campos: CampoPlantilla[] = [
      { id: `fam${solicitante}.${indice}.apellido_nombre`, etiqueta: `${base}: apellido y nombre`, pagina: 0, x0: 162, x1: 305, y: y1, fuente: f('apellido_nombre') },
      { id: `fam${solicitante}.${indice}.dni`, etiqueta: `${base}: DNI`, pagina: 0, x0: 330, x1: 388, y: y1, fuente: f('dni') },
      { id: `fam${solicitante}.${indice}.edad`, etiqueta: `${base}: edad`, pagina: 0, x0: 419, x1: 470, y: y1, fuente: f('edad') },
      { id: `fam${solicitante}.${indice}.vinculo`, etiqueta: `${base}: vínculo`, pagina: 0, x0: 346, x1: 388, y: y2, fuente: f('vinculo') },
      { id: `fam${solicitante}.${indice}.ocupacion`, etiqueta: `${base}: ocupación`, pagina: 0, x0: 444, x1: 565, y: y2, fuente: f('ocupacion') },
    ]
    return campos
  })
}

const rel = (clave: string) => ({ tipo: 'relevamiento' as const, clave })
const casilla = (id: string, etiqueta: string, pagina: number, x: number, y: number, clave: string, valor: string, multiple = false): CasillaPlantilla => ({
  id, etiqueta, pagina, x, y, fuente: rel(clave), valor, multiple,
})

function relevamientoSocial(): Plantilla {
  return {
    clave: 'relevamiento_social',
    titulo: 'Relevamiento social',
    archivo: '/formularios/portal-Formulario_LEY_24374_RelevamientoSocial.pdf',
    paginas: [0, 1, 2, 3],
    nota: 'Lo marcado en el lugar sale del relevamiento del celular. Si hay más de 3 personas por solicitante en el grupo familiar, las demás se agregan a mano. Cada hoja la firman los solicitantes y el relevador.',
    campos: [
      // Hoja 1: marco normativo y datos personales
      { id: 'ley_provincial', etiqueta: 'Ley provincial', pagina: 0, x0: 199, x1: 400, y: 147, fuente: { tipo: 'marco', campo: 'ley_provincial' } },
      { id: 'decreto', etiqueta: 'Decreto reglamentario', pagina: 0, x0: 265, x1: 410, y: 165.5, fuente: { tipo: 'marco', campo: 'decreto_reglamentario' } },
      { id: 'fecha_relevamiento', etiqueta: 'Fecha del relevamiento', pagina: 0, x0: 457, x1: 562, y: 145.2, fuente: rel('fecha') },
      { id: 'numero_expediente_catastro', etiqueta: 'N.º de expediente de Catastro', pagina: 0, x0: 471, x1: 562, y: 165.5, fuente: { tipo: 'expediente', campo: 'numero_expediente_catastro' } },
      ...personaRS('s1', [
        ['apellido_nombre', 223.9, 172, 566], ['dni', 238.1, 101, 190], ['cuil', 238.1, 224, 345], ['telefono', 238.1, 372, 566],
        ['domicilio', 252.3, 127, 314], ['ciudad', 252.3, 357, 566], ['estado_civil', 266.5, 140, 566, 'estado_civil'],
      ]),
      ...personaRS('c1', [['apellido_nombre', 304.6, 171, 566], ['dni', 318.8, 100, 188], ['cuil', 318.8, 223, 348], ['telefono', 318.8, 374, 566]]),
      ...familiaRS(1, [[368.3, 385.2], [402.1, 420.2], [436.0, 451.0]]),
      ...personaRS('s2', [
        ['apellido_nombre', 495.7, 173, 566], ['dni', 509.9, 102, 192], ['cuil', 509.9, 225, 350], ['telefono', 509.9, 373, 566],
        ['domicilio', 524.1, 128, 314], ['ciudad', 524.1, 358, 566], ['estado_civil', 538.3, 141, 566, 'estado_civil'],
      ]),
      ...personaRS('c2', [['apellido_nombre', 581.8, 173, 566], ['dni', 595.9, 102, 194], ['cuil', 595.9, 225, 352], ['telefono', 595.9, 376, 566]]),
      ...familiaRS(2, [[649.2, 664.6], [681.3, 696.6], [710.5, 723.0]]),

      // Hoja 2: datos del inmueble y observaciones generales
      { id: 'domicilio_inmueble', etiqueta: 'Domicilio del inmueble', pagina: 1, x0: 127, x1: 566, y: 172.3, fuente: { tipo: 'expediente', campo: 'domicilio_inmueble' } },
      { id: 'localidad', etiqueta: 'Localidad', pagina: 1, x0: 129, x1: 312, y: 186.5, fuente: { tipo: 'expediente', campo: 'localidad' } },
      { id: 'departamento', etiqueta: 'Departamento', pagina: 1, x0: 389, x1: 566, y: 186.5, fuente: { tipo: 'expediente', campo: 'departamento' } },
      { id: 'padron', etiqueta: 'Padrón', pagina: 1, x0: 117, x1: 222, y: 229.1, fuente: { tipo: 'expediente', campo: 'padron' } },
      { id: 'coordenadas', etiqueta: 'Coordenadas geográficas', pagina: 1, x0: 358, x1: 566, y: 229.1, fuente: { tipo: 'expediente', campo: 'coordenadas' } },
      { id: 'matricula', etiqueta: 'Matrícula registral', pagina: 1, x0: 175, x1: 420, y: 280.6, fuente: { tipo: 'expediente', campo: 'matricula' } },
      { id: 'libro', etiqueta: 'Libro', pagina: 1, x0: 110, x1: 127, y: 306, fuente: { tipo: 'expediente', campo: 'libro' } },
      { id: 'folio', etiqueta: 'Folio', pagina: 1, x0: 155, x1: 170, y: 306, fuente: { tipo: 'expediente', campo: 'folio' } },
      { id: 'serie', etiqueta: 'Serie', pagina: 1, x0: 199, x1: 225, y: 306, fuente: { tipo: 'expediente', campo: 'serie' } },
      { id: 'anio_dominio', etiqueta: 'Año', pagina: 1, x0: 249, x1: 300, y: 306, fuente: { tipo: 'expediente', campo: 'anio_dominio' } },
      { id: 'infraestructura', etiqueta: 'Infraestructura', pagina: 1, x0: 186, x1: 566, y: 370, fuente: rel('infraestructura') },
      { id: 'accesos', etiqueta: 'Accesos', pagina: 1, x0: 137, x1: 566, y: 395.8, fuente: rel('accesos') },
      { id: 'signos_residencia_detalle', etiqueta: 'Signos de residencia: cuáles', pagina: 1, x0: 256, x1: 566, y: 537.1, fuente: rel('signos_residencia_detalle') },

      // Hoja 3: características del inmueble
      { id: 'tipologia_otro', etiqueta: 'Tipología: otro', pagina: 2, x0: 146, x1: 566, y: 195, fuente: rel('tipologia_otro') },
      { id: 'servicios_otros', etiqueta: 'Servicios: otros', pagina: 2, x0: 150, x1: 566, y: 445.1, fuente: rel('servicios_otros') },
      { id: 'mejoras_otras', etiqueta: 'Mejoras: otras', pagina: 2, x0: 154, x1: 566, y: 556.2, fuente: rel('mejoras_otras') },
      { id: 'observaciones_inmueble', etiqueta: 'Observaciones', pagina: 2, x0: 80, x1: 564, y: 614, fuente: rel('observaciones_inmueble'), lineas: 6, interlineado: 21.2 },
    ],
    casillas: [
      { id: 'ubicacion.capital', etiqueta: 'Capital', pagina: 1, x: 388.6, y: 138, fuente: { tipo: 'expediente', campo: 'ubicacion' }, valor: 'capital' },
      { id: 'ubicacion.interior', etiqueta: 'Interior', pagina: 1, x: 522.9, y: 139, fuente: { tipo: 'expediente', campo: 'ubicacion' }, valor: 'interior' },
      casilla('entorno.urbano', 'Entorno urbano', 1, 391.2, 342.5, 'entorno', 'urbano'),
      casilla('entorno.rural', 'Entorno rural', 1, 499.5, 342.9, 'entorno', 'rural'),
      casilla('ocupacion.exclusiva', 'Ocupación exclusiva', 1, 497.6, 410.2, 'ocupacion', 'exclusiva'),
      casilla('ocupacion.compartida', 'Ocupación compartida', 1, 498.6, 435, 'ocupacion', 'compartida'),
      casilla('presencia.si', 'Presencia del ocupante: sí', 1, 445.8, 485.4, 'presencia_ocupante', 'si'),
      casilla('presencia.no', 'Presencia del ocupante: no', 1, 500.1, 485.4, 'presencia_ocupante', 'no'),
      casilla('signos.si', 'Signos de residencia: sí', 1, 445.8, 511.5, 'signos_residencia', 'si'),
      casilla('signos.no', 'Signos de residencia: no', 1, 500.5, 510.9, 'signos_residencia', 'no'),

      casilla('tipologia.casa', 'Casa', 2, 129.8, 162.2, 'tipologia', 'casa'),
      casilla('tipologia.departamento', 'Departamento', 2, 265, 162.9, 'tipologia', 'departamento'),
      casilla('tipologia.precaria', 'Construcción precaria', 2, 502.2, 163, 'tipologia', 'precaria'),
      casilla('tipologia.otro', 'Otro', 2, 131.9, 189, 'tipologia', 'otro'),
      casilla('destino.vivienda', 'Vivienda', 2, 149.8, 241.7, 'destino', 'vivienda'),
      casilla('destino.comercio', 'Comercio', 2, 255.3, 241.7, 'destino', 'comercio'),
      casilla('destino.ambas', 'Ambas', 2, 350.8, 242.1, 'destino', 'ambas'),
      casilla('estado.bueno', 'Bueno', 2, 137.5, 296.8, 'estado', 'bueno'),
      casilla('estado.regular', 'Regular', 2, 236.7, 297.3, 'estado', 'regular'),
      casilla('estado.malo', 'Malo', 2, 322.1, 296.2, 'estado', 'malo'),
      casilla('materiales.mamposteria', 'Mampostería', 2, 178.2, 353, 'materiales', 'mamposteria'),
      casilla('materiales.chapa', 'Chapa', 2, 262.7, 353, 'materiales', 'chapa'),
      casilla('materiales.madera', 'Madera', 2, 378.8, 354, 'materiales', 'madera'),
      casilla('materiales.mixto', 'Mixto', 2, 472.2, 355.6, 'materiales', 'mixto'),
      casilla('servicios.agua', 'Agua', 2, 129.5, 412.4, 'servicios', 'agua', true),
      casilla('servicios.luz', 'Luz eléctrica', 2, 263.7, 411.4, 'servicios', 'luz', true),
      casilla('servicios.gas', 'Gas natural', 2, 379.9, 411.9, 'servicios', 'gas', true),
      casilla('servicios.cloacas', 'Cloacas', 2, 471.8, 411.3, 'servicios', 'cloacas', true),
      // "Otros": se marca solo cuando hay algo escrito al lado.
      casilla('servicios.otros', 'Servicios: otros', 2, 135, 439.2, 'servicios_otros', '*'),
      casilla('mejoras.otras', 'Mejoras: otras', 2, 139.7, 550.3, 'mejoras_otras', '*'),
      casilla('mejoras.ampliaciones', 'Ampliaciones', 2, 188.4, 495.7, 'mejoras', 'ampliaciones', true),
      casilla('mejoras.sanitaria', 'Instalación sanitaria', 2, 371.9, 496.2, 'mejoras', 'sanitaria', true),
      casilla('mejoras.revoque', 'Revoque', 2, 471.2, 496.8, 'mejoras', 'revoque', true),
      casilla('mejoras.pisos', 'Pisos', 2, 135.3, 522.8, 'mejoras', 'pisos', true),
      casilla('mejoras.cielorraso', 'Cielorraso', 2, 255.2, 523.8, 'mejoras', 'cielorraso', true),
      casilla('mejoras.pintura', 'Pintura', 2, 368.8, 523.3, 'mejoras', 'pintura', true),
    ],
    imagenes: [
      { id: 'croquis', etiqueta: 'Croquis', pagina: 1, x0: 60, y0: 572, x1: 536, y1: 742, requisito: 'croquis', hoja: 0 },
      { id: 'foto.frente', etiqueta: 'Foto del frente', pagina: 3, x0: 40, y0: 122, x1: 292, y1: 430, requisito: 'fotos_inmueble', hoja: 0 },
      { id: 'foto.contrafrente', etiqueta: 'Foto del contrafrente', pagina: 3, x0: 302, y0: 122, x1: 554, y1: 430, requisito: 'fotos_inmueble', hoja: 1 },
      { id: 'foto.interior1', etiqueta: 'Foto del interior', pagina: 3, x0: 40, y0: 438, x1: 292, y1: 742, requisito: 'fotos_inmueble', hoja: 2 },
      { id: 'foto.interior2', etiqueta: 'Foto del interior', pagina: 3, x0: 302, y0: 438, x1: 554, y1: 742, requisito: 'fotos_inmueble', hoja: 3 },
    ],
  }
}

// ───────────────────────── Herramientas para medir formularios nuevos ─────────────────────────
// Cada renglón se describe con la altura (borde inferior del rótulo) y dónde empieza el espacio
// para escribir (justo después del rótulo). El espacio termina donde empieza el rótulo siguiente.

const FIN = 566 // borde derecho de los renglones de puntos

interface BloqueMedido {
  nombre: [y: number, x0: number]
  /** DNI, CUIL y teléfono en el mismo renglón: [y, x0 DNI, x0 rótulo CUIL, x0 CUIL, x0 rótulo Tel, x0 Tel] */
  documentos: [y: number, dni: number, rotuloCuil: number, cuil: number, rotuloTel: number, tel: number]
  /** Domicilio y ciudad: [y, x0 domicilio, x0 rótulo ciudad, x0 ciudad] */
  domicilio?: [y: number, x0: number, rotuloCiudad: number, ciudad: number]
  civil?: [y: number, x0: number]
}

function bloque(slot: Slot, m: BloqueMedido, pagina = 0): CampoPlantilla[] {
  const id = (campo: CampoPersona) => `${slot}.${campo}`
  const et = (t: string) => `${nombreSlot(slot)}: ${t}`
  const f = (campo: CampoPersona) => ({ tipo: 'persona' as const, slot, campo })
  const [yd, dni, rCuil, cuil, rTel, tel] = m.documentos
  const campos: CampoPlantilla[] = [
    { id: id('apellido_nombre'), etiqueta: et('Apellido y nombre'), pagina, x0: m.nombre[1], x1: FIN, y: m.nombre[0], fuente: f('apellido_nombre') },
    { id: id('dni'), etiqueta: et('DNI'), pagina, x0: dni, x1: rCuil - 3, y: yd, fuente: f('dni') },
    { id: id('cuil'), etiqueta: et('CUIL'), pagina, x0: cuil, x1: rTel - 3, y: yd, fuente: f('cuil') },
    { id: id('telefono'), etiqueta: et('Teléfono'), pagina, x0: tel, x1: FIN, y: yd, fuente: f('telefono') },
  ]
  if (m.domicilio) {
    const [y, x0, rCiudad, ciudad] = m.domicilio
    campos.push(
      { id: id('domicilio'), etiqueta: et('Domicilio'), pagina, x0, x1: rCiudad - 3, y, fuente: f('domicilio') },
      { id: id('ciudad'), etiqueta: et('Ciudad'), pagina, x0: ciudad, x1: FIN, y, fuente: f('ciudad') },
    )
  }
  if (m.civil) campos.push({ id: id('estado_civil'), etiqueta: et('Estado civil'), pagina, x0: m.civil[1], x1: FIN, y: m.civil[0], fuente: f('estado_civil'), control: 'estado_civil' })
  return campos
}

interface ColumnasFamilia {
  nombre: [number, number]
  dni: [number, number]
  edad: [number, number]
  vinculo: [number, number]
  ocupacion: [number, number]
}

/** Renglones del grupo familiar: [y del nombre/DNI/edad, y de vínculo/ocupación (si el renglón lo tiene)]. */
function familia(solicitante: 1 | 2, renglones: [number, number | null][], x: ColumnasFamilia, pagina = 0): CampoPlantilla[] {
  return renglones.flatMap(([y1, y2], i) => {
    const indice = i + 1
    const base = `Grupo familiar del solicitante ${solicitante}, persona ${indice}`
    const f = (campo: CampoFamiliar) => ({ tipo: 'familiar' as const, solicitante, indice, campo })
    const id = (campo: CampoFamiliar) => `fam${solicitante}.${indice}.${campo}`
    const campos: CampoPlantilla[] = [
      { id: id('apellido_nombre'), etiqueta: `${base}: apellido y nombre`, pagina, x0: x.nombre[0], x1: x.nombre[1], y: y1, fuente: f('apellido_nombre') },
      { id: id('dni'), etiqueta: `${base}: DNI`, pagina, x0: x.dni[0], x1: x.dni[1], y: y1, fuente: f('dni') },
      { id: id('edad'), etiqueta: `${base}: edad`, pagina, x0: x.edad[0], x1: x.edad[1], y: y1, fuente: f('edad') },
    ]
    if (y2 !== null) {
      campos.push(
        { id: id('vinculo'), etiqueta: `${base}: vínculo`, pagina, x0: x.vinculo[0], x1: x.vinculo[1], y: y2, fuente: f('vinculo') },
        { id: id('ocupacion'), etiqueta: `${base}: ocupación`, pagina, x0: x.ocupacion[0], x1: x.ocupacion[1], y: y2, fuente: f('ocupacion') },
      )
    }
    return campos
  })
}

/** Fecha en el recuadro "Fecha: __ / __ / ____" de la esquina (barras en x 516,5 y 543). */
function fechaEsquina(y: number, pagina = 0, desplazamiento = 0): CampoPlantilla {
  const d = desplazamiento
  return {
    id: pagina === 0 ? 'fecha' : `fecha_hoja${pagina + 1}`, etiqueta: 'Fecha', pagina, x0: 507 + d, x1: FIN, y,
    fuente: { tipo: 'formulario', clave: 'fecha' }, partes: [[506.5 + d, 516 + d], [520 + d, 542 + d], [547 + d, FIN]],
  }
}

// ───────────────────────── Ley 5670 (La Milagrosa) ─────────────────────────

const FAM_5670_SOL_1: ColumnasFamilia = { nombre: [204, 334], dni: [361, 438], edad: [472, FIN], vinculo: [362, 437], ocupacion: [500, FIN] }
const FAM_5670_SOL_2: ColumnasFamilia = { nombre: [208, 337], dni: [364, 442], edad: [476, FIN], vinculo: [365, 440], ocupacion: [504, FIN] }
const FAM_5670_DDJJ: ColumnasFamilia = { nombre: [190, 313], dni: [338, 414], edad: [445, FIN], vinculo: [357, 417], ocupacion: [471, FIN] }

const SOLICITUD_5670: Plantilla = {
  clave: 'solicitud',
  titulo: 'Solicitud de adhesión — Ley 5.670 (La Milagrosa)',
  archivo: '/formularios/portal-Formulario_LEY_5670_Solicitud.pdf',
  paginas: [0],
  nota: 'Entran 3 personas del grupo familiar por solicitante.',
  campos: [
    fechaEsquina(113.3),
    ...bloque('s1', { nombre: [185.6, 203], documentos: [199.8, 132, 225.1, 255, 347.7, 370], domicilio: [214, 158, 302.8, 343], civil: [228.3, 171] }),
    ...bloque('c1', { nombre: [265.7, 203], documentos: [279.9, 132, 224.8, 255, 347.4, 370] }),
    ...familia(1, [[329.9, 344.1], [358.3, 372.5], [386.7, 400.9]], FAM_5670_SOL_1),
    ...bloque('s2', { nombre: [443.5, 207], documentos: [457.7, 136, 229.3, 259, 351.9, 374], domicilio: [472, 162, 307, 347], civil: [486.2, 175] }),
    ...bloque('c2', { nombre: [533.4, 211], documentos: [547.7, 140, 232.8, 263, 355.4, 378] }),
    ...familia(2, [[603.8, 618], [632.2, 646.4], [660.6, 674.8]], FAM_5670_SOL_2),
  ],
  casillas: [],
}

const DDJJ_5670: Plantilla = {
  clave: 'ddjj',
  titulo: 'Declaración jurada — Ley 5.670 (La Milagrosa)',
  archivo: '/formularios/portal-Formulario_LEY_5670_DDJJ.pdf',
  paginas: [0, 1],
  nota: 'El tercer renglón del grupo familiar no tiene lugar para vínculo ni ocupación en el formulario de Catastro.',
  campos: [
    fechaEsquina(109.7),
    { id: 'domicilio_inmueble', etiqueta: 'Domicilio del inmueble', pagina: 0, x0: 82, x1: FIN, y: 159.5, fuente: { tipo: 'expediente', campo: 'domicilio_inmueble' } },
    ...bloque('s1', { nombre: [210.7, 203], documentos: [224.9, 132, 224.7, 255, 347.3, 370], domicilio: [239.1, 158, 348.2, 388], civil: [253.3, 171] }),
    ...bloque('c1', { nombre: [298.8, 204], documentos: [313, 133, 225.3, 256, 348, 370] }),
    ...familia(1, [[357.1, 374.5], [391.5, 408.4], [426.8, null]], FAM_5670_DDJJ),
    ...bloque('s2', { nombre: [479.8, 204], documentos: [494, 133, 225.6, 256, 348.2, 370], domicilio: [508.2, 159, 349.1, 389], civil: [522.4, 172] }),
    ...bloque('c2', { nombre: [565.7, 202], documentos: [594.1, 131, 223.6, 254, 346.2, 368] }),
    ...familia(2, [[636.7, 654.1], [671.1, 688], [706.4, null]], { ...FAM_5670_DDJJ, vinculo: [355, 415], ocupacion: [470, FIN] }),
    fechaEsquina(113.3, 1),
  ],
  casillas: [
    { id: 'ipvdu.si', etiqueta: 'Cuenta con documentación del IPVDU: sí', pagina: 1, x: 106.4, y: 164.5, fuente: { tipo: 'expediente', campo: 'tiene_documentacion_ipvdu' }, valor: 'true' },
    { id: 'ipvdu.no', etiqueta: 'Cuenta con documentación del IPVDU: no', pagina: 1, x: 171.7, y: 164.6, fuente: { tipo: 'expediente', campo: 'tiene_documentacion_ipvdu' }, valor: 'false' },
  ],
}

// ───────────────────────── Ley 8162 (Barrio Menem) ─────────────────────────

const SOLICITUD_8162: Plantilla = {
  clave: 'solicitud',
  titulo: 'Solicitud de adhesión — Ley 8.162 (Barrio Menem)',
  archivo: '/formularios/portal-Formulario_LEY_8162_Solicitud.pdf',
  paginas: [0, 1],
  nota: 'Manzana y lote según el Plano N.º 67.856/2013. En la hoja 2 se imprimen las 4 fotos del inmueble cargadas en el paso 2.',
  campos: [
    fechaEsquina(113.3),
    ...bloque('s1', { nombre: [184.8, 177], documentos: [199, 106, 199.2, 229, 321.8, 344], domicilio: [213.2, 132, 276.8, 317], civil: [227.4, 145] }),
    ...bloque('c1', { nombre: [267.6, 178], documentos: [281.8, 107, 199.7, 230, 322.3, 345] }),
    ...bloque('s2', { nombre: [326.9, 176], documentos: [341.1, 105, 197.5, 228, 320.1, 342], domicilio: [355.3, 130, 275.2, 315], civil: [369.6, 144] }),
    ...bloque('c2', { nombre: [416.8, 176], documentos: [431, 105, 197.5, 228, 320.1, 342] }),
    ...familia(1, [[481.6, 495.8], [510, 524.2], [538.4, 552.7]], { nombre: [176, 305], dni: [332, 410], edad: [444, FIN], vinculo: [334, 408], ocupacion: [472, FIN] }),
    { id: 'domicilio_inmueble', etiqueta: 'Domicilio del inmueble', pagina: 0, x0: 126, x1: FIN, y: 641.3, fuente: { tipo: 'expediente', campo: 'domicilio_inmueble' } },
    { id: 'padron', etiqueta: 'Padrón', pagina: 0, x0: 117, x1: FIN, y: 663.9, fuente: { tipo: 'expediente', campo: 'padron' } },
    { id: 'manzana', etiqueta: 'Manzana', pagina: 0, x0: 113, x1: 195, y: 690.6, fuente: { tipo: 'expediente', campo: 'manzana' } },
    { id: 'lote', etiqueta: 'Lote', pagina: 0, x0: 278, x1: 333, y: 690.6, fuente: { tipo: 'expediente', campo: 'lote' } },
    fechaEsquina(109.7, 1),
    {
      id: 'observaciones', etiqueta: 'Observaciones', pagina: 1, x0: 82, x1: 560, y: 177.6, fuente: { tipo: 'formulario', clave: 'observaciones' },
      renglones: [177.6, 197.2, 220.6, 246.5, 271.5, 289.2],
    },
  ],
  casillas: [],
  imagenes: [
    { id: 'foto.frente', etiqueta: 'Foto del frente', pagina: 1, x0: 36, y0: 334, x1: 292, y1: 538, requisito: 'fotos_inmueble', hoja: 0 },
    { id: 'foto.contrafrente', etiqueta: 'Foto del contrafrente', pagina: 1, x0: 301, y0: 334, x1: 557, y1: 538, requisito: 'fotos_inmueble', hoja: 1 },
    { id: 'foto.interior1', etiqueta: 'Foto del interior', pagina: 1, x0: 36, y0: 544, x1: 292, y1: 748, requisito: 'fotos_inmueble', hoja: 2 },
    { id: 'foto.interior2', etiqueta: 'Foto del interior', pagina: 1, x0: 301, y0: 544, x1: 557, y1: 748, requisito: 'fotos_inmueble', hoja: 3 },
  ],
}

const DDJJ_8162: Plantilla = {
  clave: 'ddjj',
  titulo: 'Declaración jurada — Ley 8.162 (Barrio Menem)',
  archivo: '/formularios/portal-Formulario_LEY_8162_DDJJ.pdf',
  paginas: [0, 1],
  nota: 'El origen de la posesión tiene que ser anterior al año 2003.',
  campos: [
    fechaEsquina(102.7, 0, 1),
    ...bloque('s1', { nombre: [190.6, 177], documentos: [204.8, 106, 199.3, 229, 321.9, 344], domicilio: [219, 132, 322.8, 363], civil: [233.2, 145] }),
    ...bloque('c1', { nombre: [278.6, 178], documentos: [292.8, 107, 200, 230, 322.6, 345] }),
    ...bloque('s2', { nombre: [338.5, 176], documentos: [352.7, 105, 197.5, 228, 320.1, 342], domicilio: [366.9, 130, 321, 361], civil: [381.2, 144] }),
    ...bloque('c2', { nombre: [428.3, 178], documentos: [442.5, 107, 199.8, 230, 322.4, 345] }),
    ...familia(1, [[496.9, 514.1], [531.3, 548], [566.6, null]], { nombre: [165, 287], dni: [313, 388], edad: [420, FIN], vinculo: [331, 391], ocupacion: [446, FIN] }),
    fechaEsquina(113.3, 1),
    { id: 'origen_posesion_detalle', etiqueta: 'Origen: detalle si es "otro"', pagina: 1, x0: 292, x1: FIN, y: 170, fuente: { tipo: 'expediente', campo: 'origen_posesion_detalle' } },
    { id: 'fecha_inicio_posesion', etiqueta: 'Fecha de inicio de la posesión', pagina: 1, x0: 296, x1: FIN, y: 200.2, fuente: { tipo: 'expediente', campo: 'fecha_inicio_posesion' } },
  ],
  casillas: [
    { id: 'origen.compra', etiqueta: 'Compra', pagina: 1, x: 168.3, y: 164.4, fuente: { tipo: 'expediente', campo: 'origen_posesion' }, valor: 'compra' },
    { id: 'origen.otro', etiqueta: 'Otro', pagina: 1, x: 280.1, y: 164.9, fuente: { tipo: 'expediente', campo: 'origen_posesion' }, valor: 'otro' },
  ],
}

// ───────────────────────── Anexo I de la solicitud Pierri (solicitantes 3 a 5) ─────────────────────────

const numeroSolicitante = (id: string, n: string, x0: number, y: number): CampoPlantilla => ({
  id, etiqueta: `Número de solicitante ${n}`, pagina: 1, x0, x1: x0 + 14, y, fuente: { tipo: 'fijo', valor: n },
})

const ANEXO_I_PIERRI: Plantilla = {
  clave: 'anexo_i',
  titulo: 'Anexo I — Solicitantes adicionales (Ley 24.374)',
  archivo: '/formularios/portal-Formulario_LEY_24374_Solicitud.pdf',
  paginas: [1],
  nota: 'Solo hace falta cuando hay más de 2 solicitantes. Los solicitantes 3, 4 y 5 se cargan en la ficha como cualquier otro.',
  campos: [
    numeroSolicitante('num.s3', '3', 176, 175), numeroSolicitante('num.c3', '3', 380, 255.5),
    ...bloque('s3', { nombre: [190.9, 173], documentos: [205.1, 102, 195.1, 225, 317.7, 340], domicilio: [219.3, 128, 318.6, 358], civil: [233.5, 141] }, 1),
    ...bloque('c3', { nombre: [271.8, 172], documentos: [286, 101, 194.4, 224, 317, 339] }, 1),
    numeroSolicitante('num.s4', '4', 176, 322.1), numeroSolicitante('num.c4', '4', 377, 402.6),
    ...bloque('s4', { nombre: [338.8, 173], documentos: [353, 102, 194.9, 225, 317.5, 340], domicilio: [367.2, 127, 318.4, 358], civil: [381.4, 141] }, 1),
    ...bloque('c4', { nombre: [418.5, 174], documentos: [432.7, 103, 195.9, 226, 318.5, 341] }, 1),
    numeroSolicitante('num.s5', '5', 174, 465.3), numeroSolicitante('num.c5', '5', 375, 545.8),
    ...bloque('s5', { nombre: [482, 170], documentos: [496.2, 99, 192.5, 222, 315.1, 337], domicilio: [510.4, 125, 316, 356], civil: [524.6, 138] }, 1),
    ...bloque('c5', { nombre: [561.7, 171], documentos: [575.9, 100, 193.6, 223, 316.2, 338] }, 1),
  ],
  casillas: [],
}

export const PLANTILLAS: Record<string, Plantilla> = {
  'ley_pierri/anexo_i': ANEXO_I_PIERRI,
  'ley_5670/solicitud': SOLICITUD_5670,
  'ley_5670/ddjj': DDJJ_5670,
  'ley_8162/solicitud': SOLICITUD_8162,
  'ley_8162/ddjj': DDJJ_8162,
  'ley_pierri/relevamiento_social': relevamientoSocial(),
  'ley_5670/relevamiento_social': relevamientoSocial(),
  'ley_8162/relevamiento_social': relevamientoSocial(),

  // Solicitud de adhesión Ley 24.374 (versión 6). Igual al PDF que ya usa el panel actual.
  'ley_pierri/solicitud': {
    clave: 'solicitud',
    titulo: 'Solicitud de adhesión — Ley 24.374',
    archivo: '/formularios/portal-Formulario_LEY_24374_Solicitud.pdf',
    paginas: [0],
    nota: 'Si hay más de 2 solicitantes, los demás van en el Anexo I, que se imprime aparte desde la ficha.',
    campos: [
      fecha(445, 545, 150.9),
      ...personas(PERSONA_FILAS),
      { id: 'domicilio_inmueble', etiqueta: 'Domicilio del inmueble', pagina: 0, x0: 127, x1: 566, y: 545.4, fuente: { tipo: 'expediente', campo: 'domicilio_inmueble' } },
      { id: 'circ', etiqueta: 'Circunscripción', pagina: 0, x0: 101, x1: 161, y: 587.4, fuente: { tipo: 'expediente', campo: 'circ' } },
      { id: 'secc', etiqueta: 'Sección', pagina: 0, x0: 193, x1: 253, y: 587.4, fuente: { tipo: 'expediente', campo: 'secc' } },
      { id: 'mzna', etiqueta: 'Manzana', pagina: 0, x0: 284, x1: 368, y: 587.4, fuente: { tipo: 'expediente', campo: 'mzna' } },
      { id: 'parcela', etiqueta: 'Parcela', pagina: 0, x0: 410, x1: 566, y: 587.4, fuente: { tipo: 'expediente', campo: 'parcela' } },
      { id: 'padron', etiqueta: 'Padrón', pagina: 0, x0: 117, x1: 232, y: 602.3, fuente: { tipo: 'expediente', campo: 'padron' } },
      { id: 'matricula', etiqueta: 'Matrícula', pagina: 0, x0: 282, x1: 372, y: 602.3, fuente: { tipo: 'expediente', campo: 'matricula' } },
      { id: 'orden', etiqueta: 'Orden', pagina: 0, x0: 407, x1: 566, y: 602.3, fuente: { tipo: 'expediente', campo: 'orden' } },
      { id: 'antecedente_dominio', etiqueta: 'Antecedente de dominio', pagina: 0, x0: 202, x1: 566, y: 617.2, fuente: { tipo: 'expediente', campo: 'antecedente_dominio' } },
    ],
    casillas: [
      { id: 'ubicacion.capital', etiqueta: 'Capital', pagina: 0, x: 364.4, y: 516.3, fuente: { tipo: 'expediente', campo: 'ubicacion' }, valor: 'capital' },
      { id: 'ubicacion.interior', etiqueta: 'Interior', pagina: 0, x: 495.1, y: 516.3, fuente: { tipo: 'expediente', campo: 'ubicacion' }, valor: 'interior' },
    ],
  },

  // Declaración jurada Ley 24.374 (versión del portal).
  'ley_pierri/ddjj': {
    clave: 'ddjj',
    titulo: 'Declaración jurada — Ley 24.374',
    archivo: '/formularios/portal-Formulario_LEY_24374_DDJJ.pdf',
    paginas: [0],
    campos: [
      fecha(445, 545, 155.6),
      { id: 'domicilio_inmueble', etiqueta: 'Domicilio del inmueble', pagina: 0, x0: 240, x1: 566, y: 187.9, fuente: { tipo: 'expediente', campo: 'domicilio_inmueble' } },
      { id: 'localidad', etiqueta: 'Localidad', pagina: 0, x0: 154, x1: 310, y: 224.5, fuente: { tipo: 'expediente', campo: 'localidad' } },
      { id: 'departamento', etiqueta: 'Departamento', pagina: 0, x0: 424, x1: 566, y: 224.8, fuente: { tipo: 'expediente', campo: 'departamento' } },
      ...personas({
        s1: [302.6, 316.8, 331.0, 345.2],
        c1: [383.7, 397.9],
        s2: [433.5, 447.7, 461.9, 476.1],
        c2: [513.5, 527.7],
      }),
      { id: 'origen_posesion_detalle', etiqueta: 'Origen: detalle si es "otro"', pagina: 0, x0: 232, x1: 566, y: 591.2, fuente: { tipo: 'expediente', campo: 'origen_posesion_detalle' } },
      { id: 'fecha_inicio_posesion', etiqueta: 'Fecha de inicio de la posesión', pagina: 0, x0: 290, x1: 566, y: 622.5, fuente: { tipo: 'expediente', campo: 'fecha_inicio_posesion' } },
    ],
    casillas: [
      { id: 'origen.compra', etiqueta: 'Compra', pagina: 0, x: 147.5, y: 584.4, fuente: { tipo: 'expediente', campo: 'origen_posesion' }, valor: 'compra' },
      { id: 'origen.otro', etiqueta: 'Otro', pagina: 0, x: 219.4, y: 584.0, fuente: { tipo: 'expediente', campo: 'origen_posesion' }, valor: 'otro' },
    ],
  },
}

export function plantillaDe(ley: string, formulario: string): Plantilla | null {
  return PLANTILLAS[`${ley}/${formulario}`] ?? null
}

// ───────────────────────── Valores a partir de la ficha ─────────────────────────

export interface FichaPersona {
  id: string
  rol: string
  solicitante_numero: number
  apellido: string
  nombre: string
  dni: string | null
  cuil: string | null
  telefono: string | null
  domicilio: string | null
  ciudad: string | null
  estado_civil: string | null
  orden?: number
  vinculo?: string | null
  ocupacion?: string | null
  edad_declarada?: number | null
  fecha_nacimiento?: string | null
  created_at?: string
}

export interface FichaRelevamiento {
  fecha: string
  observaciones: Record<string, string | string[]>
}

export interface FichaExpediente {
  domicilio_inmueble: string | null
  localidad: string | null
  departamento: string | null
  padron: string | null
  ubicacion: string | null
  origen_posesion: string | null
  origen_posesion_detalle: string | null
  fecha_inicio_posesion: string | null
  fecha_apertura: string
  datos_catastrales: Record<string, string>
  valores_formularios: Record<string, Record<string, string>>
  coordenadas?: string | null
  numero_expediente_catastro?: string | null
  manzana?: string | null
  lote?: string | null
  tiene_documentacion_ipvdu?: boolean | null
  /** Número de ley provincial y decreto, de la configuración de la ley. */
  marco?: { ley_provincial?: string; decreto_reglamentario?: string }
  /** Observaciones del relevamiento en el lugar (ya combinadas con la entrevista). */
  relevamiento?: FichaRelevamiento | null
}

export const ESTADO_CIVIL_TEXTO: Record<string, string> = {
  soltero: 'Soltero/a', casado: 'Casado/a', viudo: 'Viudo/a', divorciado: 'Divorciado/a', conviviente: 'Unión convivencial',
}

export function personaDeSlot(personas: FichaPersona[], slot: Slot): FichaPersona | undefined {
  const numero = Number(slot.slice(1))
  const rol = slot.startsWith('s') ? 'solicitante' : 'conyuge'
  // El cónyuge de un viudo está cargado solo por sus actas: no va como cónyuge en los formularios.
  if (rol === 'conyuge' && personas.some((p) => p.rol === 'solicitante' && p.solicitante_numero === numero && p.estado_civil === 'viudo')) return undefined
  return personas.find((p) => p.rol === rol && p.solicitante_numero === numero)
}

function fechaArgentina(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export const CAMPOS_CATASTRALES = ['circ', 'secc', 'mzna', 'parcela', 'matricula', 'orden', 'antecedente_dominio', 'libro', 'folio', 'serie', 'anio_dominio'] as const

/** Integrantes del grupo familiar de un solicitante, en el orden en que se cargaron. */
export function familiaresDe(personas: FichaPersona[], solicitante: number): FichaPersona[] {
  return personas
    .filter((p) => p.rol === 'grupo_familiar' && p.solicitante_numero === solicitante)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

export function edadDe(p: FichaPersona, hoy = new Date()): string {
  if (p.fecha_nacimiento) {
    const n = new Date(`${p.fecha_nacimiento}T12:00:00`)
    let edad = hoy.getFullYear() - n.getFullYear()
    if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) edad--
    return String(edad)
  }
  return p.edad_declarada === null || p.edad_declarada === undefined ? '' : String(p.edad_declarada)
}

/** Valor de cada campo y casilla de la plantilla, tal como sale de la ficha. */
export function valoresDesdeFicha(p: Plantilla, exp: FichaExpediente, personas: FichaPersona[]): Record<string, string> {
  const v: Record<string, string> = {}
  for (const c of p.campos) {
    const f = c.fuente
    if (f.tipo === 'formulario') {
      v[c.id] = exp.valores_formularios[p.clave]?.[f.clave] ?? (f.clave === 'fecha' ? fechaArgentina(exp.fecha_apertura) : '')
    } else if (f.tipo === 'fijo') {
      v[c.id] = f.valor
    } else if (f.tipo === 'marco') {
      v[c.id] = exp.marco?.[f.campo] ?? ''
    } else if (f.tipo === 'relevamiento') {
      if (f.clave === 'fecha') v[c.id] = exp.valores_formularios[p.clave]?.fecha ?? fechaArgentina(exp.relevamiento?.fecha ?? null)
      else {
        const valor = exp.relevamiento?.observaciones[f.clave]
        v[c.id] = typeof valor === 'string' ? valor : ''
      }
    } else if (f.tipo === 'familiar') {
      const per = familiaresDe(personas, f.solicitante)[f.indice - 1]
      if (!per) { v[c.id] = ''; continue }
      if (f.campo === 'apellido_nombre') v[c.id] = `${per.apellido} ${per.nombre}`.trim()
      else if (f.campo === 'edad') v[c.id] = edadDe(per)
      else v[c.id] = per[f.campo] ?? ''
    } else if (f.tipo === 'persona') {
      const per = personaDeSlot(personas, f.slot)
      if (!per) { v[c.id] = ''; continue }
      if (f.campo === 'apellido_nombre') v[c.id] = `${per.apellido} ${per.nombre}`.trim()
      else if (f.campo === 'estado_civil') v[c.id] = per.estado_civil ?? ''
      else v[c.id] = per[f.campo] ?? ''
    } else if ((CAMPOS_CATASTRALES as readonly string[]).includes(f.campo)) {
      v[c.id] = exp.datos_catastrales[f.campo] ?? ''
    } else if (f.campo === 'fecha_inicio_posesion') {
      // Cargada solo con el año (se guarda como 1 de enero): se imprime solo el año.
      v[c.id] = exp.fecha_inicio_posesion?.endsWith('-01-01') ? exp.fecha_inicio_posesion.slice(0, 4) : fechaArgentina(exp.fecha_inicio_posesion)
    } else {
      v[c.id] = (exp[f.campo as keyof FichaExpediente] as string | null) ?? ''
    }
  }
  for (const k of p.casillas) {
    if (k.fuente.tipo === 'expediente') {
      const actual = exp[k.fuente.campo]
      v[k.id] = actual !== null && actual !== undefined && String(actual) === k.valor ? 'X' : ''
    } else {
      const valor = exp.relevamiento?.observaciones[k.fuente.clave]
      if (k.valor === '*') v[k.id] = typeof valor === 'string' && valor.trim() ? 'X' : ''
      else v[k.id] = (Array.isArray(valor) ? valor.includes(k.valor) : valor === k.valor) ? 'X' : ''
    }
  }
  return v
}

/** Texto como se imprime: mayúsculas, solo caracteres que admite la letra estándar del PDF. */
export function textoImpreso(campo: CampoPlantilla | undefined, valor: string): string {
  const visible = campo?.control === 'estado_civil' ? (ESTADO_CIVIL_TEXTO[valor] ?? valor) : valor
  return visible.toUpperCase().replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

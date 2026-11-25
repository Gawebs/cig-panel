'use client'

import type { DatosCroquis, Trazo } from './croquis-plantilla'

/**
 * Lo que el relevador hace en la visita queda guardado en el celular (IndexedDB) antes que nada.
 * Así no se pierde si no hay señal, si se cierra la aplicación o si se apaga el teléfono.
 * Cuando vuelve la conexión, `sincronizar` lo sube al expediente.
 */

export interface ExpedienteCampo {
  id: string
  municipioId: string
  numero: string
  ley: string
  titular: string
  titularId: string | null
  domicilio: string | null
  barrio: string | null
  asignadoAMi: boolean
  /** Si el relevamiento ya se empezó (en este u otro equipo), su id. */
  relevamientoId: string | null
}

export interface RespuestaCampo {
  texto: string
  origen: 'voz' | 'mano'
  /** Grabación de esta respuesta (id en el almacén de archivos). */
  audioId?: string
  /** Ruta del audio ya subido. */
  audioRuta?: string
  /** La voz todavía no pasó a texto. */
  pendienteTexto?: boolean
  revisado?: boolean
}

export type ClaveFoto = 'frente' | 'contrafrente' | 'interior1' | 'interior2'

export interface RelevamientoCampo {
  id: string
  expedienteId: string
  municipioId: string
  ley: string
  estado: 'en_curso' | 'completo'
  gps: { lat: number; lng: number; precision: number; fecha: string } | null
  respuestas: Record<string, RespuestaCampo>
  familiares: number
  observaciones: Record<string, string | string[]>
  fotos: Partial<Record<ClaveFoto, string>>
  croquisId: string | null
  /** Croquis prediseñado: lo cargado en los campos y lo dibujado a mano encima. */
  croquisDatos?: DatosCroquis
  croquisTrazos?: Trazo[]
  /** Qué ya se subió: fotos y croquis como PDF, para no duplicarlos. */
  subidos: { fotos?: string; fotosRuta?: string; croquis?: string; croquisRuta?: string; coordenadas?: string; coordenadasRuta?: string }
  actualizado: number
  sincronizado: number | null
}

export interface ArchivoCampo {
  id: string
  blob: Blob
  tipo: string
  creado: number
}

const NOMBRE = 'cig-campo'
const VERSION = 1

let conexion: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  conexion ??= new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(NOMBRE, VERSION)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      if (!db.objectStoreNames.contains('expedientes')) db.createObjectStore('expedientes', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('relevamientos')) {
        db.createObjectStore('relevamientos', { keyPath: 'id' }).createIndex('expediente', 'expedienteId', { unique: true })
      }
      if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos', { keyPath: 'id' })
    }
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => {
      conexion = null
      rechazar(pedido.error)
    }
  })
  return conexion
}

function promesa<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rechazar(pedido.error)
  })
}

async function almacen(nombre: string, modo: IDBTransactionMode = 'readonly') {
  return (await abrir()).transaction(nombre, modo).objectStore(nombre)
}

// ───────── Expedientes para trabajar sin señal ─────────

export async function guardarExpedientes(lista: ExpedienteCampo[]): Promise<void> {
  const db = await abrir()
  const tx = db.transaction('expedientes', 'readwrite')
  const st = tx.objectStore('expedientes')
  st.clear()
  for (const e of lista) st.put(e)
  await new Promise<void>((ok, mal) => {
    tx.oncomplete = () => ok()
    tx.onerror = () => mal(tx.error)
  })
}

export async function listarExpedientes(): Promise<ExpedienteCampo[]> {
  return promesa((await almacen('expedientes')).getAll())
}

export async function obtenerExpediente(id: string): Promise<ExpedienteCampo | undefined> {
  return promesa((await almacen('expedientes')).get(id))
}

// ───────── Relevamientos ─────────

const creando = new Map<string, Promise<RelevamientoCampo>>()

/** El relevamiento del expediente; si no existe, lo crea (una sola vez aunque se pida dos veces seguidas). */
export function relevamientoDe(expediente: ExpedienteCampo): Promise<RelevamientoCampo> {
  let p = creando.get(expediente.id)
  if (!p) {
    p = obtenerOCrear(expediente).finally(() => creando.delete(expediente.id))
    creando.set(expediente.id, p)
  }
  return p
}

async function obtenerOCrear(expediente: ExpedienteCampo): Promise<RelevamientoCampo> {
  const existente = await promesa<RelevamientoCampo | undefined>((await almacen('relevamientos')).index('expediente').get(expediente.id))
  if (existente) return existente
  const nuevo: RelevamientoCampo = {
    id: expediente.relevamientoId ?? crypto.randomUUID(),
    expedienteId: expediente.id,
    municipioId: expediente.municipioId,
    ley: expediente.ley,
    estado: 'en_curso',
    gps: null,
    respuestas: {},
    familiares: 0,
    observaciones: {},
    fotos: {},
    croquisId: null,
    subidos: {},
    actualizado: Date.now(),
    sincronizado: null,
  }
  await guardarRelevamiento(nuevo)
  return nuevo
}

export async function leerRelevamiento(id: string): Promise<RelevamientoCampo | undefined> {
  return promesa((await almacen('relevamientos')).get(id))
}

export async function guardarRelevamiento(r: RelevamientoCampo): Promise<RelevamientoCampo> {
  const copia = { ...r, actualizado: Date.now() }
  await promesa((await almacen('relevamientos', 'readwrite')).put(copia))
  return copia
}

/**
 * Marca como sincronizado sin tocar la hora de modificación: si el relevador cambió algo
 * mientras se subía, queda pendiente para la próxima. `mutar` agrega lo que se subió (rutas de audio, PDF).
 */
export async function marcarSincronizado(id: string, hasta: number, mutar: (r: RelevamientoCampo) => RelevamientoCampo): Promise<void> {
  const actual = await promesa<RelevamientoCampo | undefined>((await almacen('relevamientos')).get(id))
  if (!actual) return
  await promesa((await almacen('relevamientos', 'readwrite')).put({ ...mutar(actual), sincronizado: hasta }))
}

/** Quita del celular un relevamiento y sus fotos, croquis y audios (solo para expedientes que ya no existen). */
export async function borrarRelevamiento(id: string): Promise<void> {
  const r = await promesa<RelevamientoCampo | undefined>((await almacen('relevamientos')).get(id))
  if (!r) return
  const archivos = [...Object.values(r.respuestas).map((x) => x.audioId), ...Object.values(r.fotos), r.croquisId].filter(Boolean) as string[]
  for (const a of archivos) await promesa((await almacen('archivos', 'readwrite')).delete(a))
  await promesa((await almacen('relevamientos', 'readwrite')).delete(id))
}

/**
 * Recuerda lo que ya se subió (PDF de fotos, croquis, coordenadas, audios) aunque el resto de la subida
 * falle después: así el próximo intento no lo vuelve a subir repetido. No toca la hora de modificación.
 */
export async function recordarSubidos(id: string, mutar: (r: RelevamientoCampo) => RelevamientoCampo): Promise<void> {
  const actual = await promesa<RelevamientoCampo | undefined>((await almacen('relevamientos')).get(id))
  if (!actual) return
  await promesa((await almacen('relevamientos', 'readwrite')).put(mutar(actual)))
}

export async function listarRelevamientos(): Promise<RelevamientoCampo[]> {
  return promesa((await almacen('relevamientos')).getAll())
}

export function estaPendiente(r: RelevamientoCampo): boolean {
  return r.sincronizado === null || r.actualizado > r.sincronizado
}

// ───────── Archivos (fotos, croquis, audios) ─────────

export async function guardarArchivo(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  const archivo: ArchivoCampo = { id, blob, tipo: blob.type, creado: Date.now() }
  await promesa((await almacen('archivos', 'readwrite')).put(archivo))
  return id
}

export async function leerArchivo(id: string): Promise<Blob | null> {
  const a = await promesa<ArchivoCampo | undefined>((await almacen('archivos')).get(id))
  return a?.blob ?? null
}

export async function borrarArchivo(id: string): Promise<void> {
  await promesa((await almacen('archivos', 'readwrite')).delete(id))
}

/** Pide al navegador que no borre estos datos cuando le falte espacio. */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

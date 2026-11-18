'use client'

/**
 * Pasa a texto una grabación, en este mismo equipo. Una sola cola: las respuestas se transcriben
 * de a una, en segundo plano, mientras el relevador sigue con la entrevista.
 */

type Pendiente = { resolver: (t: string) => void; rechazar: (e: Error) => void }

let motor: Worker | null = null
const pendientes = new Map<string, Pendiente>()
const oyentesCarga = new Set<(progreso: number) => void>()

function obtenerMotor(): Worker {
  if (motor) return motor
  motor = new Worker(new URL('./motor.worker.ts', import.meta.url), { type: 'module' })
  const progresos = new Map<string, number>()
  motor.onmessage = (e: MessageEvent) => {
    const m = e.data as { tipo: string; id?: string; texto?: string; error?: string; archivo?: string; progreso?: number }
    if (m.tipo === 'carga' && m.archivo) {
      progresos.set(m.archivo, m.progreso ?? 0)
      const total = [...progresos.values()].reduce((a, b) => a + b, 0) / Math.max(progresos.size, 1)
      oyentesCarga.forEach((f) => f(total))
      return
    }
    const p = m.id ? pendientes.get(m.id) : undefined
    if (!p) return
    pendientes.delete(m.id!)
    if (m.tipo === 'error') p.rechazar(new Error(m.error))
    else p.resolver(m.texto ?? '')
  }
  motor.onerror = (e) => {
    pendientes.forEach((p) => p.rechazar(new Error(e.message || 'Falló el reconocimiento de voz.')))
    pendientes.clear()
    motor?.terminate()
    motor = null
  }
  return motor
}

function enviar(mensaje: { audio?: Float32Array; precargar?: boolean }, transferir: Transferable[] = []): Promise<string> {
  const id = crypto.randomUUID()
  return new Promise((resolver, rechazar) => {
    pendientes.set(id, { resolver, rechazar })
    obtenerMotor().postMessage({ id, ...mensaje }, transferir)
  })
}

/** Decodifica el audio grabado (webm, mp4, wav) y lo deja como lo necesita el reconocedor: mono, 16 kHz. */
export async function audioParaReconocer(audio: Blob): Promise<Float32Array> {
  const datos = await audio.arrayBuffer()
  // Un contexto "offline" a 16 kHz decodifica y convierte la frecuencia de una vez, sin pedir permiso de sonido.
  const ctx = new OfflineAudioContext(1, 1, 16000)
  const buffer = await ctx.decodeAudioData(datos)
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const canal = buffer.getChannelData(c)
    for (let i = 0; i < canal.length; i++) mono[i] += canal[i] / buffer.numberOfChannels
  }
  return mono
}

/**
 * Quita lo que el reconocedor agrega cuando no hay habla: "(Música)", "[Risas]", "(ruido)".
 * Si solo había eso, la respuesta queda vacía para escribirla a mano.
 */
export function limpiarTranscripcion(texto: string): string {
  return texto.replace(/[\[(][^\])]{0,40}[\])]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function transcribir(audio: Blob): Promise<string> {
  const muestras = await audioParaReconocer(audio)
  if (muestras.length < 16000 * 0.3) return ''
  return limpiarTranscripcion(await enviar({ audio: muestras }, [muestras.buffer]))
}

/** Descarga y prepara el modelo (la primera vez tarda). Avisa el avance de 0 a 100. */
export async function prepararReconocimiento(alAvanzar?: (progreso: number) => void): Promise<void> {
  if (alAvanzar) oyentesCarga.add(alAvanzar)
  try {
    await enviar({ precargar: true })
  } finally {
    if (alAvanzar) oyentesCarga.delete(alAvanzar)
  }
}

/** Si conviene transcribir en este equipo durante la visita: celulares con poca memoria lo dejan para la oficina. */
export function equipoAptoParaVoz(): boolean {
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof WebAssembly === 'object' && (memoria === undefined || memoria >= 4)
}

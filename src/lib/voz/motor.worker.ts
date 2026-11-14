/// <reference lib="webworker" />
/**
 * Reconocimiento de voz que corre dentro del navegador (Whisper, modelo "base" en español).
 * El modelo y el motor se sirven desde nuestro propio dominio (public/vendor): el audio
 * no sale del equipo y no se usa ningún servicio de terceros. La primera vez descarga
 * unos 100 MB; después queda guardado en el navegador.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/vendor/modelos/'
env.useBrowserCache = true
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = '/vendor/ort/'

const MODELO = 'onnx-community/whisper-base'

let reconocedor: Promise<AutomaticSpeechRecognitionPipeline> | null = null

// Firma simplificada: los tipos completos de `pipeline` son demasiado grandes para TypeScript.
const crear = pipeline as unknown as (tarea: string, modelo: string, opciones: object) => Promise<AutomaticSpeechRecognitionPipeline>

function cargar() {
  reconocedor ??= crear('automatic-speech-recognition', MODELO, {
    device: 'wasm',
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    progress_callback: (p: { status: string; file?: string; progress?: number }) => {
      if (p.status === 'progress') self.postMessage({ tipo: 'carga', archivo: p.file, progreso: p.progress })
    },
  })
  return reconocedor
}

self.onmessage = async (e: MessageEvent<{ id: string; audio?: Float32Array; precargar?: boolean }>) => {
  const { id, audio, precargar } = e.data
  try {
    const asr = await cargar()
    if (precargar || !audio) {
      self.postMessage({ tipo: 'listo', id })
      return
    }
    const salida = await asr(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
    const texto = Array.isArray(salida) ? salida.map((s) => s.text).join(' ') : salida.text
    self.postMessage({ tipo: 'texto', id, texto: texto.trim() })
  } catch (err) {
    reconocedor = null
    self.postMessage({ tipo: 'error', id, error: err instanceof Error ? err.message : String(err) })
  }
}

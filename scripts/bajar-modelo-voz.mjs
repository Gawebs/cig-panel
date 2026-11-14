// Descarga UNA VEZ (al instalar o al publicar) el modelo de reconocimiento de voz en español
// y lo deja en public/vendor/modelos/, para servirlo desde nuestro propio dominio.
// En uso, el navegador nunca pide nada a servidores de terceros: el audio no sale del equipo.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MODELO = 'onnx-community/whisper-base'
const ARCHIVOS = [
  'config.json', 'generation_config.json', 'preprocessor_config.json',
  'tokenizer.json', 'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx',
]
const destino = `public/vendor/modelos/${MODELO}`

for (const archivo of ARCHIVOS) {
  const ruta = `${destino}/${archivo}`
  if (existsSync(ruta)) continue
  const r = await fetch(`https://huggingface.co/${MODELO}/resolve/main/${archivo}`)
  if (!r.ok) throw new Error(`${archivo}: ${r.status}`)
  mkdirSync(dirname(ruta), { recursive: true })
  writeFileSync(ruta, Buffer.from(await r.arrayBuffer()))
  console.log(`Bajado ${archivo}`)
}
console.log('Modelo de voz listo.')

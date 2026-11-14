// Copia a public/ los recursos que el navegador carga aparte (visor de PDF y lector de texto),
// para servirlos desde nuestro propio dominio: nada se pide a servidores de terceros.
import { copyFileSync, mkdirSync } from 'node:fs'

const copias = [
  ['node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/vendor/pdf.worker.min.mjs'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'public/vendor/tesseract/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'public/vendor/tesseract/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/vendor/tesseract/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'public/vendor/tesseract/lang/spa.traineddata.gz'],
  // Motor del reconocimiento de voz (onnxruntime en WebAssembly)
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs', 'public/vendor/ort/ort-wasm-simd-threaded.jsep.mjs'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', 'public/vendor/ort/ort-wasm-simd-threaded.jsep.wasm'],
]

mkdirSync('public/vendor/tesseract/lang', { recursive: true })
mkdirSync('public/vendor/ort', { recursive: true })
for (const [desde, hacia] of copias) copyFileSync(desde, hacia)
console.log(`Recursos copiados: ${copias.length}`)

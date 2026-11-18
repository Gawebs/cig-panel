'use client'

/**
 * Herramientas del navegador para documentos:
 * - fotos o PDF → un solo PDF liviano (las fotos se achican y comprimen antes de subir)
 * - lectura del código de barras del DNI
 * - lectura del texto del dorso del DNI (lector local, sin servicios externos)
 */
import { PDFDocument } from 'pdf-lib'

const LADO_MAXIMO = 1800 // px: suficiente para leer un acta, sin pesar de más
const CALIDAD_JPEG = 0.72

// createImageBitmap respeta la orientación de la foto del celular y, a diferencia de img.decode(),
// no se queda esperando cuando la pestaña está en segundo plano.
async function cargarImagen(archivo: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se pudo abrir la imagen. Probá con otra foto.')
  }
}

/** Achica y pasa a JPEG. Devuelve los bytes y el tamaño final. */
export async function comprimirImagen(archivo: Blob): Promise<{ bytes: Uint8Array; ancho: number; alto: number }> {
  const img = await cargarImagen(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  const ancho = Math.round(img.width * escala)
  const alto = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(img, 0, 0, ancho, alto)
  const blob: Blob = await new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', CALIDAD_JPEG),
  )
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ancho, alto }
}

/** Une fotos y PDF (en el orden recibido) en un único PDF en hoja A4. */
export async function unirEnPdf(archivos: File[]): Promise<{ bytes: Uint8Array; paginas: number }> {
  if (archivos.length === 0) throw new Error('No hay archivos para unir.')
  const pdf = await PDFDocument.create()
  const A4 = { ancho: 595.28, alto: 841.89, margen: 18 }

  for (const archivo of archivos) {
    if (archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')) {
      const origen = await PDFDocument.load(await archivo.arrayBuffer(), { ignoreEncryption: true })
      const paginas = await pdf.copyPages(origen, origen.getPageIndices())
      paginas.forEach((p) => pdf.addPage(p))
      continue
    }
    if (!archivo.type.startsWith('image/')) {
      throw new Error(`"${archivo.name}" no es una foto ni un PDF.`)
    }
    const { bytes, ancho, alto } = await comprimirImagen(archivo)
    const imagen = await pdf.embedJpg(bytes)
    const pagina = pdf.addPage([A4.ancho, A4.alto])
    const escala = Math.min((A4.ancho - 2 * A4.margen) / ancho, (A4.alto - 2 * A4.margen) / alto)
    const w = ancho * escala
    const h = alto * escala
    pagina.drawImage(imagen, { x: (A4.ancho - w) / 2, y: (A4.alto - h) / 2, width: w, height: h })
  }

  return { bytes: await pdf.save(), paginas: pdf.getPageCount() }
}

/** Lee el código PDF417 del frente del DNI. Devuelve el texto crudo o null. */
export async function leerCodigoDni(foto: Blob): Promise<string | null> {
  const zxing = await import('@zxing/library')
  const hints = new Map()
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.PDF_417])
  hints.set(zxing.DecodeHintType.TRY_HARDER, true)
  const lector = new zxing.PDF417Reader()

  const img = await cargarImagen(foto)
  // Se prueba la foto derecha y girada: muchas veces el DNI se fotografía de costado.
  for (const giro of [0, 90, 180, 270]) {
    const canvas = document.createElement('canvas')
    const lado = Math.min(1, 2200 / Math.max(img.width, img.height))
    const w = Math.round(img.width * lado)
    const h = Math.round(img.height * lado)
    canvas.width = giro % 180 === 0 ? w : h
    canvas.height = giro % 180 === 0 ? h : w
    const ctx = canvas.getContext('2d')!
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((giro * Math.PI) / 180)
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    try {
      const fuente = new zxing.HTMLCanvasElementLuminanceSource(canvas)
      const resultado = lector.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(fuente)), hints)
      return resultado.getText()
    } catch {
      // probar el siguiente giro
    }
  }
  return null
}

/** Lee el texto impreso de una foto (dorso del DNI). Corre en el navegador, con recursos propios. */
export async function leerTexto(foto: Blob, alAvanzar?: (porcentaje: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract/',
    langPath: '/vendor/tesseract/lang',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') alAvanzar?.(Math.round(m.progress * 100))
    },
  })
  try {
    const { data } = await worker.recognize(foto)
    return data.text
  } finally {
    await worker.terminate()
  }
}

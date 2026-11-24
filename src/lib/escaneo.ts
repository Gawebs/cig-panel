'use client'

/**
 * Herramientas del navegador para documentos:
 * - fotos o PDF → un solo PDF liviano (las fotos se achican y comprimen antes de subir)
 * - lectura del código de barras del DNI
 * - lectura del texto del dorso del DNI (lector local, sin servicios externos)
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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
/**
 * Une fotos y PDF en un solo PDF. `rotulos`: título que se escribe arriba de cada foto, en el mismo orden
 * (ej.: FRENTE, CONTRAFRENTE…), para que Catastro sepa qué es cada una.
 */
export async function unirEnPdf(archivos: File[], rotulos?: string[]): Promise<{ bytes: Uint8Array; paginas: number }> {
  if (archivos.length === 0) throw new Error('No hay archivos para unir.')
  const pdf = await PDFDocument.create()
  const A4 = { ancho: 595.28, alto: 841.89, margen: 18 }
  const negrita = rotulos?.length ? await pdf.embedFont(StandardFonts.HelveticaBold) : null
  const ALTO_ROTULO = 46

  for (const [n, archivo] of archivos.entries()) {
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
    const rotulo = rotulos?.[n]
    const arriba = rotulo && negrita ? ALTO_ROTULO : 0
    const escala = Math.min((A4.ancho - 2 * A4.margen) / ancho, (A4.alto - 2 * A4.margen - arriba) / alto)
    const w = ancho * escala
    const h = alto * escala
    // Foto y título se centran juntos: el título queda justo arriba de la foto.
    const y = (A4.alto - h - arriba) / 2
    pagina.drawImage(imagen, { x: (A4.ancho - w) / 2, y, width: w, height: h })
    if (rotulo && negrita) {
      const tam = 20
      const ancho = negrita.widthOfTextAtSize(rotulo, tam)
      pagina.drawText(rotulo, { x: (A4.ancho - ancho) / 2, y: y + h + 16, size: tam, font: negrita, color: rgb(0, 0, 0) })
    }
  }

  return { bytes: await pdf.save(), paginas: pdf.getPageCount() }
}

type Zxing = typeof import('@zxing/library')
let zxingCargado: Promise<Zxing> | null = null

/**
 * Busca el código PDF417 en una imagen ya dibujada (cuadro de la cámara en vivo).
 * Un solo intento, sin giros: la cámara guiada ya muestra el DNI derecho.
 */
export async function leerCodigoEnCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  zxingCargado ??= import('@zxing/library')
  const zxing = await zxingCargado
  const hints = new Map()
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.PDF_417])
  hints.set(zxing.DecodeHintType.TRY_HARDER, true)
  try {
    const fuente = new zxing.HTMLCanvasElementLuminanceSource(canvas)
    return new zxing.PDF417Reader().decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(fuente)), hints).getText()
  } catch {
    return null
  }
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

/** Foto girada, a un tamaño cómodo para el lector y en escala de grises con contraste estirado. */
async function prepararParaLeer(img: ImageBitmap, giro: number): Promise<Blob> {
  // El texto del dorso es chico: se lleva el lado mayor a ~2400 px (agranda fotos chicas, achica las enormes).
  const escala = 2400 / Math.max(img.width, img.height)
  const w = Math.round(img.width * escala)
  const h = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = giro % 180 === 0 ? w : h
  canvas.height = giro % 180 === 0 ? h : w
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((giro * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)

  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const p = datos.data
  const grises = new Uint8Array(p.length / 4)
  const histo = new Uint32Array(256)
  for (let i = 0, j = 0; i < p.length; i += 4, j++) {
    const g = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2])
    grises[j] = g
    histo[g]++
  }
  // Estira el contraste entre el 2 % más oscuro y el 2 % más claro (fotos con poca luz o lavadas).
  const corte = grises.length * 0.02
  let bajo = 0, alto = 255, acum = 0
  for (let v = 0; v < 256; v++) { acum += histo[v]; if (acum > corte) { bajo = v; break } }
  acum = 0
  for (let v = 255; v >= 0; v--) { acum += histo[v]; if (acum > corte) { alto = v; break } }
  const rango = Math.max(1, alto - bajo)
  for (let i = 0, j = 0; i < p.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, Math.round(((grises[j] - bajo) * 255) / rango)))
    p[i] = p[i + 1] = p[i + 2] = v
  }
  ctx.putImageData(datos, 0, 0)
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la imagen.'))), 'image/png'),
  )
}

/**
 * Lee el texto impreso de una foto (dorso del DNI). Corre en el navegador, con recursos propios.
 * Si se pasa `sirve`, prueba la foto derecha y girada hasta que el texto sirva (muchas fotos salen de costado).
 */
export async function leerTexto(
  foto: Blob,
  alAvanzar?: (porcentaje: number) => void,
  sirve?: (texto: string) => boolean,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const giros = sirve ? [0, 90, 270, 180] : [0]
  let vuelta = 0
  const worker = await createWorker('spa', 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract/',
    langPath: '/vendor/tesseract/lang',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') alAvanzar?.(Math.round(((vuelta + m.progress) / giros.length) * 100))
    },
  })
  try {
    const img = await cargarImagen(foto)
    const textos: string[] = []
    for (const giro of giros) {
      const { data } = await worker.recognize(await prepararParaLeer(img, giro))
      if (!sirve || sirve(data.text)) return data.text
      textos.push(data.text)
      vuelta++
    }
    return textos.join('\n')
  } finally {
    await worker.terminate()
  }
}

'use client'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const A4: [number, number] = [595.28, 841.89]

/** Hoja con las coordenadas escritas en la ficha (va al principio del PDF de ubicación). */
export async function agregarHojaCoordenadas(pdf: PDFDocument, coordenadas: string, numeroInterno: string) {
  const hoja = pdf.addPage(A4)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const [lat, lng] = coordenadas.split(',').map((x) => x.trim())
  hoja.drawText('COORDENADAS DE UBICACIÓN DEL INMUEBLE', { x: 60, y: 760, size: 15, font: negrita })
  hoja.drawText(`Expediente ${numeroInterno}`, { x: 60, y: 735, size: 11, font: normal, color: rgb(0.3, 0.3, 0.3) })
  hoja.drawText(`${lat},${lng}`, { x: 60, y: 690, size: 20, font: negrita })
  hoja.drawText(`Latitud: ${lat}    Longitud: ${lng}`, { x: 60, y: 662, size: 11, font: normal })
  hoja.drawText(`Ver en el mapa: https://www.google.com/maps?q=${lat},${lng}`, { x: 60, y: 640, size: 10, font: normal, color: rgb(0.1, 0.3, 0.7) })
}

/** Parte un texto en renglones que entren en `ancho`. */
function renglones(texto: string, medir: (t: string) => number, ancho: number): string[] {
  const salida: string[] = []
  let actual = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (medir(prueba) > ancho && actual) {
      salida.push(actual)
      actual = palabra
    } else actual = prueba
  }
  if (actual) salida.push(actual)
  return salida
}

/**
 * Hoja que ocupa el lugar de un documento que todavía no se cargó (solo en la vista previa,
 * nunca en el PDF que se baja para Catastro).
 */
export async function agregarHojaFalta(pdf: PDFDocument, titulo: string, detalle?: string) {
  const hoja = pdf.addPage(A4)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const rojo = rgb(0.75, 0.15, 0.15)
  hoja.drawRectangle({ x: 40, y: 40, width: A4[0] - 80, height: A4[1] - 80, borderColor: rojo, borderWidth: 2, borderDashArray: [10, 6] })
  hoja.drawText('FALTA', { x: (A4[0] - negrita.widthOfTextAtSize('FALTA', 48)) / 2, y: 520, size: 48, font: negrita, color: rojo })
  let y = 470
  for (const r of renglones(titulo, (t) => negrita.widthOfTextAtSize(t, 18), A4[0] - 140)) {
    hoja.drawText(r, { x: (A4[0] - negrita.widthOfTextAtSize(r, 18)) / 2, y, size: 18, font: negrita, color: rgb(0.15, 0.15, 0.15) })
    y -= 24
  }
  if (detalle) {
    y -= 8
    for (const r of renglones(detalle, (t) => normal.widthOfTextAtSize(t, 12), A4[0] - 140)) {
      hoja.drawText(r, { x: (A4[0] - normal.widthOfTextAtSize(r, 12)) / 2, y, size: 12, font: normal, color: rgb(0.35, 0.35, 0.35) })
      y -= 16
    }
  }
}

/** Copia todas las hojas de un PDF dentro de otro. */
export async function agregarPdf(pdf: PDFDocument, bytes: ArrayBuffer) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const paginas = await pdf.copyPages(doc, doc.getPageIndices())
  paginas.forEach((p) => pdf.addPage(p))
}

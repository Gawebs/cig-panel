'use client'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { textoImpreso, type Plantilla } from './plantillas'

/** Huella de los valores impresos: si cambia, el papel firmado ya no coincide con la ficha. */
export function huellaDe(valores: Record<string, string>): string {
  const texto = JSON.stringify(Object.keys(valores).sort().map((k) => [k, valores[k].trim()]))
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Escribe los valores sobre el PDF original de Catastro. */
export async function generarPdf(
  plantilla: Plantilla,
  valores: Record<string, string>,
  /** PDF cargados en el expediente, por requisito (croquis, fotos), para dibujarlos dentro del formulario. */
  imagenes: Record<string, ArrayBuffer> = {},
): Promise<Uint8Array> {
  const original = await fetch(plantilla.archivo).then((r) => {
    if (!r.ok) throw new Error('No se pudo cargar el formulario original.')
    return r.arrayBuffer()
  })
  const pdf = await PDFDocument.load(original)
  const fuente = await pdf.embedFont(StandardFonts.Helvetica)

  // Se escribe sobre las hojas originales y al final se quitan las que no se imprimen:
  // si se quitan antes, pdf-lib pierde lo escrito en algunas hojas (pasaba con el Anexo I).
  const pagina = (n: number) => pdf.getPage(n)

  const escribir = (n: number, texto: string, x0: number, x1: number, y: number) => {
    if (!texto) return
    const p = pagina(n)
    let tam = 10
    while (tam > 6 && fuente.widthOfTextAtSize(texto, tam) > x1 - x0) tam -= 0.5
    p.drawText(texto, { x: x0, y: p.getHeight() - (y - 4), size: tam, font: fuente, color: rgb(0, 0, 0) })
  }

  // Texto largo en varios renglones: se corta por palabras al ancho del renglón.
  const escribirRenglones = (c: (typeof plantilla.campos)[number], texto: string) => {
    const p = pagina(c.pagina)
    const tam = 9.5
    const renglones: string[] = []
    for (const parrafo of texto.split(/\n+/)) {
      let actual = ''
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra
        if (fuente.widthOfTextAtSize(prueba, tam) > c.x1 - c.x0 && actual) {
          renglones.push(actual)
          actual = palabra
        } else actual = prueba
      }
      if (actual) renglones.push(actual)
    }
    const alturas = c.renglones ?? Array.from({ length: c.lineas ?? 1 }, (_, i) => c.y + i * (c.interlineado ?? 14))
    renglones.slice(0, alturas.length).forEach((r, i) => {
      p.drawText(r, { x: c.x0, y: p.getHeight() - (alturas[i] - 4), size: tam, font: fuente, color: rgb(0, 0, 0) })
    })
  }

  for (const c of plantilla.campos) {
    const valor = textoImpreso(c, valores[c.id] ?? '')
    if ((c.lineas && c.lineas > 1) || c.renglones) {
      escribirRenglones(c, valor)
      continue
    }
    if (c.partes) {
      // Fecha repartida en los espacios del rótulo "Fecha: __ / __ / ____"
      valor.split('/').forEach((parte, i) => c.partes![i] && escribir(c.pagina, parte, c.partes![i][0], c.partes![i][1], c.y))
      continue
    }
    if (c.id === 'fecha') {
      // La fecha va repartida en los tres espacios del rótulo "Fecha __ / __ / ____"
      const [d = '', m = '', a = ''] = valor.split('/')
      escribir(c.pagina, d, c.x0 + 6, c.x0 + 26, c.y)
      escribir(c.pagina, m, c.x0 + 35, c.x0 + 53, c.y)
      escribir(c.pagina, a, c.x0 + 62, c.x1, c.y)
      continue
    }
    escribir(c.pagina, valor, c.x0, c.x1, c.y)
  }

  for (const k of plantilla.casillas) {
    if (!valores[k.id]) continue
    const p = pagina(k.pagina)
    p.drawText('X', { x: k.x - 3.7, y: p.getHeight() - (k.y + 4.1), size: 11, font: fuente, color: rgb(0, 0, 0) })
  }

  // Croquis y fotos: cada hoja del PDF cargado se dibuja dentro de su recuadro, sin deformarla.
  const cargados = new Map<string, PDFDocument>()
  for (const im of plantilla.imagenes ?? []) {
    const bytes = imagenes[im.requisito]
    if (!bytes) continue
    if (!cargados.has(im.requisito)) cargados.set(im.requisito, await PDFDocument.load(bytes, { ignoreEncryption: true }))
    const origen = cargados.get(im.requisito)!
    if (im.hoja >= origen.getPageCount()) continue
    const [hoja] = await pdf.embedPdf(origen, [im.hoja])
    const ancho = im.x1 - im.x0
    const alto = im.y1 - im.y0
    const escala = Math.min(ancho / hoja.width, alto / hoja.height)
    const w = hoja.width * escala
    const h = hoja.height * escala
    const p = pagina(im.pagina)
    p.drawPage(hoja, { x: im.x0 + (ancho - w) / 2, y: p.getHeight() - im.y0 - (alto + h) / 2, width: w, height: h })
  }

  for (let i = pdf.getPageCount() - 1; i >= 0; i--) if (!plantilla.paginas.includes(i)) pdf.removePage(i)
  return pdf.save()
}

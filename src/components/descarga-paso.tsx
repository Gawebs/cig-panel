'use client'

import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { enlacesDocumentos } from '@/actions/documentos'

/**
 * Arma el PDF de un paso tal como lo pide el portal de Catastro: todos los documentos del paso,
 * en el orden de la lista, en un solo archivo con un nombre que Catastro no rechaza.
 */
export function DescargaPaso(props: {
  expedienteId: string
  numeroInterno: string
  paso: number
  /** Cuando el paso se sube en varios PDF (ej.: 2a fotos, 2b ubicación): letra y nombre de esta parte. */
  parte?: { letra: string; titulo: string }
  documentos: string[] // ids en orden
  /** Coordenadas escritas en la ficha: se agrega una hoja con ellas al principio. */
  hojaCoordenadas?: string
  completo: boolean
}) {
  const [estado, setEstado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const nombrePaso = `${props.paso}${props.parte?.letra ?? ''}`

  if (props.documentos.length === 0 && !props.hojaCoordenadas) return null

  const descargar = async () => {
    setOcupado(true)
    setEstado('Armando el PDF…')
    try {
      const { urls, error } = await enlacesDocumentos(props.expedienteId, props.documentos)
      if (error || !urls) throw new Error(error)
      const final = await PDFDocument.create()
      if (props.hojaCoordenadas) {
        const hoja = final.addPage([595.28, 841.89])
        const negrita = await final.embedFont(StandardFonts.HelveticaBold)
        const normal = await final.embedFont(StandardFonts.Helvetica)
        const [lat, lng] = props.hojaCoordenadas.split(',').map((x) => x.trim())
        hoja.drawText('COORDENADAS DE UBICACIÓN DEL INMUEBLE', { x: 60, y: 760, size: 15, font: negrita })
        hoja.drawText(`Expediente ${props.numeroInterno}`, { x: 60, y: 735, size: 11, font: normal, color: rgb(0.3, 0.3, 0.3) })
        hoja.drawText(`${lat},${lng}`, { x: 60, y: 690, size: 20, font: negrita })
        hoja.drawText(`Latitud: ${lat}    Longitud: ${lng}`, { x: 60, y: 662, size: 11, font: normal })
        hoja.drawText(`Ver en el mapa: https://www.google.com/maps?q=${lat},${lng}`, { x: 60, y: 640, size: 10, font: normal, color: rgb(0.1, 0.3, 0.7) })
      }
      for (const url of urls) {
        const bytes = await fetch(url).then((r) => {
          if (!r.ok) throw new Error('No se pudo bajar un documento.')
          return r.arrayBuffer()
        })
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const paginas = await final.copyPages(doc, doc.getPageIndices())
        paginas.forEach((p) => final.addPage(p))
      }
      final.setTitle(`${props.numeroInterno} - Paso ${nombrePaso}${props.parte ? ` - ${props.parte.titulo}` : ''}`)
      const archivo = new Blob([(await final.save()) as BlobPart], { type: 'application/pdf' })
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(archivo)
      enlace.download = `P${nombrePaso}-${props.numeroInterno}.pdf`
      enlace.click()
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10000)
      setEstado(`Listo: ${final.getPageCount()} páginas, ${(archivo.size / 1024 / 1024).toFixed(1)} MB.`)
    } catch (e) {
      setEstado(e instanceof Error && e.message ? e.message : 'No se pudo armar el PDF.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" onClick={descargar} disabled={ocupado} className={props.completo ? 'boton-principal min-h-9 text-sm' : 'boton min-h-9 text-sm'}>
        {ocupado ? 'Armando…' : props.parte ? `PDF ${nombrePaso}: ${props.parte.titulo}` : `PDF del paso ${props.paso} para Catastro`}
      </button>
      {!props.completo && <span className="text-sm text-aviso">Todavía falta documentación {props.parte ? 'de esta parte' : 'de este paso'}.</span>}
      {estado && <span className="text-sm text-tenue" aria-live="polite">{estado}</span>}
    </div>
  )
}

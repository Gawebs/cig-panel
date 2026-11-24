'use client'

import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { agregarHojaCoordenadas, agregarPdf } from '@/lib/pdf-paso'
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
      if (props.hojaCoordenadas) await agregarHojaCoordenadas(final, props.hojaCoordenadas, props.numeroInterno)
      for (const url of urls) {
        const bytes = await fetch(url).then((r) => {
          if (!r.ok) throw new Error('No se pudo bajar un documento.')
          return r.arrayBuffer()
        })
        await agregarPdf(final, bytes)
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

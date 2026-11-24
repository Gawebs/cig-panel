'use client'

import { useEffect, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { enlacesDocumentos } from '@/actions/documentos'
import { agregarHojaCoordenadas, agregarHojaFalta, agregarPdf } from '@/lib/pdf-paso'

export interface EntradaVista {
  id: string
  titulo: string
  /** Documentos cargados, en orden. */
  documentos: string[]
  /** Falta (o falta completar) este documento: se muestra una hoja "FALTA" en su lugar. */
  falta: boolean
  /** Texto chico de la hoja "FALTA" (ej.: "1 de 2 cargadas"). */
  detalle?: string
  opcional?: boolean
}

export interface ParteVista {
  nombre: string
  hojaCoordenadas?: string
  entradas: EntradaVista[]
}

const ANCHO_PANEL = '46vw'

/**
 * "Ver cómo va quedando": arma en el momento el PDF del paso tal como va a ir a Catastro, con una hoja
 * "FALTA" en el lugar de cada documento que todavía no está, y lo muestra al lado de la lista.
 * Se rearma solo cada vez que se sube o se quita un documento.
 */
export function VistaPreviaPaso(props: { expedienteId: string; numeroInterno: string; partes: ParteVista[] }) {
  const [abierta, setAbierta] = useState(false)
  const [parte, setParte] = useState(0)
  const [url, setUrl] = useState('')
  const [estado, setEstado] = useState('')
  const [angosta, setAngosta] = useState(false)
  const cache = useRef(new Map<string, ArrayBuffer>())
  const actual = props.partes[Math.min(parte, props.partes.length - 1)]
  const firma = JSON.stringify(actual)

  // Pantalla ancha: el panel va a la derecha y la ficha se corre. Angosta (celular): ocupa toda la pantalla.
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 1024px)')
    const ver = () => setAngosta(!consulta.matches)
    ver()
    consulta.addEventListener('change', ver)
    return () => consulta.removeEventListener('change', ver)
  }, [])
  useEffect(() => {
    if (!abierta || angosta) return
    const antes = document.body.style.marginRight
    document.body.style.marginRight = ANCHO_PANEL
    return () => { document.body.style.marginRight = antes }
  }, [abierta, angosta])

  // Armar el PDF de la parte elegida.
  useEffect(() => {
    if (!abierta) return
    let cancelado = false
    let enlace = ''
    ;(async () => {
      setEstado('Armando la vista…')
      try {
        const parteActual = JSON.parse(firma) as ParteVista
        const ids = parteActual.entradas.flatMap((e) => e.documentos).filter((id) => !cache.current.has(id))
        if (ids.length) {
          const { urls, error } = await enlacesDocumentos(props.expedienteId, ids)
          if (error || !urls) throw new Error(error)
          await Promise.all(urls.map(async (u, i) => {
            const r = await fetch(u)
            if (!r.ok) throw new Error('No se pudo bajar un documento.')
            cache.current.set(ids[i], await r.arrayBuffer())
          }))
        }
        const pdf = await PDFDocument.create()
        if (parteActual.hojaCoordenadas) await agregarHojaCoordenadas(pdf, parteActual.hojaCoordenadas, props.numeroInterno)
        let faltan = 0
        for (const e of parteActual.entradas) {
          for (const id of e.documentos) await agregarPdf(pdf, cache.current.get(id)!)
          if (e.falta && !e.opcional) {
            faltan++
            await agregarHojaFalta(pdf, e.titulo, e.detalle)
          }
        }
        if (pdf.getPageCount() === 0) await agregarHojaFalta(pdf, 'Todavía no hay nada cargado en este PDF')
        if (cancelado) return
        enlace = URL.createObjectURL(new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' }))
        setUrl(enlace)
        setEstado(`${pdf.getPageCount()} ${pdf.getPageCount() === 1 ? 'hoja' : 'hojas'}${faltan ? ` · faltan ${faltan} documento(s)` : ' · completo'}`)
      } catch (e) {
        if (!cancelado) setEstado(e instanceof Error && e.message ? e.message : 'No se pudo armar la vista.')
      }
    })()
    return () => {
      cancelado = true
      if (enlace) URL.revokeObjectURL(enlace)
    }
  }, [abierta, firma, props.expedienteId, props.numeroInterno])

  return (
    <>
      <button type="button" onClick={() => setAbierta((a) => !a)} className="boton min-h-9 text-sm" aria-expanded={abierta}>
        {abierta ? 'Cerrar la vista' : 'Ver cómo va quedando'}
      </button>
      {abierta && (
        <aside
          className="fixed inset-y-0 right-0 z-40 flex flex-col border-l border-linea bg-papel shadow-xl"
          style={{ width: angosta ? '100vw' : ANCHO_PANEL }}
          aria-label="Vista del PDF para Catastro"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-linea px-4 py-3">
            <p className="min-w-0 flex-1 font-semibold">Así va quedando</p>
            <button type="button" onClick={() => setAbierta(false)} className="rounded-md px-3 py-1 text-2xl leading-none hover:bg-azul-suave" aria-label="Cerrar la vista">×</button>
            {props.partes.length > 1 && (
              <div className="flex w-full flex-wrap gap-2">
                {props.partes.map((p, i) => (
                  <button
                    key={p.nombre}
                    type="button"
                    onClick={() => setParte(i)}
                    aria-pressed={i === parte}
                    className={`boton min-h-8 text-sm ${i === parte ? 'border-azul bg-azul-suave' : ''}`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            {props.partes.length === 1 && <p className="w-full text-sm text-tenue">{actual.nombre}</p>}
            {estado && <p className="w-full text-sm text-tenue" aria-live="polite">{estado}</p>}
          </div>
          {url && (angosta ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <a href={url} target="_blank" rel="noopener" className="boton-principal">Abrir el PDF</a>
            </div>
          ) : (
            <iframe key={url} src={url} title="Vista del PDF" className="min-h-0 w-full flex-1" />
          ))}
        </aside>
      )}
    </>
  )
}

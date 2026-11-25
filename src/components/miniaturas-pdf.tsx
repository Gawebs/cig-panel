'use client'

import { useEffect, useRef, useState } from 'react'
import { enlaceDocumento } from '@/actions/documentos'

type DocPdf = Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']>

/** Una hoja del PDF dibujada chica. */
function Hoja({ doc, numero, rotulo, ancho }: { doc: DocPdf; numero: number; rotulo?: string; ancho: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const pagina = await doc.getPage(numero)
      if (cancelado || !canvas.current) return
      const base = pagina.getViewport({ scale: 1 })
      const vista = pagina.getViewport({ scale: (ancho / base.width) * (window.devicePixelRatio || 1) })
      canvas.current.width = vista.width
      canvas.current.height = vista.height
      await pagina.render({ canvasContext: canvas.current.getContext('2d')!, viewport: vista }).promise
    })().catch(() => {})
    return () => { cancelado = true }
  }, [doc, numero, ancho])
  return (
    <figure className="grid gap-1">
      <canvas ref={canvas} className="w-full rounded-md border border-linea bg-white" aria-hidden />
      {rotulo && <figcaption className="text-center text-xs font-semibold text-tenue">{rotulo}</figcaption>}
    </figure>
  )
}

/**
 * Las hojas de un documento ya subido (las fotos del inmueble, el croquis), en miniatura.
 * El enlace al archivo dura unos minutos y se pide recién al mostrarlo.
 */
export function MiniaturasPdf({ expedienteId, documentoId, rotulos, titulo, grande }: { expedienteId: string; documentoId: string; rotulos?: string[]; titulo: string; grande?: boolean }) {
  const [doc, setDoc] = useState<DocPdf | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const r = await enlaceDocumento(expedienteId, documentoId)
      if (!r.url) throw new Error(r.error)
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs'
      const d = await pdfjs.getDocument(r.url).promise
      if (!cancelado) { setUrl(r.url); setDoc(d) }
    })().catch((e) => { if (!cancelado) setError(e instanceof Error && e.message ? e.message : 'No se pudo mostrar.') })
    return () => { cancelado = true }
  }, [expedienteId, documentoId])

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{titulo}</p>
        {url && <a href={url} target="_blank" rel="noopener" className="text-sm font-semibold text-azul hover:underline">Ver en grande</a>}
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : !doc ? <p className="text-sm text-tenue">Cargando…</p> : (
        <div className={grande ? 'grid gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
          {Array.from({ length: doc.numPages }, (_, i) => <Hoja key={i} doc={doc} numero={i + 1} rotulo={rotulos?.[i]} ancho={grande ? 520 : 260} />)}
        </div>
      )}
    </div>
  )
}

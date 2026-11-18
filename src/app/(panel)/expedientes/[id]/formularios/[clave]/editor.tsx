'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enlaceDocumento } from '@/actions/documentos'
import { guardarFormulario, registrarImpresion } from '@/actions/formularios'
import { generarPdf, huellaDe } from '@/lib/formularios/imprimir'
import { ESTADO_CIVIL_TEXTO, grupoCasilla, type CampoPlantilla, type Plantilla } from '@/lib/formularios/plantillas'

const ANCHO_PDF = 595.28
const ALTO_PDF = 841.89
const SOLO_LECTURA = new Set(['padron', 'localidad'])

/** Dibuja una página del PDF original en un canvas, al ancho del contenedor. */
function PaginaPdf({ archivo, numero, ancho }: { archivo: string; numero: number; ancho: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ancho) return
    let cancelado = false
    ;(async () => {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs'
      const doc = await pdfjs.getDocument(archivo).promise
      const pagina = await doc.getPage(numero + 1)
      if (cancelado || !canvas.current) return
      const ratio = window.devicePixelRatio || 1
      const vista = pagina.getViewport({ scale: (ancho / ANCHO_PDF) * ratio })
      canvas.current.width = vista.width
      canvas.current.height = vista.height
      await pagina.render({ canvasContext: canvas.current.getContext('2d')!, viewport: vista }).promise
    })()
    return () => { cancelado = true }
  }, [archivo, numero, ancho])
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
}

export function EditorFormulario(props: {
  expedienteId: string
  plantilla: Plantilla
  valoresFicha: Record<string, string>
  editable: boolean
  impreso: { huella: string; fecha: string } | null
  /** Documento cargado para cada requisito que se imprime dentro del formulario (croquis, fotos). */
  documentosImagen?: Record<string, string>
  /** Adónde lleva el botón del pie: el formulario que sigue o, si es el último, la ficha. */
  siguiente?: { href: string; texto: string }
}) {
  const { plantilla, valoresFicha } = props
  const router = useRouter()
  const [valores, setValores] = useState(valoresFicha)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [, startTransition] = useTransition()
  const contenedor = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cambiados = useMemo(
    () => Object.fromEntries(Object.entries(valores).filter(([k, v]) => (valoresFicha[k] ?? '') !== v)),
    [valores, valoresFicha],
  )
  const hayCambios = Object.keys(cambiados).length > 0
  const huellaActual = huellaDe(valoresFicha)
  const desactualizado = props.impreso && props.impreso.huella !== huellaActual

  const escala = ancho / ANCHO_PDF
  const caja = (x0: number, x1: number, y: number, alto = 13) => ({
    left: `${(x0 / ANCHO_PDF) * 100}%`,
    width: `${((x1 - x0) / ANCHO_PDF) * 100}%`,
    top: `${((y - alto + 1) / ALTO_PDF) * 100}%`,
    height: `${(alto / ALTO_PDF) * 100}%`,
    fontSize: `${Math.max(9, 9.5 * escala)}px`,
  })

  const colorCampo = (id: string) =>
    cambiados[id] !== undefined ? 'bg-aviso-suave/90 ring-1 ring-aviso' : valores[id] ? 'bg-verde-suave/70' : 'bg-azul-suave/40 hover:bg-azul-suave/70'

  const guardar = async () => {
    if (!hayCambios) return true
    setOcupado(true)
    const r = await guardarFormulario(props.expedienteId, plantilla.clave, cambiados)
    setOcupado(false)
    setMensaje(r.error ? { tipo: 'error', texto: r.error } : { tipo: 'ok', texto: r.ok ?? 'Guardado.' })
    if (!r.error) startTransition(() => router.refresh())
    return !r.error
  }

  const imprimir = async () => {
    const ventana = window.open('', '_blank')
    try {
      if (!(await guardar())) { ventana?.close(); return }
      setOcupado(true)
      // Croquis y fotos: se bajan los PDF cargados en el expediente y se dibujan dentro del formulario.
      const imagenes: Record<string, ArrayBuffer> = {}
      for (const [requisito, docId] of Object.entries(props.documentosImagen ?? {})) {
        const { url } = await enlaceDocumento(props.expedienteId, docId)
        if (url) imagenes[requisito] = await (await fetch(url)).arrayBuffer()
      }
      const bytes = await generarPdf(plantilla, valores, imagenes)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      if (ventana) ventana.location.href = url
      else window.location.assign(url)
      await registrarImpresion(props.expedienteId, plantilla.clave, huellaDe(valores))
      setMensaje({ tipo: 'ok', texto: 'Formulario listo para imprimir. Después de firmarlo, cargalo escaneado en la ficha.' })
    } catch (e) {
      ventana?.close()
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo generar el formulario.' })
    } finally {
      setOcupado(false)
    }
  }

  const continuar = async () => {
    if (!props.siguiente) return
    if (props.editable && !(await guardar())) return
    router.push(props.siguiente.href)
  }

  const campoInput = (c: CampoPlantilla) => {
    const soloLectura = !props.editable || c.fuente.tipo === 'marco' || c.fuente.tipo === 'fijo' || (c.fuente.tipo === 'expediente' && SOLO_LECTURA.has(c.fuente.campo))
    const comun = {
      id: `f-${c.id}`,
      'aria-label': c.etiqueta,
      title: c.etiqueta + (soloLectura && props.editable ? ' (se cambia desde la ficha)' : ''),
      disabled: soloLectura,
      className: `absolute rounded-sm border-0 px-0.5 font-texto uppercase text-tinta outline-none focus:ring-2 focus:ring-azul ${colorCampo(c.id)}`,
      style: caja(c.x0, c.x1, c.y),
    }
    if (c.renglones || (c.lineas && c.lineas > 1)) {
      const paso = c.renglones ? (c.renglones[c.renglones.length - 1] - c.renglones[0]) / Math.max(1, c.renglones.length - 1) : (c.interlineado ?? 14)
      const lineas = c.renglones?.length ?? c.lineas!
      const alto = (lineas - 1) * paso + 14
      return (
        <textarea
          key={c.id}
          {...comun}
          style={{ ...caja(c.x0, c.x1, (c.renglones?.[0] ?? c.y) + alto - 14, alto) }}
          className={`${comun.className} resize-none`}
          value={valores[c.id] ?? ''}
          onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
        />
      )
    }
    if (c.control === 'estado_civil') {
      return (
        <select key={c.id} {...comun} value={valores[c.id] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}>
          <option value="" />
          {Object.entries(ESTADO_CIVIL_TEXTO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      )
    }
    return (
      <input key={c.id} {...comun} value={valores[c.id] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))} />
    )
  }

  return (
    <div className="grid gap-4">
      {desactualizado && (
        <div role="alert" className="rounded-xl border border-error bg-error-suave px-4 py-3 text-error">
          <strong>Este formulario se imprimió el {new Date(props.impreso!.fecha).toLocaleDateString('es-AR')} con otros datos.</strong>{' '}
          Si ya estaba firmado, hay que volver a imprimirlo, hacerlo firmar y cargarlo de nuevo.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {props.editable && (
          <button type="button" onClick={guardar} disabled={!hayCambios || ocupado} className="boton">
            {hayCambios ? `Guardar ${Object.keys(cambiados).length} cambio(s)` : 'Sin cambios'}
          </button>
        )}
        <button type="button" onClick={imprimir} disabled={ocupado} className="boton-principal">
          {ocupado ? 'Preparando…' : 'Imprimir para firmar'}
        </button>
        <span className="flex flex-wrap gap-3 text-sm text-tenue">
          <span><span className="mr-1 inline-block size-3 rounded-sm bg-verde-suave align-middle" />Lleno desde la ficha</span>
          <span><span className="mr-1 inline-block size-3 rounded-sm bg-aviso-suave ring-1 ring-aviso align-middle" />Corregido a mano</span>
          <span><span className="mr-1 inline-block size-3 rounded-sm bg-azul-suave align-middle" />Vacío</span>
        </span>
      </div>
      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : undefined} className={mensaje.tipo === 'error' ? 'text-error' : 'text-ok'}>{mensaje.texto}</p>
      )}
      {plantilla.nota && <p className="text-sm text-tenue">{plantilla.nota}</p>}

      <div ref={contenedor} className="mx-auto grid w-full max-w-[900px] gap-6">
        {plantilla.paginas.map((n) => (
          <div key={n} className="relative w-full overflow-hidden rounded-lg border border-linea bg-white shadow-sm" style={{ aspectRatio: `${ANCHO_PDF} / ${ALTO_PDF}` }}>
            <PaginaPdf archivo={plantilla.archivo} numero={n} ancho={ancho} />
            {plantilla.campos.filter((c) => c.pagina === n).map(campoInput)}
            {(plantilla.imagenes ?? []).filter((im) => im.pagina === n).map((im) => (
              <div
                key={im.id}
                className="absolute grid place-items-center rounded border border-dashed border-azul/50 bg-azul-suave/30 p-1 text-center text-azul"
                style={{ left: `${(im.x0 / ANCHO_PDF) * 100}%`, top: `${(im.y0 / ALTO_PDF) * 100}%`, width: `${((im.x1 - im.x0) / ANCHO_PDF) * 100}%`, height: `${((im.y1 - im.y0) / ALTO_PDF) * 100}%`, fontSize: `${Math.max(10, 11 * escala)}px` }}
              >
                {props.documentosImagen?.[im.requisito] ? `${im.etiqueta}: se imprime el cargado en la ficha` : `${im.etiqueta}: todavía no está cargado`}
              </div>
            ))}
            {plantilla.casillas.filter((k) => k.pagina === n).map((k) => (
              <button
                key={k.id}
                type="button"
                disabled={!props.editable || k.valor === '*'}
                aria-label={`${k.etiqueta}: ${valores[k.id] ? 'marcado' : 'sin marcar'}`}
                aria-pressed={Boolean(valores[k.id])}
                onClick={() =>
                  setValores((v) => {
                    const nuevo = { ...v }
                    // Las casillas de un mismo dato son excluyentes (capital/interior, compra/otro), salvo las múltiples
                    if (!k.multiple) plantilla.casillas.filter((o) => grupoCasilla(o) === grupoCasilla(k)).forEach((o) => { nuevo[o.id] = '' })
                    nuevo[k.id] = v[k.id] ? '' : 'X'
                    return nuevo
                  })
                }
                className={`absolute grid place-items-center rounded-sm font-bold text-tinta ${colorCampo(k.id)}`}
                style={{ ...caja(k.x - 7, k.x + 7, k.y + 7, 14), fontSize: `${Math.max(10, 11 * escala)}px` }}
              >
                {valores[k.id] ? 'X' : ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {props.siguiente && (
        <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-end gap-3 border-t border-linea pt-4">
          {props.editable && hayCambios && <span className="text-sm text-tenue">Se guardan los cambios antes de seguir.</span>}
          <button type="button" onClick={continuar} disabled={ocupado} className="boton-principal">
            {ocupado ? 'Guardando…' : `${props.siguiente.texto} →`}
          </button>
        </div>
      )}
    </div>
  )
}

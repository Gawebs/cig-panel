'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { aMedioEscribir } from '@/lib/formularios/a-medio-escribir'
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
  anterior?: { href: string; texto: string }
  /** Datos obligatorios que todavía faltan en la ficha: se avisan antes de imprimir. */
  faltanDatos?: string[]
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

  const guardando = useRef(false)
  const ultimaGuardada = useRef('{}')
  const [guardadoA, setGuardadoA] = useState<Date | null>(null)

  // El autoguardado manda solo lo terminado de escribir; un CUIL o una fecha a medias esperan.
  const listos = useMemo(() => {
    const fuente = new Map(plantilla.campos.map((c) => [c.id, c.fuente]))
    return Object.fromEntries(Object.entries(cambiados).filter(([k, v]) => !aMedioEscribir(fuente.get(k), v)))
  }, [cambiados, plantilla.campos])

  const guardar = async (soloListos = false) => {
    const aMandar = soloListos ? listos : cambiados
    if (!Object.keys(aMandar).length) return true
    if (guardando.current) return false
    guardando.current = true
    setOcupado(true)
    const enviados = JSON.stringify(aMandar)
    const r = await guardarFormulario(props.expedienteId, plantilla.clave, aMandar)
    guardando.current = false
    if (!r.error) ultimaGuardada.current = enviados
    setOcupado(false)
    if (r.error) setMensaje({ tipo: 'error', texto: r.error })
    else {
      setMensaje(null)
      setGuardadoA(new Date())
      startTransition(() => router.refresh())
    }
    return !r.error
  }

  // Autoguardado: a los 2 segundos de dejar de escribir se guarda solo.
  const firmaCambios = JSON.stringify(cambiados)
  useEffect(() => {
    if (!props.editable || !hayCambios || mensaje?.tipo === 'error') return
    const t = setTimeout(() => { void guardar(true) }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaCambios, props.editable])

  // Si queda algo sin guardar, el navegador avisa antes de cerrar o recargar la pestaña.
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  // Salir por el menú (o cualquier link de la pantalla) antes de los 2 segundos: primero se guarda, después se va.
  const guardarRef = useRef(guardar)
  const pendiente = useRef(cambiados)
  useEffect(() => { guardarRef.current = guardar; pendiente.current = cambiados })
  useEffect(() => {
    if (!props.editable || !hayCambios) return
    const alHacerClic = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return
      e.preventDefault()
      e.stopPropagation()
      if (await guardarRef.current()) router.push(url.pathname + url.search + url.hash)
      else if (window.confirm('No se pudieron guardar los últimos cambios. ¿Salir igual y perderlos?')) router.push(url.pathname + url.search + url.hash)
    }
    document.addEventListener('click', alHacerClic, true)
    return () => document.removeEventListener('click', alHacerClic, true)
  }, [hayCambios, props.editable, router])

  // Último recurso (por ejemplo, el botón Atrás del navegador): al cerrar la pantalla se manda lo pendiente.
  useEffect(() => () => {
    const firma = JSON.stringify(pendiente.current)
    if (!props.editable || guardando.current || firma === '{}' || firma === ultimaGuardada.current) return
    void guardarFormulario(props.expedienteId, plantilla.clave, pendiente.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imprimir = async () => {
    const faltan = props.faltanDatos ?? []
    if (faltan.length && !window.confirm(`Este expediente todavía no tiene:\n\n• ${faltan.join('\n• ')}\n\nSi lo imprimís así, el formulario sale incompleto y hay que volver a hacerlo firmar. ¿Imprimir igual?`)) return
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

  // Antes de cambiar de formulario se guarda lo corregido, para no perderlo.
  const irA = async (href?: string) => {
    if (!href) return
    if (props.editable && !(await guardar())) return
    router.push(href)
  }

  const cambiar = (id: string, valor: string) => {
    // CUIL escrito sin guiones: se los ponemos al completar los 11 números.
    const f = plantilla.campos.find((c) => c.id === id)?.fuente
    if (f && 'campo' in f && f.campo === 'cuil' && /^\d{11}$/.test(valor)) valor = `${valor.slice(0, 2)}-${valor.slice(2, 10)}-${valor.slice(10)}`
    setValores((v) => ({ ...v, [id]: valor }))
    if (mensaje?.tipo === 'error') setMensaje(null)
  }

  const campoInput = (c: CampoPlantilla) => {
    // Parte del rótulo que le falta al original (ej.: los dos puntos): se ve como el rótulo, no como casillero.
    if (c.rotulo) {
      return (
        <span key={c.id} aria-hidden className="absolute font-bold leading-none text-black" style={{ ...caja(c.x0, c.x1, c.y), fontFamily: 'Arial, Helvetica, sans-serif', fontSize: `${12 * escala}px` }}>
          {valores[c.id]}
        </span>
      )
    }
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
          onChange={(e) => cambiar(c.id, e.target.value)}
        />
      )
    }
    if (c.control === 'estado_civil') {
      return (
        <select key={c.id} {...comun} value={valores[c.id] ?? ''} onChange={(e) => cambiar(c.id, e.target.value)}>
          <option value="" />
          {Object.entries(ESTADO_CIVIL_TEXTO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      )
    }
    return (
      <input key={c.id} {...comun} value={valores[c.id] ?? ''} onChange={(e) => cambiar(c.id, e.target.value)} />
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
          <span aria-live="polite" className={`text-sm ${hayCambios ? 'text-aviso' : 'text-ok'}`}>
            {ocupado ? 'Guardando…' : hayCambios ? 'Cambios sin guardar (se guardan solos)' : guardadoA ? `✓ Guardado a las ${guardadoA.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '✓ Todo guardado'}
          </span>
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
      {(props.faltanDatos?.length ?? 0) > 0 && (
        <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Faltan {props.faltanDatos!.length} dato(s) del expediente: {props.faltanDatos!.join('; ')}. Lo que se pueda, completalo acá; el resto, en la ficha.
        </p>
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

      {(props.siguiente || props.anterior) && (
        <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
          {props.anterior ? (
            <button type="button" onClick={() => irA(props.anterior?.href)} disabled={ocupado} className="boton">
              ← {props.anterior.texto}
            </button>
          ) : <span />}
          <div className="flex flex-wrap items-center gap-3">
            {props.siguiente && (
              <button type="button" onClick={() => irA(props.siguiente?.href)} disabled={ocupado} className="boton-principal">
                {ocupado ? 'Guardando…' : `${props.siguiente.texto} →`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

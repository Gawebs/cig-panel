'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { consejoFoto, medirImagen, type Consejo, type TipoFoto } from '@/lib/calidad-foto'

export type Validacion<T> = { ok: true; datos: T } | { ok: false; motivo: string }

interface Props<T> {
  titulo: string
  guia: string
  tipo: TipoFoto
  /** dni: recuadro con la forma de la tarjeta. horizontal: recuadro 4:3 (fachadas e interiores). */
  forma: 'dni' | 'horizontal'
  /** Lectura en vivo sobre el recuadro: si devuelve datos, la foto se saca sola. */
  enVivo?: (recuadro: HTMLCanvasElement) => Promise<T | null>
  /** Control después de sacar la foto. Si falla, la foto no se guarda y se pide otra. */
  validar?: (foto: Blob, alAvanzar: (texto: string) => void) => Promise<Validacion<T>>
  alCapturar: (foto: Blob, datos: T | undefined) => void
  alCerrar: () => void
}

interface Rect { x: number; y: number; w: number; h: number }

const PROPORCION = { dni: 85.6 / 54, horizontal: 4 / 3 }
const MUESTRA = 320 // px de ancho para medir luz y nitidez
const LADO_LECTURA = 1600 // px máximos del recuadro para leer el código

function aBlob(canvas: HTMLCanvasElement, calidad = 0.9): Promise<Blob> {
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo guardar la foto.'))), 'image/jpeg', calidad))
}

/**
 * Cámara dentro de la app, con un recuadro guía y consejos en el momento (luz, foco, reflejo).
 * Si el navegador no deja usar la cámara, ofrece la del celular o una foto de la galería.
 */
export function CamaraGuiada<T>(props: Props<T>) {
  const { tipo, forma, enVivo, validar, alCapturar } = props
  const video = useRef<HTMLVideoElement>(null)
  const caja = useRef<HTMLDivElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const ocupado = useRef(false)
  const terminado = useRef(false)
  const vuelta = useRef(0)
  const [guia, setGuia] = useState<Rect | null>(null)
  const [consejo, setConsejo] = useState<Consejo | null>(null)
  // Se abre solo al tocar un botón, así que siempre corre en el navegador.
  const [sinCamara, setSinCamara] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia ? 'Este navegador no deja usar la cámara desde la app.' : '',
  )
  const [estado, setEstado] = useState<'vivo' | 'validando'>('vivo')
  const [aviso, setAviso] = useState('')
  const [vertical, setVertical] = useState(false)

  // Encender la cámara de atrás.
  useEffect(() => {
    let flujo: MediaStream | null = null
    let cancelado = false
    terminado.current = false
    if (!navigator.mediaDevices?.getUserMedia) return
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((f) => {
        if (cancelado) return f.getTracks().forEach((t) => t.stop())
        flujo = f
        if (video.current) {
          video.current.srcObject = f
          video.current.play().catch(() => {})
        }
      })
      .catch((e: unknown) => {
        const nombre = e instanceof DOMException ? e.name : ''
        setSinCamara(
          nombre === 'NotAllowedError'
            ? 'No diste permiso para usar la cámara. Podés darlo en el candado de la barra de direcciones, o usar la cámara del celular.'
            : 'No se pudo abrir la cámara.',
        )
      })
    return () => {
      cancelado = true
      terminado.current = true
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Recuadro guía centrado, del tamaño que entra en la pantalla.
  useEffect(() => {
    const medir = () => {
      const c = caja.current
      if (!c) return
      const cw = c.clientWidth
      const ch = c.clientHeight
      const p = PROPORCION[forma]
      const w = Math.min(cw * (forma === 'dni' ? 0.9 : 0.94), ch * 0.72 * p)
      const h = w / p
      setGuia({ x: (cw - w) / 2, y: (ch - h) / 2, w, h })
      setVertical(ch > cw)
    }
    medir()
    // Al girar el celular cambia el tamaño de la zona de la cámara: se vuelve a medir el recuadro.
    const observador = new ResizeObserver(medir)
    if (caja.current) observador.observe(caja.current)
    window.addEventListener('orientationchange', medir)
    return () => {
      observador.disconnect()
      window.removeEventListener('orientationchange', medir)
    }
  }, [forma, sinCamara])

  // La app instalada está fija en vertical: mientras la cámara está abierta se deja girar,
  // así el recuadro acompaña al celular. Al cerrarla vuelve a vertical.
  useEffect(() => {
    const orientacion = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined
    orientacion?.lock?.('any').catch(() => {})
    return () => { orientacion?.lock?.('portrait').catch(() => {}) }
  }, [])

  /** El recuadro, pasado a píxeles del video (que se muestra recortado para llenar la pantalla). */
  const recuadroEnVideo = useCallback((margen = 0): Rect | null => {
    const v = video.current
    const c = caja.current
    if (!v || !c || !guia || !v.videoWidth) return null
    const escala = Math.max(c.clientWidth / v.videoWidth, c.clientHeight / v.videoHeight)
    const dx = (c.clientWidth - v.videoWidth * escala) / 2
    const dy = (c.clientHeight - v.videoHeight * escala) / 2
    const mx = guia.w * margen
    const my = guia.h * margen
    const x = Math.max(0, (guia.x - mx - dx) / escala)
    const y = Math.max(0, (guia.y - my - dy) / escala)
    return {
      x, y,
      w: Math.min(v.videoWidth - x, (guia.w + 2 * mx) / escala),
      h: Math.min(v.videoHeight - y, (guia.h + 2 * my) / escala),
    }
  }, [guia])

  const dibujar = useCallback((r: Rect, anchoMax: number) => {
    const escala = Math.min(1, anchoMax / r.w)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(r.w * escala)
    canvas.height = Math.round(r.h * escala)
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video.current!, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height)
    return canvas
  }, [])

  /** La foto que se guarda: el recuadro con un poco de margen (documentos) o el cuadro entero (vivienda). */
  const fotoActual = useCallback(async (): Promise<Blob | null> => {
    const v = video.current
    if (!v?.videoWidth) return null
    const r = forma === 'dni' ? recuadroEnVideo(0.06) : { x: 0, y: 0, w: v.videoWidth, h: v.videoHeight }
    return r ? aBlob(dibujar(r, 2400)) : null
  }, [forma, recuadroEnVideo, dibujar])

  const procesar = useCallback(async (foto: Blob, datosEnVivo?: T) => {
    if (terminado.current) return
    if (datosEnVivo !== undefined || !validar) {
      terminado.current = true
      alCapturar(foto, datosEnVivo)
      return
    }
    setEstado('validando')
    setAviso('Revisando la foto…')
    try {
      const r = await validar(foto, setAviso)
      if (r.ok) {
        terminado.current = true
        alCapturar(foto, r.datos)
        return
      }
      setAviso(r.motivo)
    } catch {
      setAviso('No se pudo revisar la foto. Probá de nuevo.')
    }
    setEstado('vivo')
  }, [validar, alCapturar])

  // El aviso de una foto rechazada se borra solo, para volver a ver los consejos.
  useEffect(() => {
    if (!aviso || estado === 'validando') return
    const t = window.setTimeout(() => setAviso(''), 5000)
    return () => window.clearTimeout(t)
  }, [aviso, estado])

  // Consejos en el momento y lectura en vivo.
  useEffect(() => {
    if (sinCamara) return
    const reloj = window.setInterval(async () => {
      if (ocupado.current || terminado.current || estado !== 'vivo') return
      const r = recuadroEnVideo()
      if (!r) return
      ocupado.current = true
      try {
        const muestra = dibujar(r, MUESTRA)
        setConsejo(consejoFoto(medirImagen(muestra.getContext('2d')!.getImageData(0, 0, muestra.width, muestra.height)), tipo))
        vuelta.current++
        if (enVivo && vuelta.current % 2 === 0) {
          const grande = dibujar(r, LADO_LECTURA)
          const datos = await enVivo(grande)
          if (datos && !terminado.current) {
            const foto = await fotoActual()
            if (foto) await procesar(foto, datos)
          }
        }
      } finally {
        ocupado.current = false
      }
    }, 400)
    return () => window.clearInterval(reloj)
  }, [sinCamara, estado, recuadroEnVideo, dibujar, tipo, enVivo, fotoActual, procesar])

  const sacar = async () => {
    const foto = await fotoActual()
    if (foto) await procesar(foto)
  }

  const desdeArchivo = async (archivo?: File) => {
    if (archivo) await procesar(archivo)
  }

  const listo = consejo?.lista ?? false

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={props.titulo}>
      <div className="flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-semibold">{props.titulo}</p>
        <button type="button" onClick={props.alCerrar} className="rounded-md px-3 py-1 text-2xl leading-none hover:bg-white/15" aria-label="Cerrar la cámara">×</button>
      </div>

      <div ref={caja} className="relative min-h-0 flex-1 overflow-hidden">
        {sinCamara ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="grid max-w-sm gap-3">
              <p>{sinCamara}</p>
              <label className="boton-principal cursor-pointer">
                Usar la cámara del celular
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { desdeArchivo(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {aviso && <p className="rounded-lg bg-white/15 px-3 py-2 text-sm" aria-live="polite">{aviso}</p>}
            </div>
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            {guia && (
              <>
                <div
                  className={`pointer-events-none absolute rounded-xl border-4 transition-colors ${listo ? 'border-green-400' : 'border-white/90'}`}
                  style={{ left: guia.x, top: guia.y, width: guia.w, height: guia.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                />
                <p className="absolute inset-x-4 text-center text-sm font-semibold drop-shadow" style={{ top: Math.max(8, guia.y - 52) }}>
                  {props.guia}
                </p>
                <p
                  className={`absolute inset-x-4 mx-auto w-fit max-w-full rounded-full px-3 py-1.5 text-center text-sm font-semibold ${estado === 'validando' || aviso ? 'bg-white text-black' : listo ? 'bg-green-500 text-white' : 'bg-black/70'}`}
                  style={{ top: guia.y + guia.h + 12 }}
                  aria-live="polite"
                >
                  {estado === 'validando' ? aviso : aviso || (vertical && forma === 'horizontal' ? 'Girá el celular para sacarla en horizontal.' : consejo?.texto ?? 'Apuntá la cámara…')}
                </p>
              </>
            )}
          </>
        )}
      </div>

      {!sinCamara && (
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <button type="button" onClick={() => galeria.current?.click()} className="text-sm underline" disabled={estado === 'validando'}>De la galería</button>
          <button
            type="button"
            onClick={() => { setAviso(''); sacar() }}
            disabled={estado === 'validando'}
            className={`size-18 rounded-full border-4 border-white ${listo ? 'bg-green-500' : 'bg-white/30'} disabled:opacity-40`}
            aria-label="Sacar la foto"
          />
          <span className="w-16 text-right text-xs opacity-80">{enVivo ? 'Se saca sola al leerse' : ''}</span>
          <input ref={galeria} type="file" accept="image/*" className="sr-only" onChange={(e) => { setAviso(''); desdeArchivo(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}

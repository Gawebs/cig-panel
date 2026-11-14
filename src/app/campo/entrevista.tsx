'use client'

import { useEffect, useRef, useState } from 'react'
import { guardarArchivo, leerArchivo, type RelevamientoCampo, type RespuestaCampo } from '@/lib/campo/almacen'
import { PREGUNTAS_TITULAR, cuestionario, interpretar, type Pregunta } from '@/lib/relevamiento/cuestionario'
import { equipoAptoParaVoz, prepararReconocimiento, transcribir } from '@/lib/voz/transcribir'
import type { Actualizar } from './relevamiento'

type Paso = { tipo: 'pregunta'; pregunta: Pregunta; persona?: number } | { tipo: 'familia' }

const CLAVE_VOZ = 'cig-voz-en-este-equipo'

function pasos(ley: string, familiares: number): Paso[] {
  const todas = cuestionario(ley, familiares)
  const titular = todas.filter((p) => PREGUNTAS_TITULAR.some((t) => t.clave === p.clave))
  const resto = todas.filter((p) => !titular.includes(p))
  return [
    ...titular.map((pregunta) => ({ tipo: 'pregunta' as const, pregunta })),
    { tipo: 'familia' as const },
    ...resto.map((pregunta) => {
      const m = /^familiar\.(\d+)\./.exec(pregunta.clave)
      return { tipo: 'pregunta' as const, pregunta, persona: m ? Number(m[1]) : undefined }
    }),
  ]
}

function formatoTiempo(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Elige un formato de audio que el navegador sepa grabar (Android: webm; iPhone: mp4). */
function formatoGrabacion(): string | undefined {
  const opciones = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return opciones.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))
}

export function Entrevista({ r, actualizar, enLinea, siguiente }: { r: RelevamientoCampo; actualizar: Actualizar; enLinea: boolean; siguiente: () => void }) {
  const lista = pasos(r.ley, r.familiares)
  const primeraSinResponder = lista.findIndex((p) => p.tipo === 'pregunta' && !r.respuestas[p.pregunta.clave])
  const [indice, setIndice] = useState(Math.max(0, primeraSinResponder))
  const [grabando, setGrabando] = useState(false)
  const [inicio, setInicio] = useState(0)
  const [ahora, setAhora] = useState(0)
  const [error, setError] = useState('')
  const [aMano, setAMano] = useState(false)
  const [vozLocal, setVozLocal] = useState(false)
  const [cargaModelo, setCargaModelo] = useState<number | null>(null)
  const [transcribiendo, setTranscribiendo] = useState<Set<string>>(new Set())
  const microfono = useRef<MediaStream | null>(null)
  const grabador = useRef<MediaRecorder | null>(null)
  const avanzarAlTerminar = useRef(false)

  useEffect(() => {
    let guardada: string | null = null
    try {
      guardada = localStorage.getItem(CLAVE_VOZ)
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en este equipo
    setVozLocal(guardada === null ? equipoAptoParaVoz() : guardada === 'si')
  }, [])

  // Reloj de la grabación
  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(t)
  }, [grabando])

  // Al salir de la entrevista se apaga el micrófono.
  useEffect(() => () => {
    if (grabador.current?.state === 'recording') grabador.current.stop()
    microfono.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const paso = lista[Math.min(indice, lista.length - 1)]
  const total = lista.filter((p) => p.tipo === 'pregunta').length
  const numero = lista.slice(0, indice + 1).filter((p) => p.tipo === 'pregunta').length

  const pasarATexto = async (clave: string, audioId: string) => {
    setTranscribiendo((s) => new Set(s).add(clave))
    try {
      const audio = await leerArchivo(audioId)
      if (!audio) return
      const texto = await transcribir(audio)
      await actualizar((x) => {
        const actual = x.respuestas[clave]
        // Si mientras tanto la regrabaron o la escribieron a mano, no se pisa.
        if (!actual || actual.audioId !== audioId || actual.origen === 'mano') return x
        return { ...x, respuestas: { ...x.respuestas, [clave]: { ...actual, texto, pendienteTexto: false } } }
      })
    } catch {
      // Queda pendiente: se transcribe en la oficina con la grabación.
    } finally {
      setTranscribiendo((s) => {
        const n = new Set(s)
        n.delete(clave)
        return n
      })
    }
  }

  const grabar = async () => {
    setError('')
    try {
      microfono.current ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
    } catch {
      setError('No hay permiso para usar el micrófono. Activalo en el navegador, o escribí la respuesta.')
      return
    }
    if (paso.tipo !== 'pregunta') return
    const clave = paso.pregunta.clave
    const tipo = formatoGrabacion()
    const rec = new MediaRecorder(microfono.current, tipo ? { mimeType: tipo, audioBitsPerSecond: 32000 } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = async () => {
      setGrabando(false)
      const audio = new Blob(partes, { type: rec.mimeType || tipo || 'audio/webm' })
      const audioId = await guardarArchivo(audio)
      const respuesta: RespuestaCampo = { texto: '', origen: 'voz', audioId, pendienteTexto: true }
      await actualizar((x) => ({ ...x, respuestas: { ...x.respuestas, [clave]: respuesta } }))
      if (vozLocal) pasarATexto(clave, audioId)
      if (avanzarAlTerminar.current) setIndice((i) => Math.min(i + 1, lista.length - 1))
    }
    grabador.current = rec
    avanzarAlTerminar.current = false
    rec.start(1000) // guarda de a 1 segundo: si se corta, se pierde lo mínimo
    setInicio(Date.now())
    setAhora(Date.now())
    setGrabando(true)
  }

  const detener = (y_seguir: boolean) => {
    avanzarAlTerminar.current = y_seguir
    grabador.current?.stop()
  }

  const escribir = async (clave: string, texto: string) => {
    await actualizar((x) => {
      const previa = x.respuestas[clave]
      return { ...x, respuestas: { ...x.respuestas, [clave]: { ...previa, texto, origen: 'mano', pendienteTexto: false } } }
    })
  }

  const cambiarVozLocal = async (si: boolean) => {
    setVozLocal(si)
    try {
      localStorage.setItem(CLAVE_VOZ, si ? 'si' : 'no')
    } catch {}
    if (si && enLinea) {
      setCargaModelo(0)
      try {
        await prepararReconocimiento((p) => setCargaModelo(p))
        // Las que quedaron pendientes se pasan ahora.
        for (const [clave, resp] of Object.entries(r.respuestas)) {
          if (resp.pendienteTexto && resp.audioId) pasarATexto(clave, resp.audioId)
        }
      } catch {
        setError('No se pudo preparar el reconocimiento de voz en este equipo. Las respuestas se pasan a texto en la oficina.')
      } finally {
        setCargaModelo(null)
      }
    }
  }

  const ir = (i: number) => {
    if (grabando) return
    setAMano(false)
    setIndice(Math.max(0, Math.min(i, lista.length - 1)))
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-tenue">Pregunta {Math.max(numero, 1)} de {total}</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={vozLocal} onChange={(e) => cambiarVozLocal(e.target.checked)} className="size-4" />
          Pasar a texto en este celular
        </label>
      </div>
      {cargaModelo !== null && (
        <p className="rounded-lg bg-azul-suave p-2 text-sm">Preparando el reconocimiento de voz (solo la primera vez, conviene con wifi): {Math.round(cargaModelo)}%</p>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-linea">
        <div className="h-full bg-ok transition-all" style={{ width: `${(Object.keys(r.respuestas).length / total) * 100}%` }} />
      </div>

      {paso.tipo === 'familia' ? (
        <div className="tarjeta grid gap-4 p-4">
          <p className="etiqueta">Grupo familiar</p>
          <p className="font-titulo text-2xl leading-snug">¿Cuántas personas viven con usted en la casa?</p>
          <p className="text-sm text-tenue">No cuente a usted ni a su pareja si ya figura como cónyuge. Después se pregunta por cada una.</p>
          <div className="flex items-center gap-4">
            <button className="boton size-14 text-2xl" disabled={r.familiares === 0} onClick={() => actualizar((x) => ({ ...x, familiares: Math.max(0, x.familiares - 1) }))} aria-label="Una persona menos">−</button>
            <span className="min-w-12 text-center font-titulo text-4xl" aria-live="polite">{r.familiares}</span>
            <button className="boton size-14 text-2xl" disabled={r.familiares >= 12} onClick={() => actualizar((x) => ({ ...x, familiares: x.familiares + 1 }))} aria-label="Una persona más">+</button>
          </div>
        </div>
      ) : (
        <TarjetaPregunta
          key={paso.pregunta.clave}
          pregunta={paso.pregunta}
          persona={paso.persona}
          respuesta={r.respuestas[paso.pregunta.clave]}
          grabando={grabando}
          tiempo={grabando ? formatoTiempo(ahora - inicio) : ''}
          transcribiendo={transcribiendo.has(paso.pregunta.clave)}
          vozLocal={vozLocal}
          aMano={aMano}
          setAMano={setAMano}
          grabar={grabar}
          detener={detener}
          escribir={(t) => escribir(paso.pregunta.clave, t)}
        />
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <button className="boton flex-1" disabled={indice === 0 || grabando} onClick={() => ir(indice - 1)}>Anterior</button>
        {indice < lista.length - 1 ? (
          <button className="boton flex-1" disabled={grabando} onClick={() => ir(indice + 1)}>Siguiente</button>
        ) : (
          <button className="boton-principal flex-1" disabled={grabando} onClick={siguiente}>Terminar entrevista</button>
        )}
      </div>

      <details className="tarjeta p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Todas las preguntas</summary>
        <ol className="mt-2 grid gap-1">
          {lista.map((p, i) => {
            if (p.tipo === 'familia') return <li key="familia"><button onClick={() => ir(i)} className="text-left text-tenue">Cuántas personas viven en la casa: {r.familiares}</button></li>
            const resp = r.respuestas[p.pregunta.clave]
            return (
              <li key={p.pregunta.clave}>
                <button onClick={() => ir(i)} className={`text-left ${i === indice ? 'font-semibold text-azul' : ''}`}>
                  <span className={resp ? 'text-ok' : 'text-tenue'}>{resp ? '✓' : '○'}</span>{' '}
                  {p.persona ? `Persona ${p.persona}: ` : ''}{p.pregunta.texto}
                </button>
              </li>
            )
          })}
        </ol>
      </details>
    </section>
  )
}

function Escuchar({ audioId }: { audioId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let creada: string | null = null
    leerArchivo(audioId).then((b) => {
      if (b) {
        creada = URL.createObjectURL(b)
        setUrl(creada)
      }
    })
    return () => {
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [audioId])
  return url ? <audio controls src={url} className="h-10 w-full" /> : null
}

function TarjetaPregunta(props: {
  pregunta: Pregunta
  persona?: number
  respuesta?: RespuestaCampo
  grabando: boolean
  tiempo: string
  transcribiendo: boolean
  vozLocal: boolean
  aMano: boolean
  setAMano: (v: boolean) => void
  grabar: () => void
  detener: (y_seguir: boolean) => void
  escribir: (texto: string) => Promise<void>
}) {
  const { pregunta, respuesta } = props
  const [borrador, setBorrador] = useState(respuesta?.texto ?? '')
  const interpretado = respuesta?.texto ? interpretar(pregunta, respuesta.texto) : null

  return (
    <div className="tarjeta grid gap-4 p-4">
      {props.persona && <p className="etiqueta">Persona {props.persona} del grupo familiar</p>}
      <p className="font-titulo text-2xl leading-snug">{pregunta.texto}</p>
      {pregunta.ayuda && <p className="-mt-2 text-sm text-tenue">{pregunta.ayuda}</p>}

      {props.grabando ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 font-semibold text-error" aria-live="polite">
            <span className="size-3 animate-pulse rounded-full bg-error" /> Grabando {props.tiempo}
          </p>
          <button className="boton-principal min-h-14 text-lg" onClick={() => props.detener(true)}>Listo, siguiente pregunta</button>
          <button className="boton" onClick={() => props.detener(false)}>Detener</button>
        </div>
      ) : (
        <div className="grid gap-2">
          <button className="boton-principal min-h-14 text-lg" onClick={props.grabar}>
            <span className="size-3 rounded-full bg-white" /> {respuesta?.audioId ? 'Volver a grabar' : 'Grabar respuesta'}
          </button>
          {!props.aMano && <button className="boton" onClick={() => { setBorrador(respuesta?.texto ?? ''); props.setAMano(true) }}>{respuesta?.texto ? 'Corregir a mano' : 'Escribir a mano'}</button>}
        </div>
      )}

      {props.aMano && !props.grabando && (
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await props.escribir(borrador.trim())
            props.setAMano(false)
          }}
        >
          <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} rows={3} className="campo py-2" aria-label="Respuesta" autoFocus />
          <div className="flex gap-2">
            <button className="boton-principal">Guardar</button>
            <button type="button" className="boton" onClick={() => props.setAMano(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {respuesta && !props.grabando && !props.aMano && (
        <div className="grid gap-2 rounded-lg bg-fondo p-3">
          {respuesta.audioId && <Escuchar audioId={respuesta.audioId} />}
          {props.transcribiendo ? (
            <p className="text-sm text-azul">Pasando a texto…</p>
          ) : respuesta.texto ? (
            <>
              <p className="text-sm"><span className="etiqueta">{respuesta.origen === 'voz' ? 'Entendido de la grabación' : 'Escrito a mano'}</span><br />“{respuesta.texto}”</p>
              {interpretado && (interpretado.muestra ? (
                <p className="text-sm font-semibold text-ok">Se carga en la ficha: {interpretado.muestra}</p>
              ) : (
                <p className="text-sm font-semibold text-aviso">No se entendió el dato. Corregilo a mano o volvé a grabar.</p>
              ))}
            </>
          ) : (
            <p className="text-sm text-tenue">
              Grabación guardada. {props.vozLocal ? 'Se pasa a texto en un momento.' : 'Se pasa a texto en la oficina.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

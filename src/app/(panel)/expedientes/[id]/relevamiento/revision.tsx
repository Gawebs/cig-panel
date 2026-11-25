'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarRespuesta } from '@/actions/relevamiento'
import type { RespuestaGuardada } from '@/lib/relevamiento/aplicar'
import { avisoNoEntendido, interpretar, preguntaPorClave } from '@/lib/relevamiento/cuestionario'
import { transcribir } from '@/lib/voz/transcribir'

/**
 * Revisión en la oficina: se escucha cada respuesta, se corrige el texto y se confirma.
 * Las grabaciones que el celular no pasó a texto se transcriben acá, en esta computadora,
 * sin mandar el audio a ningún servicio de afuera.
 */
export function RevisionRespuestas(props: {
  relevamientoId: string
  preguntas: { clave: string; texto: string }[]
  respuestas: Record<string, RespuestaGuardada>
  audios: Record<string, string>
  editable: boolean
}) {
  const router = useRouter()
  const pendientes = props.preguntas.filter((p) => {
    const r = props.respuestas[p.clave]
    return r?.audio && !r.texto && props.audios[r.audio]
  })
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const empezado = useRef(false)

  useEffect(() => {
    if (!props.editable || empezado.current || pendientes.length === 0) return
    empezado.current = true
    ;(async () => {
      setProgreso({ hechas: 0, total: pendientes.length })
      for (const [i, p] of pendientes.entries()) {
        try {
          const audio = await (await fetch(props.audios[props.respuestas[p.clave].audio!])).blob()
          const texto = await transcribir(audio)
          const res = await guardarRespuesta(props.relevamientoId, p.clave, { texto, origen: 'voz', revisado: false })
          if (res.error) setError(res.error)
        } catch {
          setError('Alguna grabación no se pudo pasar a texto. Escuchala y escribí la respuesta.')
        }
        setProgreso({ hechas: i + 1, total: pendientes.length })
      }
      setProgreso(null)
      router.refresh()
    })()
  }, [props, pendientes, router])

  const porRevisar = props.preguntas.filter((p) => {
    const r = props.respuestas[p.clave]
    return r && r.origen === 'voz' && !r.revisado && r.texto
  })

  const confirmarTodas = async () => {
    for (const p of porRevisar) {
      const r = props.respuestas[p.clave]
      if (!interpretar(preguntaPorClave(p.clave)!, r.texto).muestra) continue // las que no se entendieron, a mano
      await guardarRespuesta(props.relevamientoId, p.clave, { texto: r.texto, origen: r.origen, revisado: true })
    }
    router.refresh()
  }

  return (
    <section className="grid gap-3">
      {progreso && (
        <p className="rounded-lg bg-azul-suave px-4 py-3 text-sm text-azul" role="status">
          Pasando a texto las grabaciones en esta computadora: {progreso.hechas} de {progreso.total}. La primera vez tarda un poco más.
        </p>
      )}
      {error && <p className="rounded-lg bg-error-suave px-4 py-3 text-sm text-error">{error}</p>}
      {props.editable && porRevisar.length > 0 && (
        <div className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <strong>{porRevisar.length}</strong> {porRevisar.length === 1 ? 'respuesta salió' : 'respuestas salieron'} de la grabación y {porRevisar.length === 1 ? 'falta revisarla' : 'falta revisarlas'}.
          </p>
          <button className="boton" onClick={confirmarTodas}>Confirmar las que se entendieron</button>
        </div>
      )}
      <ol className="grid gap-3">
        {props.preguntas.map((p, i) => (
          <Respuesta
            key={`${p.clave}|${props.respuestas[p.clave]?.texto ?? ''}`}
            numero={i + 1}
            clave={p.clave}
            pregunta={p.texto}
            respuesta={props.respuestas[p.clave]}
            audio={props.respuestas[p.clave]?.audio ? props.audios[props.respuestas[p.clave].audio!] : undefined}
            relevamientoId={props.relevamientoId}
            editable={props.editable}
            transcribiendo={Boolean(progreso) && pendientes.some((x) => x.clave === p.clave)}
          />
        ))}
      </ol>
    </section>
  )
}

function Respuesta(props: {
  numero: number
  clave: string
  pregunta: string
  respuesta?: RespuestaGuardada
  audio?: string
  relevamientoId: string
  editable: boolean
  transcribiendo: boolean
}) {
  const router = useRouter()
  const r = props.respuesta
  const [texto, setTexto] = useState(r?.texto ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const familiar = /^familiar\.(\d+)\./.exec(props.clave)
  const interpretado = texto ? interpretar(preguntaPorClave(props.clave)!, texto) : null
  const cambiado = texto.trim() !== (r?.texto ?? '')

  const guardar = async (revisado: boolean) => {
    setGuardando(true)
    setError('')
    const res = await guardarRespuesta(props.relevamientoId, props.clave, {
      texto: texto.trim(), origen: cambiado ? 'mano' : (r?.origen ?? 'mano'), revisado,
    })
    setGuardando(false)
    if (res.error) setError(res.error)
    else router.refresh()
  }

  const estado = !r ? { texto: 'Sin respuesta', clase: 'bg-fondo text-tenue' }
    : r.revisado || r.origen === 'mano' ? { texto: r.origen === 'mano' ? 'Escrita a mano' : 'Revisada', clase: 'bg-ok-suave text-ok' }
    : !r.texto ? { texto: 'Sin pasar a texto', clase: 'bg-azul-suave text-azul' }
    : { texto: 'A revisar', clase: 'bg-aviso-suave text-aviso' }

  return (
    <li className="tarjeta grid gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">
          <span className="text-tenue">{props.numero}.</span> {familiar ? `Persona ${familiar[1]} del grupo familiar: ` : ''}{props.pregunta}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
      </div>
      {props.audio && <audio controls preload="none" src={props.audio} className="h-10 w-full" />}
      {props.transcribiendo ? (
        <p className="text-sm text-azul">Pasando a texto…</p>
      ) : props.editable ? (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="campo py-2" aria-label={`Respuesta: ${props.pregunta}`} />
      ) : (
        <p>{r?.texto || <span className="text-tenue">—</span>}</p>
      )}
      {interpretado && (
        interpretado.muestra
          ? <p className="text-sm text-ok">Va a la ficha como: <strong>{interpretado.muestra}</strong></p>
          : (() => {
              const aviso = avisoNoEntendido(preguntaPorClave(props.clave)!)
              return <p className={`text-sm ${aviso.grave ? 'text-aviso' : 'text-tenue'}`}>{aviso.texto}</p>
            })()
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      {props.editable && (cambiado || (r && r.origen === 'voz' && !r.revisado && r.texto)) && (
        <div className="flex gap-2">
          <button className="boton-principal" disabled={guardando} onClick={() => guardar(true)}>{cambiado ? 'Guardar corrección' : 'Confirmar'}</button>
          {cambiado && <button className="boton" disabled={guardando} onClick={() => setTexto(r?.texto ?? '')}>Deshacer</button>}
        </div>
      )}
    </li>
  )
}

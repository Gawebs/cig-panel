'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { comprimirImagen } from '@/lib/escaneo'
import {
  guardarArchivo, guardarRelevamiento, leerArchivo, leerRelevamiento, relevamientoDe,
  type ClaveFoto, type ExpedienteCampo, type RelevamientoCampo,
} from '@/lib/campo/almacen'
import { cuestionario } from '@/lib/relevamiento/cuestionario'
import { Croquis } from './croquis'
import { Entrevista } from './entrevista'
import { Observaciones, observacionesCompletas } from './observaciones'

export type Actualizar = (mutar: (r: RelevamientoCampo) => RelevamientoCampo) => Promise<void>

const SECCIONES = [
  { id: 'ubicacion', titulo: 'Ubicación' },
  { id: 'fotos', titulo: 'Fotos' },
  { id: 'croquis', titulo: 'Croquis' },
  { id: 'entrevista', titulo: 'Entrevista' },
  { id: 'observaciones', titulo: 'Lo que se ve' },
  { id: 'terminar', titulo: 'Terminar' },
] as const
type Seccion = (typeof SECCIONES)[number]['id']

const FOTOS: { clave: ClaveFoto; titulo: string; guia: string }[] = [
  { clave: 'frente', titulo: 'Frente', guia: 'Desde la vereda de enfrente. Que se vea la casa entera y el número, si tiene.' },
  { clave: 'contrafrente', titulo: 'Contrafrente', guia: 'La parte de atrás de la casa, desde el fondo del terreno.' },
  { clave: 'interior1', titulo: 'Interior 1', guia: 'El ambiente principal: cocina o comedor.' },
  { clave: 'interior2', titulo: 'Interior 2', guia: 'Otro ambiente: un dormitorio o el baño.' },
]

const PRECISION_BUENA = 25 // metros

function seccionDeLaUrl(): Seccion {
  if (typeof window === 'undefined') return 'ubicacion'
  const s = new URLSearchParams(window.location.search).get('s')
  return SECCIONES.some((x) => x.id === s) ? (s as Seccion) : 'ubicacion'
}

export function Relevamiento(props: { expediente: ExpedienteCampo; enLinea: boolean; alGuardar: () => void; alTerminar: () => void }) {
  const { expediente, alGuardar } = props
  const [r, setR] = useState<RelevamientoCampo | null>(null)
  const [seccion, setSeccionActual] = useState<Seccion>(seccionDeLaUrl)
  const cola = useRef(Promise.resolve())

  // Cada parte queda en el historial: el botón "atrás" del celular vuelve a la parte anterior.
  const setSeccion = useCallback((s: Seccion) => {
    const url = new URL(window.location.href)
    url.searchParams.set('s', s)
    window.history.pushState(null, '', url)
    setSeccionActual(s)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const alVolver = () => setSeccionActual(seccionDeLaUrl())
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  useEffect(() => {
    relevamientoDe(expediente).then(setR)
  }, [expediente])

  // Cada cambio se guarda en el celular al instante, en orden, sobre la última versión guardada.
  const actualizar: Actualizar = useCallback(
    (mutar) => {
      const paso = cola.current.then(async () => {
        const id = r?.id
        if (!id) return
        const actual = await leerRelevamiento(id)
        if (!actual) return
        const nuevo = await guardarRelevamiento(mutar(actual))
        setR(nuevo)
        alGuardar()
      })
      cola.current = paso.catch(() => {})
      return paso
    },
    [r?.id, alGuardar],
  )

  if (!r) return <p className="text-tenue">Abriendo…</p>

  const anterior = SECCIONES[SECCIONES.findIndex((s) => s.id === seccion) - 1]

  const totalPreguntas = cuestionario(r.ley, r.familiares).length
  const respondidas = Object.values(r.respuestas).filter((x) => x.texto || x.audioId).length
  const fotos = FOTOS.filter((f) => r.fotos[f.clave]).length
  const hecho: Record<Seccion, boolean> = {
    ubicacion: Boolean(r.gps),
    fotos: fotos === 4,
    croquis: Boolean(r.croquisId),
    entrevista: respondidas >= totalPreguntas,
    observaciones: observacionesCompletas(r.observaciones),
    terminar: r.estado === 'completo',
  }

  return (
    <div className="grid gap-4">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Partes del relevamiento">
        {SECCIONES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            aria-current={seccion === s.id ? 'step' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              seccion === s.id ? 'border-azul bg-azul text-white' : 'border-linea bg-papel'
            }`}
          >
            <span className={`grid size-5 place-items-center rounded-full text-xs ${hecho[s.id] ? 'bg-ok text-white' : seccion === s.id ? 'bg-white/25' : 'bg-fondo'}`}>
              {hecho[s.id] ? '✓' : i + 1}
            </span>
            {s.titulo}
          </button>
        ))}
      </nav>

      {expediente.domicilio && <p className="text-sm text-tenue">{expediente.domicilio}{expediente.barrio ? ` · ${expediente.barrio}` : ''}</p>}

      {seccion === 'ubicacion' && <Ubicacion r={r} actualizar={actualizar} siguiente={() => setSeccion('fotos')} />}
      {seccion === 'fotos' && <Fotos r={r} actualizar={actualizar} siguiente={() => setSeccion('croquis')} />}
      {seccion === 'croquis' && <Croquis r={r} actualizar={actualizar} siguiente={() => setSeccion('entrevista')} />}
      {seccion === 'entrevista' && <Entrevista r={r} actualizar={actualizar} enLinea={props.enLinea} siguiente={() => setSeccion('observaciones')} />}
      {seccion === 'observaciones' && <Observaciones r={r} actualizar={actualizar} siguiente={() => setSeccion('terminar')} />}
      {seccion === 'terminar' && (
        <Terminar
          r={r}
          hecho={hecho}
          fotos={fotos}
          respondidas={respondidas}
          totalPreguntas={totalPreguntas}
          enLinea={props.enLinea}
          irA={setSeccion}
          terminar={async () => {
            await actualizar((x) => ({ ...x, estado: 'completo' }))
            props.alTerminar()
          }}
          reabrir={() => actualizar((x) => ({ ...x, estado: 'en_curso' }))}
        />
      )}

      {anterior && (
        <button className="boton justify-self-start" onClick={() => setSeccion(anterior.id)}>
          ‹ Volver a {anterior.titulo.toLowerCase()}
        </button>
      )}
    </div>
  )
}

// ───────────────────────── Ubicación ─────────────────────────

function Ubicacion({ r, actualizar, siguiente }: { r: RelevamientoCampo; actualizar: Actualizar; siguiente: () => void }) {
  const [lectura, setLectura] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [aMano, setAMano] = useState('')
  const vigilancia = useRef<number | null>(null)

  const parar = () => {
    if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current)
    vigilancia.current = null
    setBuscando(false)
  }
  useEffect(() => parar, [])

  const buscar = () => {
    if (!('geolocation' in navigator)) {
      setError('Este equipo no tiene GPS disponible.')
      return
    }
    setError('')
    setBuscando(true)
    // Se queda escuchando: la precisión mejora en los primeros segundos.
    vigilancia.current = navigator.geolocation.watchPosition(
      (pos) => setLectura((prev) => (!prev || pos.coords.accuracy <= prev.coords.accuracy ? pos : prev)),
      (e) => {
        setError(e.code === e.PERMISSION_DENIED ? 'No hay permiso para usar la ubicación. Activalo en el navegador.' : 'No se pudo leer el GPS. Probá al aire libre.')
        parar()
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 },
    )
  }

  const usar = async () => {
    if (!lectura) return
    parar()
    await actualizar((x) => ({
      ...x,
      gps: { lat: lectura.coords.latitude, lng: lectura.coords.longitude, precision: lectura.coords.accuracy, fecha: new Date(lectura.timestamp).toISOString() },
    }))
  }

  // Sin GPS: se pegan las coordenadas como las da Google Maps (precisión 0 = escritas a mano).
  const usarAMano = async () => {
    const m = aMano.trim().match(/^(-?\d{1,2}\.\d+),\s?(-?\d{1,3}\.\d+)$/)
    if (!m) { setError('Pegalas como las da Google Maps: -26.832206,-65.195481'); return }
    setError('')
    await actualizar((x) => ({ ...x, gps: { lat: Number(m[1]), lng: Number(m[2]), precision: 0, fecha: new Date().toISOString() } }))
    setAMano('')
  }

  const precision = lectura?.coords.accuracy
  return (
    <section className="tarjeta grid gap-3 p-4">
      <h2 className="text-xl">Ubicación del inmueble</h2>
      <p className="text-sm text-tenue">Parate en la puerta de la casa y tocá “Buscar ubicación”. Esperá a que la precisión baje de {PRECISION_BUENA} metros.</p>

      {r.gps && (
        <div className="rounded-lg bg-ok-suave p-3">
          <p className="etiqueta">Guardada</p>
          <p className="font-mono text-lg">{r.gps.lat.toFixed(6)},{r.gps.lng.toFixed(6)}</p>
          <p className="text-sm text-tenue">{r.gps.precision === 0 ? 'Escrita a mano' : `Precisión ${Math.round(r.gps.precision)} m`} · {new Date(r.gps.fecha).toLocaleString('es-AR')}</p>
        </div>
      )}

      {lectura && buscando && (
        <div className={`rounded-lg p-3 ${precision! <= PRECISION_BUENA ? 'bg-ok-suave' : 'bg-aviso-suave'}`}>
          <p className="font-mono text-lg">{lectura.coords.latitude.toFixed(6)},{lectura.coords.longitude.toFixed(6)}</p>
          <p className="text-sm">
            Precisión {Math.round(precision!)} m{precision! > PRECISION_BUENA ? ': esperá unos segundos o salí a la vereda.' : ': buena.'}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!buscando ? (
          <button className="boton-principal" onClick={buscar}>{r.gps ? 'Volver a tomar la ubicación' : 'Buscar ubicación'}</button>
        ) : (
          <>
            <button className="boton-principal" disabled={!lectura} onClick={usar}>Usar esta ubicación</button>
            <button className="boton" onClick={parar}>Cancelar</button>
          </>
        )}
        {!buscando && <button className="boton" onClick={siguiente}>{r.gps ? 'Seguir con las fotos' : 'Seguir sin ubicación'}</button>}
      </div>

      {!buscando && (
        <details className="rounded-lg border border-linea p-3" open={Boolean(error) && !r.gps}>
          <summary className="cursor-pointer text-sm font-semibold">¿No anda el GPS? Escribí las coordenadas</summary>
          <p className="mt-1 text-sm text-tenue">En Google Maps, mantené apretado el punto de la casa y copiá los números que aparecen arriba.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={aMano} onChange={(e) => setAMano(e.target.value)} placeholder="-26.832206,-65.195481" inputMode="decimal" aria-label="Coordenadas escritas a mano" className="campo min-w-0 flex-1" />
            <button className="boton" onClick={usarAMano} disabled={!aMano.trim()}>Guardar</button>
          </div>
        </details>
      )}
    </section>
  )
}

// ───────────────────────── Fotos ─────────────────────────

function Miniatura({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let creada: string | null = null
    leerArchivo(id).then((b) => {
      if (b) {
        creada = URL.createObjectURL(b)
        setUrl(creada)
      }
    })
    return () => {
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [id])
  // eslint-disable-next-line @next/next/no-img-element -- foto local del celular, no pasa por el optimizador
  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null
}

function Fotos({ r, actualizar, siguiente }: { r: RelevamientoCampo; actualizar: Actualizar; siguiente: () => void }) {
  const [procesando, setProcesando] = useState<ClaveFoto | null>(null)
  const [error, setError] = useState('')

  const cargar = async (clave: ClaveFoto, archivo: File | undefined) => {
    if (!archivo) return
    setError('')
    setProcesando(clave)
    try {
      // Se guarda ya achicada: ocupa menos lugar en el celular y sube más rápido.
      const { bytes } = await comprimirImagen(archivo)
      const id = await guardarArchivo(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
      await actualizar((x) => ({ ...x, fotos: { ...x.fotos, [clave]: id } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setProcesando(null)
    }
  }

  const completas = FOTOS.every((f) => r.fotos[f.clave])
  return (
    <section className="grid gap-3">
      <div className="tarjeta p-4">
        <h2 className="text-xl">Las 4 fotos del inmueble</h2>
        <p className="text-sm text-tenue">Catastro pide frente, contrafrente y dos del interior. Con el celular en horizontal y con luz.</p>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {FOTOS.map((f) => (
          <label key={f.clave} className="tarjeta flex cursor-pointer flex-col overflow-hidden">
            <span className="relative grid aspect-[4/3] place-items-center bg-fondo text-center text-sm text-tenue">
              {r.fotos[f.clave] ? <Miniatura id={r.fotos[f.clave]!} /> : procesando === f.clave ? 'Guardando…' : <span className="px-3">Tocá para sacar la foto</span>}
              {r.fotos[f.clave] && <span className="absolute right-2 top-2 rounded-full bg-ok px-2 py-0.5 text-xs font-semibold text-white">✓</span>}
            </span>
            <span className="p-2">
              <span className="block font-semibold">{f.titulo}</span>
              <span className="block text-xs text-tenue">{f.guia}</span>
              {r.fotos[f.clave] && <span className="mt-1 block text-xs font-semibold text-azul">Tocá para volver a sacarla</span>}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label={`Foto: ${f.titulo}`}
              onChange={(e) => {
                cargar(f.clave, e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        ))}
      </div>
      {completas && <button className="boton" onClick={siguiente}>Seguir con el croquis</button>}
    </section>
  )
}

// ───────────────────────── Terminar ─────────────────────────

function Terminar(props: {
  r: RelevamientoCampo
  hecho: Record<Seccion, boolean>
  fotos: number
  respondidas: number
  totalPreguntas: number
  enLinea: boolean
  irA: (s: Seccion) => void
  terminar: () => void
  reabrir: () => void
}) {
  const { r, hecho } = props
  const items: { seccion: Seccion; texto: string; ok: boolean }[] = [
    { seccion: 'ubicacion', texto: r.gps ? (r.gps.precision === 0 ? 'Ubicación escrita a mano' : `Ubicación tomada (precisión ${Math.round(r.gps.precision)} m)`) : 'Falta la ubicación', ok: hecho.ubicacion },
    { seccion: 'fotos', texto: `${props.fotos} de 4 fotos`, ok: hecho.fotos },
    { seccion: 'croquis', texto: hecho.croquis ? 'Croquis dibujado' : 'Falta el croquis', ok: hecho.croquis },
    { seccion: 'entrevista', texto: `${props.respondidas} de ${props.totalPreguntas} respuestas`, ok: hecho.entrevista },
    { seccion: 'observaciones', texto: hecho.observaciones ? 'Observaciones completas' : 'Faltan observaciones del relevador', ok: hecho.observaciones },
  ]
  const faltan = items.filter((i) => !i.ok)
  const pendientesTexto = Object.values(r.respuestas).filter((x) => x.pendienteTexto).length

  return (
    <section className="tarjeta grid gap-3 p-4">
      <h2 className="text-xl">{r.estado === 'completo' ? 'Relevamiento terminado' : 'Antes de irte'}</h2>
      <ul className="grid gap-1.5">
        {items.map((i) => (
          <li key={i.seccion}>
            <button onClick={() => props.irA(i.seccion)} className="flex w-full items-center gap-2 text-left">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${i.ok ? 'bg-ok' : 'bg-aviso'}`}>{i.ok ? '✓' : '!'}</span>
              <span className={i.ok ? '' : 'font-semibold'}>{i.texto}</span>
            </button>
          </li>
        ))}
      </ul>
      {pendientesTexto > 0 && (
        <p className="rounded-lg bg-azul-suave p-3 text-sm">
          {pendientesTexto === 1 ? 'Una respuesta grabada se pasa' : `${pendientesTexto} respuestas grabadas se pasan`} a texto en la oficina. Las grabaciones están guardadas.
        </p>
      )}
      {r.estado === 'completo' ? (
        <>
          <p className="text-sm text-tenue">{props.enLinea ? 'Se sube al expediente ahora.' : 'Se sube solo al expediente cuando haya señal.'}</p>
          <button className="boton" onClick={props.reabrir}>Volver a abrirlo para corregir</button>
        </>
      ) : (
        <>
          {faltan.length > 0 && <p className="text-sm text-aviso">Podés terminar igual y completar lo que falta después, pero conviene hacerlo ahora que estás en el lugar.</p>}
          <p className="text-sm text-tenue">Recordá que el titular y vos tienen que firmar cada hoja del relevamiento social impreso.</p>
          <button className="boton-principal" onClick={props.terminar}>Terminar relevamiento</button>
        </>
      )}
    </section>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { guardarArchivo, leerArchivo, type RelevamientoCampo } from '@/lib/campo/almacen'
import type { Actualizar } from './relevamiento'

type Herramienta = 'lapiz' | 'linea' | 'rectangulo' | 'texto'
type Trazo =
  | { tipo: 'lapiz'; puntos: [number, number][]; grosor: number }
  | { tipo: 'linea' | 'rectangulo'; desde: [number, number]; hasta: [number, number]; grosor: number }
  | { tipo: 'texto'; en: [number, number]; texto: string }

const LADO = 1200 // resolución del dibujo (cuadrado); se ve achicado en pantalla
const GRILLA = 50

// Lo que pide el instructivo de croquis de Catastro.
const CONTENIDO = [
  'La manzana con los nombres de las calles',
  'El terreno marcado, con sus medidas en metros',
  'La distancia a la esquina más cercana',
  'Una referencia visible (escuela, plaza, comercio)',
  'La numeración municipal, si tiene',
]

function dibujar(ctx: CanvasRenderingContext2D, fondo: ImageBitmap | null, trazos: Trazo[], conGrilla: boolean) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, LADO, LADO)
  if (fondo) ctx.drawImage(fondo, 0, 0, LADO, LADO)
  else if (conGrilla) {
    ctx.strokeStyle = '#e6edf2'
    ctx.lineWidth = 1
    for (let i = GRILLA; i < LADO; i += GRILLA) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, LADO); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(LADO, i); ctx.stroke()
    }
  }
  ctx.strokeStyle = '#1b2a3a'
  ctx.fillStyle = '#1b2a3a'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const t of trazos) {
    if (t.tipo === 'texto') {
      ctx.font = '600 52px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 10
      ctx.strokeStyle = '#fff'
      ctx.strokeText(t.texto, t.en[0], t.en[1])
      ctx.fillText(t.texto, t.en[0], t.en[1])
      ctx.strokeStyle = '#1b2a3a'
      continue
    }
    ctx.lineWidth = t.grosor
    ctx.beginPath()
    if (t.tipo === 'lapiz') {
      t.puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    } else if (t.tipo === 'linea') {
      ctx.moveTo(...t.desde)
      ctx.lineTo(...t.hasta)
    } else {
      ctx.rect(t.desde[0], t.desde[1], t.hasta[0] - t.desde[0], t.hasta[1] - t.desde[1])
    }
    ctx.stroke()
  }
}

export function Croquis({ r, actualizar, siguiente }: { r: RelevamientoCampo; actualizar: Actualizar; siguiente: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [fondo, setFondo] = useState<ImageBitmap | null>(null)
  const [trazos, setTrazos] = useState<Trazo[]>([])
  const [herramienta, setHerramienta] = useState<Herramienta>('linea')
  const [grosor, setGrosor] = useState(5)
  const [texto, setTexto] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')
  const enCurso = useRef<Trazo | null>(null)

  // Si ya hay un croquis guardado, se usa de base para seguir dibujando encima.
  useEffect(() => {
    if (!r.croquisId) return
    leerArchivo(r.croquisId).then(async (b) => {
      if (b) setFondo(await createImageBitmap(b))
    })
  }, [r.croquisId])

  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d')
    if (ctx) dibujar(ctx, fondo, trazos, true)
  }, [fondo, trazos])

  const punto = (e: React.PointerEvent): [number, number] => {
    const caja = lienzo.current!.getBoundingClientRect()
    const x = ((e.clientX - caja.left) / caja.width) * LADO
    const y = ((e.clientY - caja.top) / caja.height) * LADO
    // Líneas y rectángulos se acomodan a la grilla para que queden prolijos.
    if (herramienta === 'linea' || herramienta === 'rectangulo') return [Math.round(x / (GRILLA / 2)) * (GRILLA / 2), Math.round(y / (GRILLA / 2)) * (GRILLA / 2)]
    return [x, y]
  }

  const redibujar = (extra: Trazo | null) => {
    const ctx = lienzo.current?.getContext('2d')
    if (ctx) dibujar(ctx, fondo, extra ? [...trazos, extra] : trazos, true)
  }

  const bajar = (e: React.PointerEvent) => {
    e.preventDefault()
    const p = punto(e)
    if (herramienta === 'texto') {
      if (!texto.trim()) {
        setError('Escribí primero el texto (por ejemplo “10 m” o “Calle Belgrano”) y después tocá dónde va.')
        return
      }
      setError('')
      setTrazos((t) => [...t, { tipo: 'texto', en: p, texto: texto.trim() }])
      setTexto('')
      setGuardado(false)
      return
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    enCurso.current = herramienta === 'lapiz' ? { tipo: 'lapiz', puntos: [p], grosor } : { tipo: herramienta, desde: p, hasta: p, grosor }
  }

  const mover = (e: React.PointerEvent) => {
    const t = enCurso.current
    if (!t) return
    const p = punto(e)
    if (t.tipo === 'lapiz') t.puntos.push(p)
    else if (t.tipo !== 'texto') t.hasta = p
    redibujar(t)
  }

  const soltar = () => {
    const t = enCurso.current
    enCurso.current = null
    if (!t) return
    const valido = t.tipo === 'lapiz' ? t.puntos.length > 1 : t.tipo === 'texto' || t.desde[0] !== t.hasta[0] || t.desde[1] !== t.hasta[1]
    if (valido) {
      setTrazos((x) => [...x, t])
      setGuardado(false)
    } else redibujar(null)
  }

  const guardar = async () => {
    // Se exporta sin la grilla, como un plano limpio.
    const salida = document.createElement('canvas')
    salida.width = LADO
    salida.height = LADO
    dibujar(salida.getContext('2d')!, fondo, trazos, false)
    const blob: Blob = await new Promise((ok) => salida.toBlob((b) => ok(b!), 'image/png'))
    const id = await guardarArchivo(blob)
    await actualizar((x) => ({ ...x, croquisId: id }))
    setTrazos([])
    setGuardado(true)
  }

  const HERRAMIENTAS: { id: Herramienta; nombre: string }[] = [
    { id: 'linea', nombre: 'Línea' },
    { id: 'rectangulo', nombre: 'Terreno' },
    { id: 'lapiz', nombre: 'Lápiz' },
    { id: 'texto', nombre: 'Texto' },
  ]

  return (
    <section className="grid gap-3">
      <div className="tarjeta p-4">
        <h2 className="text-xl">Croquis</h2>
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer font-semibold text-azul">Qué tiene que tener</summary>
          <ul className="mt-1 list-disc pl-5 text-tenue">{CONTENIDO.map((c) => <li key={c}>{c}</li>)}</ul>
        </details>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.id}
            onClick={() => setHerramienta(h.id)}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${herramienta === h.id ? 'border-azul bg-azul text-white' : 'border-linea bg-papel'}`}
          >
            {h.nombre}
          </button>
        ))}
        <select value={grosor} onChange={(e) => setGrosor(Number(e.target.value))} className="rounded-md border border-linea bg-papel px-2 py-2 text-sm" aria-label="Grosor">
          <option value={3}>Fino</option>
          <option value={5}>Medio</option>
          <option value={10}>Grueso</option>
        </select>
      </div>

      {herramienta === 'texto' && (
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí (ej.: 10 m, Calle Belgrano, Escuela) y tocá el dibujo"
          className="campo"
          aria-label="Texto para el croquis"
        />
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <canvas
        ref={lienzo}
        width={LADO}
        height={LADO}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="aspect-square w-full touch-none rounded-xl border border-linea bg-white"
        aria-label="Área de dibujo del croquis"
      />

      <div className="flex flex-wrap gap-2">
        <button className="boton" disabled={!trazos.length} onClick={() => setTrazos((t) => t.slice(0, -1))}>Deshacer</button>
        <button
          className="boton"
          disabled={!trazos.length && !fondo}
          onClick={() => {
            if (trazos.length) setTrazos([])
            else setFondo(null)
            setGuardado(false)
          }}
        >
          {trazos.length ? 'Borrar lo nuevo' : 'Empezar de cero'}
        </button>
        <button className="boton-principal" disabled={!trazos.length} onClick={guardar}>
          Guardar croquis
        </button>
      </div>
      {guardado && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ok">Croquis guardado en el celular.</p>
          <button className="boton" onClick={siguiente}>Seguir con la entrevista</button>
        </div>
      )}
    </section>
  )
}

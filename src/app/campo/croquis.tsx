'use client'

import { useEffect, useRef, useState } from 'react'
import { guardarArchivo, leerArchivo, type RelevamientoCampo } from '@/lib/campo/almacen'
import {
  CALLE, CENTRO, DATOS_VACIOS, LADO_LIENZO as LADO, MANZANA, PASO_MANZANA, ZOOMS, aDibujo, aPantalla,
  faltantesCroquis, geometria, metros, textoMetros,
  type DatosCroquis, type Lado, type Trazo,
} from '@/lib/campo/croquis-plantilla'
import type { Actualizar } from './relevamiento'

type Herramienta = 'lapiz' | 'linea' | 'rectangulo' | 'texto' | 'referencia'

const GRILLA = 50
const TINTA = '#1b2a3a'
const TENUE = '#8a9aa8'
const LOTE = '#0b5394'
const REFERENCIA = '#b45309'

const SUGERENCIAS = ['Escuela', 'Almacén', 'Plaza', 'Iglesia', 'Parada de colectivo', 'Centro de salud', 'Club']

/** Escribe un texto achicando la letra hasta que entre en el ancho dado. */
function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: { tam: number; ancho: number; color?: string; peso?: number; giro?: number; alinear?: CanvasTextAlign }) {
  ctx.save()
  ctx.translate(x, y)
  if (o.giro) ctx.rotate(o.giro)
  let tam = o.tam
  do {
    ctx.font = `${o.peso ?? 600} ${tam}px system-ui, sans-serif`
    tam -= 2
  } while (ctx.measureText(t).width > o.ancho && tam > 14)
  ctx.textAlign = o.alinear ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = '#fff'
  ctx.lineJoin = 'round'
  ctx.strokeText(t, 0, 0)
  ctx.fillStyle = o.color ?? TINTA
  ctx.fillText(t, 0, 0)
  ctx.restore()
}

/** La manzana con las calles, el lote, la distancia a la esquina y la referencia, con el zoom pedido. */
function dibujarPlantilla(ctx: CanvasRenderingContext2D, d: DatosCroquis, gps: RelevamientoCampo['gps']) {
  const z = d.zoom ?? 1
  const P = (v: number) => aPantalla(v, z)
  // Las letras se achican menos que el dibujo, para que se sigan leyendo.
  const f = Math.max(0.6, z)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, LADO, LADO)

  // Manzanas: la del lote en el medio y las vecinas alrededor (más cuadras cuanto más zoom para afuera).
  const mitad = (MANZANA.x1 - MANZANA.x0) / 2
  ctx.lineWidth = 3
  for (let i = -4; i <= 4; i++) {
    for (let k = -4; k <= 4; k++) {
      if (!i && !k) continue
      const x0 = P(CENTRO + i * PASO_MANZANA - mitad)
      const y0 = P(CENTRO + k * PASO_MANZANA - mitad)
      const lado = 2 * mitad * z
      if (x0 > LADO || y0 > LADO || x0 + lado < 0 || y0 + lado < 0) continue
      ctx.fillStyle = '#eef2f5'
      ctx.strokeStyle = '#a9b8c5'
      ctx.fillRect(x0, y0, lado, lado)
      ctx.strokeRect(x0, y0, lado, lado)
    }
  }
  ctx.lineWidth = 5
  ctx.strokeStyle = TINTA
  ctx.strokeRect(P(MANZANA.x0), P(MANZANA.y0), (MANZANA.x1 - MANZANA.x0) * z, (MANZANA.y1 - MANZANA.y0) * z)

  // Nombres de las calles (en gris lo que falta cargar).
  const anchoCalle = Math.max(260, (MANZANA.x1 - MANZANA.x0) * z)
  const calle = (nombre: string, falta: string, x: number, y: number, giro = 0) =>
    texto(ctx, nombre.trim() || falta, P(x), P(y), { tam: 40 * f, ancho: anchoCalle, giro, color: nombre.trim() ? TINTA : TENUE, peso: nombre.trim() ? 700 : 500 })
  calle(d.calleFrente, 'Calle del frente', CENTRO, MANZANA.y1 + 100)
  calle(d.calleFondo, 'Calle de atrás', CENTRO, MANZANA.y0 - CALLE / 2)
  calle(d.calleIzquierda, 'Calle izquierda', MANZANA.x0 - CALLE / 2, CENTRO, -Math.PI / 2)
  calle(d.calleDerecha, 'Calle derecha', MANZANA.x1 + CALLE / 2, CENTRO, Math.PI / 2)

  // El lote, sobre la calle del frente.
  const g = geometria(d)
  const lote = { x0: P(g.lote.x0), y0: P(g.lote.y0), x1: P(g.lote.x1), y1: P(g.lote.y1) }
  const ancho = lote.x1 - lote.x0
  const largo = lote.y1 - lote.y0
  ctx.fillStyle = '#d6e6f5'
  ctx.fillRect(lote.x0, lote.y0, ancho, largo)
  ctx.lineWidth = 6
  ctx.strokeStyle = LOTE
  ctx.setLineDash(g.medidasCargadas ? [] : [16, 12])
  ctx.strokeRect(lote.x0, lote.y0, ancho, largo)
  ctx.setLineDash([])
  texto(ctx, 'LOTE', (lote.x0 + lote.x1) / 2, (lote.y0 + lote.y1) / 2, { tam: 38 * f, ancho: Math.max(ancho, largo) - 16, color: LOTE, peso: 800, giro: ancho < 110 ? -Math.PI / 2 : 0 })

  const frente = metros(d.frente)
  const fondo = metros(d.fondo)
  if (frente) texto(ctx, textoMetros(frente), (lote.x0 + lote.x1) / 2, lote.y0 - 26 * f, { tam: 32 * f, ancho: 220, color: LOTE, peso: 700 })
  if (fondo) {
    const alLado = d.esquina === 'derecha' ? lote.x0 - 28 * f : lote.x1 + 28 * f
    texto(ctx, textoMetros(fondo), alLado, (lote.y0 + lote.y1) / 2, { tam: 32 * f, ancho: Math.max(largo, 120), color: LOTE, peso: 700, giro: -Math.PI / 2 })
  }

  // Distancia a la esquina más cercana: cota sobre la calle del frente.
  const distancia = metros(d.distancia)
  if (g.cota && distancia) {
    const y = P(MANZANA.y1 + 26)
    const c0 = P(g.cota.x0)
    const c1 = P(g.cota.x1)
    ctx.strokeStyle = TINTA
    ctx.fillStyle = TINTA
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(c0, y)
    ctx.lineTo(c1, y)
    for (const x of [c0, c1]) {
      ctx.moveTo(x, y - 14 * f)
      ctx.lineTo(x, y + 14 * f)
    }
    ctx.stroke()
    for (const [x, dir] of [[c0, 1], [c1, -1]] as const) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 18 * f * dir, y - 9 * f)
      ctx.lineTo(x + 18 * f * dir, y + 9 * f)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(P(d.esquina === 'derecha' ? MANZANA.x1 : MANZANA.x0), P(MANZANA.y1), 10 * f, 0, Math.PI * 2)
    ctx.fill()
    const media = 150 * f
    const centro = Math.min(Math.max((c0 + c1) / 2, P(MANZANA.x0) + media), P(MANZANA.x1) - media)
    // Sin zoom va abajo de la cota. Alejado la calle es angosta: solo los metros, arriba de la flecha.
    if (z < 1) texto(ctx, textoMetros(distancia), (c0 + c1) / 2, y - 22 * f, { tam: 30 * f, ancho: 200, peso: 700 })
    else texto(ctx, `${textoMetros(distancia)} a la esquina`, centro, y + 32, { tam: 30, ancho: 300, peso: 700 })
  }

  // Referencia: donde se tocó el croquis, o del otro lado de la calle que se eligió.
  if (d.referencia.trim()) {
    const etiqueta = `★ ${d.referencia.trim()}`
    const ancho = Math.max(320, (MANZANA.x1 - MANZANA.x0) * z)
    if (d.referenciaLado === 'punto') {
      if (d.referenciaPunto) {
        const [x, y] = d.referenciaPunto.map(P)
        ctx.fillStyle = REFERENCIA
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(x, y, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        texto(ctx, etiqueta, Math.min(Math.max(x, 170), LADO - 170), y - 40, { tam: 36 * f, ancho: 320, color: REFERENCIA, peso: 700 })
      }
    } else {
      const lejos = CALLE / 2
      const lugar: Record<Lado, [number, number, number]> = {
        frente: [CENTRO, MANZANA.y1 + CALLE + lejos, 0],
        fondo: [CENTRO, MANZANA.y0 - CALLE - lejos, 0],
        izquierda: [MANZANA.x0 - CALLE - lejos, CENTRO, -Math.PI / 2],
        derecha: [MANZANA.x1 + CALLE + lejos, CENTRO, Math.PI / 2],
      }
      const [x, y, giro] = lugar[d.referenciaLado]
      texto(ctx, etiqueta, P(x), P(y), { tam: 36 * f, ancho, color: REFERENCIA, peso: 700, giro })
    }
  }

  if (gps) {
    texto(ctx, `Coordenadas: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`, 16, LADO - 16, { tam: 22, ancho: 600, color: TENUE, peso: 500, alinear: 'left' })
  }
}

/** Lo dibujado a mano, guardado sin zoom: se pasa a la pantalla con el zoom actual. */
function dibujarTrazos(ctx: CanvasRenderingContext2D, trazos: Trazo[], z = 1) {
  const P = (p: [number, number]): [number, number] => [aPantalla(p[0], z), aPantalla(p[1], z)]
  ctx.strokeStyle = TINTA
  ctx.fillStyle = TINTA
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const t of trazos) {
    if (t.tipo === 'texto') {
      const [x, y] = P(t.en)
      texto(ctx, t.texto, x, y, { tam: 48 * Math.max(0.6, z), ancho: LADO })
      continue
    }
    ctx.strokeStyle = TINTA
    ctx.lineWidth = t.grosor
    ctx.beginPath()
    if (t.tipo === 'lapiz') {
      t.puntos.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    } else if (t.tipo === 'linea') {
      ctx.moveTo(...P(t.desde))
      ctx.lineTo(...P(t.hasta))
    } else {
      const [x0, y0] = P(t.desde)
      const [x1, y1] = P(t.hasta)
      ctx.rect(x0, y0, x1 - x0, y1 - y0)
    }
    ctx.stroke()
  }
}

/** Croquis viejo (dibujado a mano antes de la plantilla): se sigue usando como fondo. */
function dibujarSobreImagen(ctx: CanvasRenderingContext2D, fondo: ImageBitmap | null, conGrilla: boolean) {
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
}

/** Calle del domicilio sin la numeración: "Belgrano 450" → "Belgrano". */
function calleDe(domicilio: string | null): string {
  return (domicilio ?? '').replace(/\s+(n[°º]?\s*)?\d.*$/i, '').trim()
}

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-tenue">{ayuda}</span>}
    </label>
  )
}

export function Croquis({ r, actualizar, siguiente, domicilio }: { r: RelevamientoCampo; actualizar: Actualizar; siguiente: () => void; domicilio?: string | null }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  // Los croquis guardados antes de la plantilla se siguen editando como imagen.
  const [sobreImagen, setSobreImagen] = useState(Boolean(r.croquisId && !r.croquisDatos))
  const [fondo, setFondo] = useState<ImageBitmap | null>(null)
  const [datos, setDatos] = useState<DatosCroquis>(() => r.croquisDatos ?? { ...DATOS_VACIOS, calleFrente: calleDe(domicilio ?? null) })
  const [trazos, setTrazos] = useState<Trazo[]>(r.croquisTrazos ?? [])
  const [herramienta, setHerramienta] = useState<Herramienta>('linea')
  const [grosor, setGrosor] = useState(5)
  const [textoNuevo, setTextoNuevo] = useState('')
  const [sinGuardar, setSinGuardar] = useState(!r.croquisId)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')
  const enCurso = useRef<Trazo | null>(null)

  useEffect(() => {
    if (!sobreImagen || !r.croquisId) return
    leerArchivo(r.croquisId).then(async (b) => {
      if (b) setFondo(await createImageBitmap(b))
    })
  }, [r.croquisId, sobreImagen])

  const zoom = sobreImagen ? 1 : datos.zoom ?? 1
  const herramientaAntes = useRef<Herramienta>('linea')

  const pintar = (ctx: CanvasRenderingContext2D, extra: Trazo | null, conGrilla: boolean) => {
    if (sobreImagen) dibujarSobreImagen(ctx, fondo, conGrilla)
    else dibujarPlantilla(ctx, datos, r.gps)
    dibujarTrazos(ctx, extra ? [...trazos, extra] : trazos, zoom)
  }

  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d')
    if (ctx) pintar(ctx, null, true)
  })

  const cambiado = () => {
    setSinGuardar(true)
    setGuardado(false)
  }

  const cambiarDato = <K extends keyof DatosCroquis>(k: K, v: DatosCroquis[K]) => cambiarDatos({ [k]: v })

  const cambiarDatos = (cambios: Partial<DatosCroquis>) => {
    const nuevos = { ...datos, ...cambios }
    setDatos(nuevos)
    cambiado()
    void actualizar((x) => ({ ...x, croquisDatos: nuevos }))
  }

  const cambiarTrazos = (nuevos: Trazo[]) => {
    setTrazos(nuevos)
    cambiado()
    if (!sobreImagen) void actualizar((x) => ({ ...x, croquisTrazos: nuevos }))
  }

  const punto = (e: React.PointerEvent): [number, number] => {
    const caja = lienzo.current!.getBoundingClientRect()
    const x = aDibujo(((e.clientX - caja.left) / caja.width) * LADO, zoom)
    const y = aDibujo(((e.clientY - caja.top) / caja.height) * LADO, zoom)
    // Líneas y rectángulos se acomodan a la grilla para que queden prolijos.
    if (herramienta === 'linea' || herramienta === 'rectangulo') return [Math.round(x / (GRILLA / 2)) * (GRILLA / 2), Math.round(y / (GRILLA / 2)) * (GRILLA / 2)]
    return [x, y]
  }

  const redibujar = (extra: Trazo | null) => {
    const ctx = lienzo.current?.getContext('2d')
    if (ctx) pintar(ctx, extra, true)
  }

  const bajar = (e: React.PointerEvent) => {
    e.preventDefault()
    const p = punto(e)
    if (herramienta === 'referencia') {
      cambiarDatos({ referenciaLado: 'punto', referenciaPunto: [Math.round(p[0]), Math.round(p[1])] })
      setHerramienta(herramientaAntes.current)
      return
    }
    if (herramienta === 'texto') {
      if (!textoNuevo.trim()) {
        setError('Escribí primero el texto (por ejemplo “Pasillo” o “Árbol”) y después tocá dónde va.')
        return
      }
      setError('')
      cambiarTrazos([...trazos, { tipo: 'texto', en: p, texto: textoNuevo.trim() }])
      setTextoNuevo('')
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
    if (valido) cambiarTrazos([...trazos, t])
    else redibujar(null)
  }

  const guardar = async () => {
    // Se exporta sin la grilla, como un plano limpio.
    const salida = document.createElement('canvas')
    salida.width = LADO
    salida.height = LADO
    pintar(salida.getContext('2d')!, null, false)
    const blob: Blob = await new Promise((ok) => salida.toBlob((b) => ok(b!), 'image/png'))
    const id = await guardarArchivo(blob)
    if (sobreImagen) {
      await actualizar((x) => ({ ...x, croquisId: id }))
      setTrazos([])
    } else {
      await actualizar((x) => ({ ...x, croquisId: id, croquisDatos: datos, croquisTrazos: trazos }))
    }
    setSinGuardar(false)
    setGuardado(true)
  }

  const usarPlantilla = () => {
    setSobreImagen(false)
    setFondo(null)
    setTrazos([])
    cambiado()
    void actualizar((x) => ({ ...x, croquisDatos: datos, croquisTrazos: [] }))
  }

  const HERRAMIENTAS: { id: Herramienta; nombre: string }[] = [
    { id: 'linea', nombre: 'Línea' },
    { id: 'rectangulo', nombre: 'Rectángulo' },
    { id: 'lapiz', nombre: 'Lápiz' },
    { id: 'texto', nombre: 'Texto' },
  ]

  const faltan = sobreImagen ? [] : faltantesCroquis(datos)

  return (
    <section className="grid gap-3">
      <div className="tarjeta p-4">
        <h2 className="text-xl">Croquis</h2>
        <p className="mt-1 text-sm text-tenue">
          {sobreImagen
            ? 'Este croquis se dibujó a mano. Podés seguir dibujando encima o pasar al croquis prediseñado.'
            : 'La manzana ya está dibujada. Completá los datos de abajo preguntándole al vecino: se dibujan solos. Si falta algo, agregalo a mano con las herramientas.'}
        </p>
      </div>

      <div className="relative">
      <canvas
        ref={lienzo}
        width={LADO}
        height={LADO}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="aspect-square w-full touch-none rounded-xl border border-linea bg-white"
        aria-label="Croquis del lote"
      />
      {!sobreImagen && (
        <div className="absolute right-2 top-2 grid gap-1.5">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-linea bg-white text-2xl font-bold shadow disabled:opacity-40"
            disabled={zoom === ZOOMS[0]}
            onClick={() => cambiarDato('zoom', ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}
            aria-label="Acercar"
          >+</button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-linea bg-white text-2xl font-bold shadow disabled:opacity-40"
            disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            onClick={() => cambiarDato('zoom', ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}
            aria-label="Alejar"
          >−</button>
        </div>
      )}
      {herramienta === 'referencia' && (
        <p className="absolute inset-x-2 bottom-2 rounded-lg bg-black/75 px-3 py-2 text-center text-sm font-semibold text-white">
          Tocá en el croquis dónde está la referencia. Si está lejos, alejá con “−”.
        </p>
      )}
      </div>

      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold text-azul">Dibujar algo a mano encima</summary>
        <div className="mt-3 grid gap-3">
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
              value={textoNuevo}
              onChange={(e) => setTextoNuevo(e.target.value)}
              placeholder="Escribí (ej.: Pasillo, Árbol, Canal) y tocá el dibujo"
              className="campo"
              aria-label="Texto para el croquis"
            />
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="boton" disabled={!trazos.length} onClick={() => cambiarTrazos(trazos.slice(0, -1))}>Deshacer</button>
            <button className="boton" disabled={!trazos.length} onClick={() => cambiarTrazos([])}>Borrar lo dibujado a mano</button>
            {sobreImagen && <button className="boton" onClick={usarPlantilla}>Pasar al croquis prediseñado</button>}
          </div>
        </div>
      </details>

      {!sobreImagen && (
        <>
          <div className="tarjeta grid gap-3 p-4">
            <h3 className="font-semibold">1. Medidas del lote</h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Frente (ancho), en metros">
                <input value={datos.frente} onChange={(e) => cambiarDato('frente', e.target.value)} inputMode="decimal" placeholder="Ej.: 10" className="campo" />
              </Campo>
              <Campo etiqueta="Fondo (largo), en metros">
                <input value={datos.fondo} onChange={(e) => cambiarDato('fondo', e.target.value)} inputMode="decimal" placeholder="Ej.: 30" className="campo" />
              </Campo>
            </div>
          </div>

          <div className="tarjeta grid gap-3 p-4">
            <h3 className="font-semibold">2. Distancia a la esquina más cercana</h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Metros hasta la esquina" ayuda="Preguntale al vecino.">
                <input value={datos.distancia} onChange={(e) => cambiarDato('distancia', e.target.value)} inputMode="decimal" placeholder="Ej.: 20" className="campo" />
              </Campo>
              <Campo etiqueta="¿Qué esquina?" ayuda="Mirando el lote desde la calle.">
                <select value={datos.esquina} onChange={(e) => cambiarDato('esquina', e.target.value as DatosCroquis['esquina'])} className="campo">
                  <option value="izquierda">A la izquierda</option>
                  <option value="derecha">A la derecha</option>
                </select>
              </Campo>
            </div>
          </div>

          <div className="tarjeta grid gap-3 p-4">
            <h3 className="font-semibold">3. Calles alrededor de la manzana</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Calle del frente (donde está la entrada)">
                <input value={datos.calleFrente} onChange={(e) => cambiarDato('calleFrente', e.target.value)} className="campo" />
              </Campo>
              <Campo etiqueta="Calle de atrás">
                <input value={datos.calleFondo} onChange={(e) => cambiarDato('calleFondo', e.target.value)} className="campo" />
              </Campo>
              <Campo etiqueta="Calle de la izquierda">
                <input value={datos.calleIzquierda} onChange={(e) => cambiarDato('calleIzquierda', e.target.value)} className="campo" />
              </Campo>
              <Campo etiqueta="Calle de la derecha">
                <input value={datos.calleDerecha} onChange={(e) => cambiarDato('calleDerecha', e.target.value)} className="campo" />
              </Campo>
            </div>
          </div>

          <div className="tarjeta grid gap-3 p-4">
            <h3 className="font-semibold">4. Referencia cercana</h3>
            <p className="-mt-2 text-sm text-tenue">Algo que cualquiera conozca, para encontrar el lote: un negocio, una escuela, una plaza.</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGERENCIAS.map((s) => (
                <button key={s} type="button" onClick={() => cambiarDato('referencia', `${s} `)} className="rounded-full border border-linea bg-papel px-3 py-1 text-sm">
                  {s}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre" ayuda="Ej.: Almacén Don José, Escuela N° 123.">
                <input value={datos.referencia} onChange={(e) => cambiarDato('referencia', e.target.value)} className="campo" />
              </Campo>
              <Campo etiqueta="¿Sobre qué calle está?">
                <select value={datos.referenciaLado} onChange={(e) => cambiarDato('referenciaLado', e.target.value as DatosCroquis['referenciaLado'])} className="campo">
                  <option value="frente">Enfrente, sobre la calle del frente</option>
                  <option value="fondo">Sobre la calle de atrás</option>
                  <option value="izquierda">Sobre la calle de la izquierda</option>
                  <option value="derecha">Sobre la calle de la derecha</option>
                  <option value="punto">Más lejos: la marco en el croquis</option>
                </select>
              </Campo>
            </div>
            <button
              type="button"
              className="boton justify-self-start"
              onClick={() => {
                if (herramienta !== 'referencia') herramientaAntes.current = herramienta
                setHerramienta('referencia')
                lienzo.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              {datos.referenciaLado === 'punto' && datos.referenciaPunto ? 'Mover la referencia en el croquis' : 'Marcar la referencia tocando el croquis'}
            </button>
          </div>

          <p className="text-sm text-tenue">
            {r.gps
              ? 'Las coordenadas tomadas en “Ubicación” van impresas en el croquis.'
              : 'Todavía no se tomó la ubicación: hacelo en la parte “Ubicación” y las coordenadas se agregan al croquis.'}
          </p>
          {faltan.length > 0 && <p className="text-sm text-tenue">Falta: {faltan.join(', ')}.</p>}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="boton-principal" disabled={!sinGuardar} onClick={guardar}>
          Guardar croquis
        </button>
        {!sinGuardar && r.croquisId && <p className="text-sm text-ok">{guardado ? 'Croquis guardado en el celular.' : 'Croquis guardado.'}</p>}
        {!sinGuardar && r.croquisId && <button className="boton" onClick={siguiente}>Seguir con la entrevista</button>}
      </div>
    </section>
  )
}

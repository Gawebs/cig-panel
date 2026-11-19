'use client'

import { textoError } from '@/lib/errores'
import { useActionState, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enlaceDocumento } from '@/actions/documentos'
import { CATASTRO_PORTAL } from '@/lib/catastro-enlaces'
import { presentarEnCatastro, registrarFirmado, registrarObservacion, registrarProrroga, registrarReingreso } from '@/actions/catastro'
import { DescargaPaso } from '@/components/descarga-paso'
import { nombreFirmado, tieneFirmaDigital } from '@/lib/firma'
import { createClient } from '@/lib/supabase/client'
import type { EstadoExpediente } from '@/lib/textos'

export interface PasoParaFirmar {
  paso: number
  titulo: string
  documentos: string[]
  completo: boolean
}

export interface Firmado {
  id: string
  paso: number
  created_at: string
}

export interface Observacion {
  id: string
  recibida_el: string
  texto: string
  vence_el: string
  prorroga_hasta: string | null
  estado: 'abierta' | 'prorroga' | 'respondida'
  respondida_el: string | null
  plazo_dias: number
  plazo_tipo: 'habiles' | 'corridos'
}

const hoyIso = () => new Date().toLocaleDateString('sv-SE') // aaaa-mm-dd en hora local
const fechaAr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR')

/** Días corridos que faltan hasta una fecha (negativo si ya pasó). */
export function diasHasta(iso: string, hoy = new Date()): number {
  const fin = new Date(`${iso}T12:00:00`).getTime()
  const inicio = new Date(`${hoy.toLocaleDateString('sv-SE')}T12:00:00`).getTime()
  return Math.round((fin - inicio) / 86400000)
}

export function Copiar({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  const [copiado, setCopiado] = useState(false)
  if (!valor) return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-linea px-3 py-2 text-sm">
      <span><span className="etiqueta block">{etiqueta}</span><span className="text-error">Sin cargar</span></span>
    </div>
  )
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-linea px-3 py-2 text-sm">
      <span className="min-w-0"><span className="etiqueta block">{etiqueta}</span><span className="break-words font-semibold">{valor}</span></span>
      <button
        type="button"
        className="boton min-h-9 shrink-0 text-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(valor)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
      >
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function SubirFirmado(props: { expedienteId: string; municipioId: string; paso: number }) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [, startTransition] = useTransition()

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setMensaje(null)
    const bytes = new Uint8Array(await archivo.arrayBuffer())
    if (!tieneFirmaDigital(bytes)) {
      setMensaje({ tipo: 'error', texto: 'Ese PDF no tiene firma digital. Elegí el archivo que guardó la herramienta de firma.' })
      return
    }
    setSubiendo(true)
    try {
      const ruta = `${props.municipioId}/${props.expedienteId}/firmado-P${props.paso}-${crypto.randomUUID().slice(0, 8)}.pdf`
      const { error } = await createClient().storage.from('expedientes').upload(ruta, new Blob([bytes], { type: 'application/pdf' }), { contentType: 'application/pdf' })
      if (error) throw new Error(`No se pudo subir: ${textoError(error)}`)
      const r = await registrarFirmado(props.expedienteId, props.paso, ruta, bytes.byteLength)
      if (r.error) throw new Error(r.error)
      setMensaje({ tipo: 'ok', texto: r.ok! })
      startTransition(() => router.refresh())
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo subir.' })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        ref={entrada}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          subir(f)
        }}
      />
      <button type="button" className="boton min-h-9 text-sm" disabled={subiendo} onClick={() => entrada.current?.click()}>
        {subiendo ? 'Subiendo…' : 'Subir PDF firmado'}
      </button>
      {mensaje && <span role={mensaje.tipo === 'error' ? 'alert' : undefined} className={`text-sm ${mensaje.tipo === 'error' ? 'text-error' : 'text-ok'}`}>{mensaje.texto}</span>}
    </span>
  )
}

function BajarFirmado({ expedienteId, documentoId, nombre }: { expedienteId: string; documentoId: string; nombre: string }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <button
      type="button"
      className="boton min-h-9 text-sm"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true)
        try {
          const { url } = await enlaceDocumento(expedienteId, documentoId)
          if (!url) return
          const blob = await (await fetch(url)).blob()
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = nombre
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 10000)
        } finally {
          setOcupado(false)
        }
      }}
    >
      {ocupado ? 'Bajando…' : `Bajar ${nombre}`}
    </button>
  )
}

function Formulario({ accion, boton, children, principal, confirmar }: {
  accion: (prev: { error?: string; ok?: string } | undefined, f: FormData) => Promise<{ error?: string; ok?: string }>
  boton: string
  principal?: boolean
  children: React.ReactNode
  /** Si viene, se pregunta antes de guardar. */
  confirmar?: string
}) {
  const [estado, enviar, enviando] = useActionState(accion, undefined)
  return (
    <form action={enviar} onSubmit={(e) => { if (confirmar && !window.confirm(confirmar)) e.preventDefault() }} className="grid gap-2">
      {children}
      <div><button disabled={enviando} className={principal ? 'boton-principal' : 'boton'}>{enviando ? 'Guardando…' : boton}</button></div>
      {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-ok">{estado.ok}</p>}
    </form>
  )
}

export function SeccionCatastro(props: {
  expedienteId: string
  municipioId: string
  numeroInterno: string
  estado: EstadoExpediente
  esDireccion: boolean
  gestiona: boolean // subdirección o dirección
  pasos: PasoParaFirmar[]
  firmados: Firmado[]
  numeroCatastro: string | null
  fechaPresentacion: string | null
  observaciones: Observacion[]
  datosPortal: { etiqueta: string; valor: string | null }[]
  /** Datos obligatorios que siguen vacíos: se avisan antes de presentar o reingresar. */
  faltanDatos: string[]
}) {
  const { estado } = props
  const firmaAbierta = ['aprobado', 'observado', 'prorroga_pedida'].includes(estado)
  const despuesDeAprobar = !['en_armado', 'listo_para_revisar', 'devuelto'].includes(estado)
  if (!despuesDeAprobar) return null

  const firmadoDe = (paso: number) => props.firmados.find((f) => f.paso === paso)
  const faltanFirmas = props.pasos.filter((p) => !firmadoDe(p.paso)).length
  const abierta = props.observaciones.find((o) => o.estado !== 'respondida')
  const avisoFaltan = props.faltanDatos.length > 0 && (
    <div className="rounded-lg border border-aviso bg-aviso-suave p-3 text-sm">
      <p className="font-semibold text-aviso">Faltan {props.faltanDatos.length} dato(s) que pide Catastro:</p>
      <ul className="mt-1 grid gap-0.5">{props.faltanDatos.map((t) => <li key={t}>• {t}</li>)}</ul>
      <p className="mt-1 text-tenue">Cargalos en la ficha antes de presentar: si no, el portal no lo acepta o Catastro lo observa.</p>
    </div>
  )
  const confirmarFaltan = props.faltanDatos.length
    ? `Faltan ${props.faltanDatos.length} dato(s) que pide Catastro (${props.faltanDatos.join('; ')}). ¿Lo registrás igual?`
    : undefined

  return (
    <section className="tarjeta overflow-hidden">
      <div className="degrade px-5 py-4 text-white">
        <h2 className="text-xl">Firma y presentación en Catastro</h2>
        <p className="text-sm opacity-90">
          {props.numeroCatastro ? `Expediente de Catastro ${props.numeroCatastro}` : 'Todavía no se presentó en el portal.'}
          {props.fechaPresentacion ? ` · presentado el ${fechaAr(props.fechaPresentacion)}` : ''}
        </p>
      </div>

      <div className="grid gap-5 p-5">
        {/* 1. Firma de la Dirección */}
        <div className="grid gap-2">
          <h3 className="text-lg">1. Firma digital de la Dirección</h3>
          {firmaAbierta && props.esDireccion && (
            <p className="text-sm text-tenue">
              Bajá el PDF de cada paso, firmalo con tu herramienta de firma digital y subí el archivo firmado. El sistema controla que tenga la firma.
            </p>
          )}
          {firmaAbierta && !props.esDireccion && <p className="text-sm text-tenue">Lo firma la Dirección.</p>}
          <ul className="grid gap-2">
            {props.pasos.map((p) => {
              const f = firmadoDe(p.paso)
              return (
                <li key={p.paso} className="grid gap-1 rounded-lg border border-linea px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Paso {p.paso}: {p.titulo}</span>
                    <span className={`text-sm font-semibold ${f ? 'text-ok' : 'text-aviso'}`}>{f ? `Firmado el ${new Date(f.created_at).toLocaleDateString('es-AR')}` : 'Sin firmar'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {firmaAbierta && props.esDireccion && (
                      <>
                        <DescargaPaso expedienteId={props.expedienteId} numeroInterno={props.numeroInterno} paso={p.paso} documentos={p.documentos} completo={p.completo} />
                        <SubirFirmado expedienteId={props.expedienteId} municipioId={props.municipioId} paso={p.paso} />
                      </>
                    )}
                    {f && <BajarFirmado expedienteId={props.expedienteId} documentoId={f.id} nombre={nombreFirmado(p.paso, props.numeroInterno)} />}
                  </div>
                </li>
              )
            })}
          </ul>
          {estado === 'aprobado' && props.esDireccion && (
            <p className={`text-sm ${faltanFirmas ? 'text-aviso' : 'text-ok'}`}>
              {faltanFirmas ? `Faltan ${faltanFirmas} PDF firmados para poder marcarlo como firmado.` : 'Están los 4 firmados: ya podés marcarlo como firmado arriba.'}
            </p>
          )}
        </div>

        {/* 2. Presentación */}
        {['firmado', 'reingresado'].includes(estado) && props.gestiona && (
          <div className="grid gap-3">
            <h3 className="text-lg">2. {estado === 'reingresado' ? 'Volver a presentar' : 'Presentar en el portal de Catastro'}</h3>
            <p className="text-sm text-tenue">
              En el portal, elegí el marco normativo y completá cada campo con el botón Copiar. En cada uno de los 4 pasos subí el PDF firmado que corresponde.
            </p>
            <a href={CATASTRO_PORTAL} target="_blank" rel="noopener noreferrer" className="boton w-fit">Abrir el portal de Catastro ↗</a>
            {avisoFaltan}
            <div className="grid gap-2 sm:grid-cols-2">
              {props.datosPortal.map((d) => <Copiar key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />)}
            </div>
            <Formulario accion={presentarEnCatastro.bind(null, props.expedienteId)} boton="Registrar la presentación" principal confirmar={confirmarFaltan}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">N.º de expediente que dio Catastro</span>
                  <input name="numero" defaultValue={props.numeroCatastro ?? ''} required={!props.numeroCatastro} className="campo" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Fecha de presentación</span>
                  <input name="fecha" type="date" defaultValue={hoyIso()} max={hoyIso()} required className="campo" />
                </label>
              </div>
            </Formulario>
          </div>
        )}

        {/* 3. Seguimiento: observaciones, plazo, prórroga, reingreso */}
        {abierta && (
          <Plazo observacion={abierta} />
        )}

        {['presentado', 'reingresado', 'prorroga_pedida'].includes(estado) && props.gestiona && (
          <details className="rounded-lg border border-linea p-3">
            <summary className="cursor-pointer font-semibold">Catastro observó el expediente</summary>
            <div className="mt-3">
              <Formulario accion={registrarObservacion.bind(null, props.expedienteId)} boton="Registrar observación">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Fecha en que llegó la observación</span>
                  <input name="fecha" type="date" defaultValue={hoyIso()} max={hoyIso()} required className="campo" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Qué observó Catastro</span>
                  <textarea name="texto" rows={3} required className="campo py-2" />
                </label>
              </Formulario>
            </div>
          </details>
        )}

        {['observado', 'prorroga_pedida'].includes(estado) && props.gestiona && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-linea p-3">
              <h4 className="font-semibold">Ya se corrigió y se reingresó</h4>
              <p className="mb-2 text-sm text-tenue">Corregí lo observado en la ficha y, si hace falta, que la Dirección vuelva a firmar el paso.</p>
              {avisoFaltan && <div className="mb-2">{avisoFaltan}</div>}
              <Formulario accion={registrarReingreso.bind(null, props.expedienteId)} boton="Registrar reingreso" principal confirmar={confirmarFaltan}>
                <input name="fecha" type="date" defaultValue={hoyIso()} max={hoyIso()} required className="campo" aria-label="Fecha de reingreso" />
                <input name="nota" placeholder="Qué se corrigió (opcional)" className="campo" />
              </Formulario>
            </div>
            {estado === 'observado' && (
              <div className="rounded-lg border border-linea p-3">
                <h4 className="font-semibold">Se pidió prórroga</h4>
                <p className="mb-2 text-sm text-tenue">Si Catastro dio una fecha, cargala. Si no, se suma otro plazo igual al original.</p>
                <Formulario accion={registrarProrroga.bind(null, props.expedienteId)} boton="Registrar prórroga">
                  <input name="hasta" type="date" className="campo" aria-label="Nuevo vencimiento" />
                  <input name="nota" placeholder="Nota (opcional)" className="campo" />
                </Formulario>
              </div>
            )}
          </div>
        )}

        {props.observaciones.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-lg">Observaciones de Catastro</h3>
            <ol className="grid gap-2 text-sm">
              {props.observaciones.map((o) => (
                <li key={o.id} className="rounded-lg border border-linea px-3 py-2">
                  <p className="font-semibold">Recibida el {fechaAr(o.recibida_el)} · {o.estado === 'respondida' ? `respondida el ${o.respondida_el ? fechaAr(o.respondida_el) : '—'}` : o.estado === 'prorroga' ? `prórroga hasta el ${fechaAr(o.prorroga_hasta!)}` : `vence el ${fechaAr(o.vence_el)}`}</p>
                  <p className="whitespace-pre-line">{o.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

function Plazo({ observacion }: { observacion: Observacion }) {
  const vence = observacion.prorroga_hasta ?? observacion.vence_el
  const dias = diasHasta(vence)
  const tono = dias < 0 ? 'border-error bg-error-suave text-error' : dias <= 3 ? 'border-aviso bg-aviso-suave text-aviso' : 'border-azul bg-azul-suave text-azul'
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 ${tono}`}>
      <p className="text-lg font-semibold">
        {dias < 0 ? `El plazo venció hace ${-dias} día(s)` : dias === 0 ? 'El plazo vence hoy' : `Quedan ${dias} día(s) corridos`}
      </p>
      <p className="text-sm">
        Vence el {fechaAr(vence)}{observacion.prorroga_hasta ? ' (con prórroga)' : ''} · plazo de {observacion.plazo_dias} días {observacion.plazo_tipo === 'habiles' ? 'hábiles' : 'corridos'} desde el {fechaAr(observacion.recibida_el)}.
      </p>
    </div>
  )
}

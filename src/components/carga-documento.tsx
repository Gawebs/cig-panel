'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enlaceDocumento, quitarDocumento } from '@/actions/documentos'
import { esServicioOImpuesto } from '@/lib/requisitos'
import { subirDocumento } from '@/lib/subida'

export type DocumentoCargado = { id: string; nombre_archivo: string | null; paginas: number | null; tipo_prueba: string | null; firmado: boolean }

export const TIPOS_PRUEBA: Record<string, string> = {
  edet: 'Luz (Edet) con ticket de pago',
  gasnor: 'Gas (Gasnor) con ticket de pago',
  sat: 'Agua (SAT) con ticket de pago',
  dgr: 'Impuesto provincial (Rentas, DGR) con ticket de pago',
  tasa_municipal: 'Tasa municipal con ticket de pago',
  otro_servicio: 'Otro servicio o impuesto con ticket de pago',
  servicio_impuesto: 'Boleta de servicio o impuesto (con ticket de pago)',
  boleto_compraventa: 'Boleto de compraventa certificado',
  cesion_derechos: 'Cesión de derechos posesorios certificada',
  acta_nacimiento_periodo: 'Acta de nacimiento del período',
  recibo_sueldo: 'Recibo de sueldo con el domicilio',
  factura_materiales: 'Factura de materiales con el domicilio',
  certificado_medico: 'Certificado médico con el domicilio',
  certificado_escolar: 'Certificado o boletín escolar',
}

export function CargaDocumento(props: {
  expedienteId: string
  municipioId: string
  paso: number
  requisito: string
  personaId?: string
  anio?: number
  tiposPrueba?: string[]
  documentos: DocumentoCargado[]
  editable: boolean
}) {
  const router = useRouter()
  const [paginas, setPaginas] = useState<File[]>([])
  const [tipo, setTipo] = useState(props.tiposPrueba?.[0] ?? '')
  const [error, setError] = useState('')
  const [conTicket, setConTicket] = useState(false)
  const pideTicket = Boolean(props.tiposPrueba) && esServicioOImpuesto(tipo)
  const [subiendo, setSubiendo] = useState(false)
  const [, startTransition] = useTransition()
  const camara = useRef<HTMLInputElement>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const agregar = (lista: FileList | null) => {
    if (!lista?.length) return
    setError('')
    // Se copian ya: la lista del navegador se vacía cuando se limpia el campo para poder elegir otra vez.
    const nuevas = Array.from(lista)
    setPaginas((prev) => [...prev, ...nuevas])
  }

  const subir = async () => {
    if (pideTicket && !conTicket) {
      setError('Catastro pide la boleta junto con el ticket o comprobante de pago. Sacale foto también al ticket y marcá la casilla.')
      return
    }
    setSubiendo(true)
    setError('')
    try {
      await subirDocumento({
        expedienteId: props.expedienteId,
        municipioId: props.municipioId,
        paso: props.paso,
        requisito: props.requisito,
        personaId: props.personaId,
        anio: props.anio,
        tipoPrueba: props.tiposPrueba ? tipo || null : null,
        paginas,
      })
      setPaginas([])
      setConTicket(false)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el documento.')
    } finally {
      setSubiendo(false)
    }
  }

  const ver = async (id: string) => {
    const ventana = window.open('', '_blank')
    const { url, error: e } = await enlaceDocumento(props.expedienteId, id)
    if (url && ventana) ventana.location.href = url
    else {
      ventana?.close()
      setError(e ?? 'No se pudo abrir.')
    }
  }

  const quitar = async (id: string) => {
    if (!confirm('¿Quitar este documento del expediente?')) return
    const { error: e } = await quitarDocumento(props.expedienteId, id)
    if (e) setError(e)
    else startTransition(() => router.refresh())
  }

  return (
    <div className="mt-2 grid gap-2">
      {props.documentos.length > 0 && (
        <ul className="grid gap-1">
          {props.documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" onClick={() => ver(d.id)} className="text-azul underline-offset-2 hover:underline">
                Ver {d.tipo_prueba ? TIPOS_PRUEBA[d.tipo_prueba] ?? 'prueba' : 'documento'} ({d.paginas ?? 1} pág.)
              </button>
              {props.editable && !d.firmado && (
                <button type="button" onClick={() => quitar(d.id)} className="text-tenue hover:text-error">Quitar</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {props.editable && (
        <div className="grid gap-2">
          {props.tiposPrueba && (
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo min-h-9 text-sm" aria-label="Tipo de prueba">
              {props.tiposPrueba.map((t) => <option key={t} value={t}>{TIPOS_PRUEBA[t] ?? t}</option>)}
            </select>
          )}
          {pideTicket && paginas.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={conTicket} onChange={(e) => setConTicket(e.target.checked)} className="size-4" />
              Incluye el ticket o comprobante de pago
            </label>
          )}
          {paginas.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-sm text-azul">{paginas.length} página(s) lista(s) para unir en un PDF. Mirá que se lean bien antes de guardar.</p>
              <Miniaturas paginas={paginas} quitar={(i) => setPaginas((prev) => prev.filter((_, j) => j !== i))} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
            <input ref={archivo} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
            <button type="button" onClick={() => camara.current?.click()} className="boton min-h-9 text-sm">
              {paginas.length ? '+ Otra foto' : 'Sacar foto'}
            </button>
            <button type="button" onClick={() => archivo.current?.click()} className="boton min-h-9 text-sm">Elegir archivo</button>
            {paginas.length > 0 && (
              <>
                <button type="button" disabled={subiendo} onClick={subir} className="boton-principal min-h-9 text-sm">
                  {subiendo ? 'Subiendo…' : 'Guardar documento'}
                </button>
                <button type="button" disabled={subiendo} onClick={() => setPaginas([])} className="boton min-h-9 text-sm">Descartar</button>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  )
}

/** Vista previa de lo que se va a guardar, para ver si la foto salió legible. Cada una se puede sacar. */
function Miniaturas({ paginas, quitar }: { paginas: File[]; quitar: (i: number) => void }) {
  const urls = useMemo(() => paginas.map((p) => (p.type.startsWith('image/') ? URL.createObjectURL(p) : '')), [paginas])
  useEffect(() => () => urls.forEach((x) => x && URL.revokeObjectURL(x)), [urls])
  return (
    <ul className="flex flex-wrap gap-2">
      {paginas.map((p, i) => (
        <li key={`${p.name}-${i}`} className="relative">
          {urls[i]
            ? <a href={urls[i]} target="_blank" rel="noreferrer" title="Ver grande">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local del celular, sin pasar por el servidor */}
                <img src={urls[i]} alt={`Página ${i + 1}`} className="h-24 w-24 rounded-md border border-linea object-cover" /></a>
            : <span className="grid h-24 w-24 place-items-center rounded-md border border-linea bg-fondo text-xs text-tenue">PDF<br />{p.name.slice(0, 14)}</span>}
          <button type="button" onClick={() => quitar(i)} aria-label={`Sacar la página ${i + 1}`} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-error text-sm font-bold text-white">×</button>
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xs text-white">{i + 1}</span>
        </li>
      ))}
    </ul>
  )
}

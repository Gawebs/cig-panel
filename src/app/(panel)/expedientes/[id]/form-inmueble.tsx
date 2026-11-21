'use client'

import { useActionState } from 'react'
import { guardarInmueble } from '@/actions/expedientes'

type Valores = {
  padron: string | null
  domicilio_inmueble: string | null
  neighborhood_id: string | null
  locality_id: string | null
  manzana: string | null
  lote: string | null
  coordenadas: string | null
  notas: string | null
}

export function FormInmueble({ expedienteId, editable, barrios, localidades, valores }: {
  expedienteId: string
  editable: boolean
  barrios: { id: string; nombre: string }[]
  localidades: { id: string; nombre: string }[]
  valores: Valores
}) {
  const [estado, accion, enviando] = useActionState(guardarInmueble.bind(null, expedienteId), undefined)
  const v = { ...valores, ...(estado?.valores ?? {}) } as Valores

  return (
    <section className="tarjeta p-5">
      <h2 className="text-lg">Inmueble</h2>
      <form action={accion} className="mt-3 grid gap-3">
        <fieldset disabled={!editable} className="grid gap-3">
          {/* Domicilio y localidad se cargan en el paso 1 (son los del titular): acá solo se muestran. */}
          <input type="hidden" name="domicilio_inmueble" value={v.domicilio_inmueble ?? ''} />
          <input type="hidden" name="locality_id" value={v.locality_id ?? ''} />
          <p className="text-sm">
            <span className="font-semibold">Domicilio:</span> {v.domicilio_inmueble || 'sin cargar'}
            {' · '}<span className="font-semibold">Localidad:</span> {localidades.find((l) => l.id === v.locality_id)?.nombre ?? 'sin elegir'}
            <a href={`/expedientes/${expedienteId}/datos-iniciales`} className="ml-2 font-semibold text-azul hover:underline">Cambiar en el paso 1 →</a>
          </p>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Barrio</span>
            <select id="neighborhood_id" name="neighborhood_id" defaultValue={v.neighborhood_id ?? ''} className="campo">
              <option value="">Sin elegir</option>
              {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1"><span className="text-sm font-semibold">Manzana</span><input id="manzana" name="manzana" defaultValue={v.manzana ?? ''} className="campo" /></label>
            <label className="grid gap-1"><span className="text-sm font-semibold">Lote</span><input id="lote" name="lote" defaultValue={v.lote ?? ''} className="campo" /></label>
          </div>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Coordenadas</span>
            <input id="coordenadas" name="coordenadas" defaultValue={v.coordenadas ?? ''} placeholder="-26.832206,-65.195481" className="campo" />
          </label>
          <label className="grid gap-1"><span className="text-sm font-semibold">Notas internas</span><textarea id="notas" name="notas" defaultValue={v.notas ?? ''} rows={3} className="campo py-2" /></label>
          {editable && <div><button disabled={enviando} className="boton">{enviando ? 'Guardando…' : 'Guardar inmueble'}</button></div>}
        </fieldset>
        {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
        {estado?.ok && <p className="text-sm text-ok">{estado.ok}</p>}
      </form>
    </section>
  )
}

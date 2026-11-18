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
          <label className="grid gap-1"><span className="text-sm font-semibold">Domicilio del inmueble</span><input id="domicilio_inmueble" name="domicilio_inmueble" defaultValue={v.domicilio_inmueble ?? ''} className="campo" /></label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Barrio</span>
            <select id="neighborhood_id" name="neighborhood_id" defaultValue={v.neighborhood_id ?? ''} className="campo">
              <option value="">Sin elegir</option>
              {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Localidad</span>
            <select id="locality_id" name="locality_id" defaultValue={v.locality_id ?? ''} className="campo">
              <option value="">{localidades.length === 1 ? localidades[0].nombre : 'Según el barrio'}</option>
              {localidades.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <span className="text-xs text-tenue">Va en la declaración jurada y en el relevamiento social. Si queda sin elegir, se toma la del barrio.</span>
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
        <p className="text-xs text-tenue">Padrón: {valores.padron ?? 'sin cargar'}. Se carga al abrir el expediente; la corrección controlada (con doble confirmación) llega en la próxima etapa.</p>
      </form>
    </section>
  )
}

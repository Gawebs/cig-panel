'use client'

import { useActionState } from 'react'
import type { RespuestaConstancia } from '@/actions/constancias'
import { ESTADOS_CONSTANCIA } from '@/lib/textos'

export type ValoresConstancia = Partial<Record<
  'vecino_nombre' | 'dni' | 'domicilio' | 'neighborhood_id' | 'telefono' | 'estado' | 'fecha_visita' | 'presentado_ante'
  | 'padron_catastral' | 'matricula_catastral' | 'propietario_legal' | 'agente_nombre' | 'observaciones',
  string | null
>>

export function FormConstancia(props: {
  accion: (prev: RespuestaConstancia, f: FormData) => Promise<RespuestaConstancia>
  valores: ValoresConstancia
  barrios: { id: string; nombre: string }[]
  editable: boolean
  boton: string
}) {
  const [estado, enviar, enviando] = useActionState(props.accion, undefined)
  const v = { ...props.valores, ...(estado?.valores ?? {}) }
  const campo = (name: keyof ValoresConstancia, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1">
      <span className="text-sm font-semibold">{etiqueta}</span>
      <input name={name} defaultValue={v[name] ?? ''} className="campo" {...extra} />
    </label>
  )

  return (
    <form action={enviar} className="tarjeta grid gap-4 p-5">
      <fieldset disabled={!props.editable} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('vecino_nombre', 'Apellido y nombre del vecino', { required: true })}
          {campo('dni', 'DNI', { inputMode: 'numeric', placeholder: 'Sin puntos' })}
          {campo('domicilio', 'Domicilio')}
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Barrio</span>
            <select name="neighborhood_id" defaultValue={v.neighborhood_id ?? ''} className="campo">
              <option value="">Sin elegir</option>
              {props.barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          {campo('telefono', 'Teléfono', { inputMode: 'tel' })}
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Estado</span>
            <select name="estado" defaultValue={v.estado ?? 'pendiente'} className="campo">
              {Object.entries(ESTADOS_CONSTANCIA).map(([k, e]) => <option key={k} value={k}>{e.texto}</option>)}
            </select>
          </label>
          {campo('fecha_visita', 'Fecha de visita', { type: 'date' })}
          {campo('agente_nombre', 'Agente que visitó')}
        </div>
        <fieldset className="grid gap-3 rounded-lg border border-linea p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Datos del inmueble para la constancia</legend>
          {campo('padron_catastral', 'Padrón')}
          {campo('matricula_catastral', 'Matrícula catastral')}
          {campo('propietario_legal', 'Propietario legal')}
          {campo('presentado_ante', 'Presentado ante')}
        </fieldset>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Observaciones internas</span>
          <textarea name="observaciones" defaultValue={v.observaciones ?? ''} rows={3} className="campo py-2" />
        </label>
        {props.editable && <div><button disabled={enviando} className="boton-principal">{enviando ? 'Guardando…' : props.boton}</button></div>}
      </fieldset>
      {estado?.error && <p role="alert" className="text-error">{estado.error}</p>}
      {estado?.ok && <p className="text-ok">{estado.ok}</p>}
    </form>
  )
}

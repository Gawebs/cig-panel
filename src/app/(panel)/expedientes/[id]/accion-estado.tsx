'use client'

import { useActionState, useState } from 'react'
import { cambiarEstado } from '@/actions/expedientes'

export function AccionEstado(props: {
  expedienteId: string
  hacia: string
  texto: string
  pideNota?: boolean
  principal?: boolean
  aviso?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, accion, enviando] = useActionState(cambiarEstado.bind(null, props.expedienteId, props.hacia), undefined)
  const necesitaPaso = props.pideNota || props.aviso

  if (necesitaPaso && !abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={props.principal ? 'boton-principal' : 'boton'}>
        {props.texto}
      </button>
    )
  }

  return (
    <form action={accion} className={necesitaPaso ? 'grid w-full gap-2 rounded-lg border border-linea p-3 sm:max-w-md' : ''}>
      {props.aviso && <p className="text-sm text-aviso">{props.aviso}</p>}
      {props.pideNota && (
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">¿Qué hay que corregir o qué observó Catastro?</span>
          <textarea id={`nota-${props.hacia}`} name="nota" required rows={3} className="campo py-2" />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={enviando} className={props.principal ? 'boton-principal' : 'boton'}>
          {enviando ? 'Guardando…' : props.texto}
        </button>
        {necesitaPaso && <button type="button" onClick={() => setAbierto(false)} className="boton">Cancelar</button>}
      </div>
      {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
    </form>
  )
}

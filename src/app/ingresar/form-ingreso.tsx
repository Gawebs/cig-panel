'use client'

import { useActionState } from 'react'
import { ingresar } from '@/actions/sesion'

export function FormIngreso() {
  const [estado, accion, enviando] = useActionState(ingresar, undefined)

  return (
    <form action={accion} className="grid gap-4 p-6">
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Correo</span>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Contraseña</span>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required className="campo" />
      </label>
      {estado?.error && <p role="alert" className="rounded-md bg-error-suave px-3 py-2 text-sm text-error">{estado.error}</p>}
      <button type="submit" disabled={enviando} className="boton-principal">
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}

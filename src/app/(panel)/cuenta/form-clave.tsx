'use client'

import { useActionState } from 'react'
import { cambiarClave } from '@/actions/sesion'

export function FormClave() {
  const [estado, enviar, enviando] = useActionState(cambiarClave, undefined)
  return (
    <form action={enviar} className="tarjeta grid gap-3 p-5">
      <h2 className="text-lg">Cambiar contraseña</h2>
      <p className="text-sm text-tenue">Al menos 10 caracteres, con mayúsculas, minúsculas y números. Si te dieron una contraseña provisoria, cambiala ahora.</p>
      <label className="grid gap-1"><span className="text-sm font-semibold">Nueva contraseña</span><input name="clave" type="password" autoComplete="new-password" required minLength={10} className="campo" /></label>
      <label className="grid gap-1"><span className="text-sm font-semibold">Repetila</span><input name="repetida" type="password" autoComplete="new-password" required className="campo" /></label>
      <div><button disabled={enviando} className="boton-principal">{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button></div>
      {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-ok">{estado.ok}</p>}
    </form>
  )
}

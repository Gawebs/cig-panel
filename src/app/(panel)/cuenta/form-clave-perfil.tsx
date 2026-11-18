'use client'

import { useState } from 'react'
import { cifrar, llamarPanelLogin } from '@/lib/panel-login'

/** Cambio de contraseña para quien entra eligiendo su nombre (la contraseña vive en panel_usuarios). */
export function FormClavePerfil({ perfil }: { perfil: string }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)
    if (nueva.trim().length < 8) return setMensaje({ tipo: 'error', texto: 'La contraseña nueva tiene que tener al menos 8 caracteres.' })
    if (nueva !== repetida) return setMensaje({ tipo: 'error', texto: 'Las dos contraseñas nuevas no coinciden.' })
    setEnviando(true)
    try {
      await llamarPanelLogin({ accion: 'cambiar', clave: perfil, hash: await cifrar(actual), hashNuevo: await cifrar(nueva) })
      setActual('')
      setNueva('')
      setRepetida('')
      setMensaje({ tipo: 'ok', texto: 'Listo. Desde ahora entrás con la nueva contraseña.' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={cambiar} className="tarjeta grid gap-3 p-5">
      <h2 className="text-lg">Cambiar contraseña</h2>
      <label className="grid gap-1"><span className="text-sm font-semibold">Contraseña actual</span><input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} className="campo" /></label>
      <label className="grid gap-1"><span className="text-sm font-semibold">Nueva contraseña</span><input type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} className="campo" /></label>
      <label className="grid gap-1"><span className="text-sm font-semibold">Repetila</span><input type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} className="campo" /></label>
      <div><button disabled={enviando} className="boton-principal">{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button></div>
      {mensaje && <p role={mensaje.tipo === 'error' ? 'alert' : undefined} className={`text-sm ${mensaje.tipo === 'error' ? 'text-error' : 'text-ok'}`}>{mensaje.texto}</p>}
    </form>
  )
}

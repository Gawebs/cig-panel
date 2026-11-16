'use client'

import { useState } from 'react'
import { cifrar, llamarPanelLogin } from '@/lib/panel-login'
import { createClient } from '@/lib/supabase/client'
import { FormIngreso } from './form-ingreso'

export type PerfilIngreso = { usuario_clave: string; nombre: string; rol_texto: string }

export function IngresoPorPerfil({ perfiles }: { perfiles: PerfilIngreso[] }) {
  const [elegido, setElegido] = useState<PerfilIngreso | null>(null)
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [conCorreo, setConCorreo] = useState(false)

  if (conCorreo) {
    return (
      <div>
        <FormIngreso />
        <button type="button" className="w-full pb-5 text-sm text-azul hover:underline" onClick={() => setConCorreo(false)}>
          Volver a elegir mi nombre
        </button>
      </div>
    )
  }

  const ingresar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!elegido || !clave.trim()) return
    setEnviando(true)
    setError('')
    try {
      const r = await llamarPanelLogin({ accion: 'ingresar', clave: elegido.usuario_clave, hash: await cifrar(clave) })
      const supabase = createClient()
      const { error: e1 } = await supabase.auth.setSession({ access_token: r.access_token!, refresh_token: r.refresh_token! })
      if (e1) throw new Error('No se pudo iniciar la sesión.')
      const { error: e2 } = await supabase.rpc('vincular_perfil_de_ingreso')
      if (e2) {
        await supabase.auth.signOut()
        throw new Error(e2.message.replace(/^.*?ERROR:\s*/, ''))
      }
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={ingresar} className="grid gap-4 p-6">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">¿Quién sos?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {perfiles.map((p) => (
            <button
              key={p.usuario_clave}
              type="button"
              aria-pressed={elegido?.usuario_clave === p.usuario_clave}
              onClick={() => {
                setElegido(p)
                setError('')
              }}
              className={`rounded-lg border-2 px-3 py-2 text-left ${elegido?.usuario_clave === p.usuario_clave ? 'border-azul bg-azul-suave' : 'border-linea hover:border-azul'}`}
            >
              <span className="block font-semibold">{p.nombre}</span>
              <span className="block text-xs text-tenue">{p.rol_texto}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {elegido && (
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Contraseña de {elegido.nombre}</span>
          <input type="password" autoComplete="current-password" autoFocus value={clave} onChange={(e) => setClave(e.target.value)} className="campo" />
          <span className="text-xs text-tenue">La primera contraseña que cargues en cada perfil quedará registrada.</span>
        </label>
      )}
      {error && <p role="alert" className="rounded-md bg-error-suave px-3 py-2 text-sm text-error">{error}</p>}
      <button type="submit" disabled={!elegido || !clave.trim() || enviando} className="boton-principal">
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <button type="button" className="text-sm text-tenue hover:text-azul" onClick={() => setConCorreo(true)}>
        Ingresar con correo (soporte)
      </button>
    </form>
  )
}

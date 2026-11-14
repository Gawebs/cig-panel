'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  estaPendiente, guardarExpedientes, listarExpedientes, listarRelevamientos, pedirAlmacenamientoPersistente,
  type ExpedienteCampo, type RelevamientoCampo,
} from '@/lib/campo/almacen'
import { sincronizarPendientes } from '@/lib/campo/sincronizar'
import { Relevamiento } from './relevamiento'

const LEYES: Record<string, string> = { ley_pierri: 'Pierri', ley_5670: 'La Milagrosa', ley_8162: 'Menem' }
const ROLES_CAMPO = ['relevamiento', 'armado', 'subdireccion', 'direccion']
const ESTADOS_EDITABLES = ['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(true)
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    actualizar()
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])
  return enLinea
}

/** Trae del servidor los expedientes en armado de los municipios del usuario y los guarda para usar sin señal. */
async function traerExpedientes(): Promise<{ lista?: ExpedienteCampo[]; error?: string; sinSesion?: boolean }> {
  const supabase = createClient()
  const { data: usuario } = await supabase.auth.getUser()
  if (!usuario.user) return { sinSesion: true }
  const { data: membresias } = await supabase.from('memberships').select('municipality_id, roles').eq('user_id', usuario.user.id)
  const municipios = (membresias ?? []).filter((m) => (m.roles as string[]).some((r) => ROLES_CAMPO.includes(r))).map((m) => m.municipality_id)
  if (!municipios.length) return { error: 'Tu usuario no tiene permiso para relevar.' }
  const { data, error } = await supabase
    .from('case_files')
    .select('id, municipality_id, numero_interno, framework_id, domicilio_inmueble, assigned_to, neighborhoods(nombre), case_people(id, rol, solicitante_numero, apellido, nombre), field_surveys(id)')
    .in('municipality_id', municipios)
    .in('estado', ESTADOS_EDITABLES)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { error: error.message }
  const lista = (data ?? []).map((e) => {
    const personas = (e.case_people ?? []) as { id: string; rol: string; solicitante_numero: number; apellido: string; nombre: string }[]
    const titular = personas.find((p) => p.rol === 'solicitante' && p.solicitante_numero === 1)
    const barrio = e.neighborhoods as unknown as { nombre: string } | null
    const rel = e.field_surveys as unknown as { id: string }[] | { id: string } | null
    return {
      id: e.id,
      municipioId: e.municipality_id,
      numero: e.numero_interno,
      ley: e.framework_id,
      titular: titular ? `${titular.apellido}, ${titular.nombre}`.replace(/, $/, '') : 'Sin titular',
      titularId: titular?.id ?? null,
      domicilio: e.domicilio_inmueble,
      barrio: barrio?.nombre ?? null,
      asignadoAMi: e.assigned_to === usuario.user!.id,
      relevamientoId: Array.isArray(rel) ? (rel[0]?.id ?? null) : (rel?.id ?? null),
    } satisfies ExpedienteCampo
  })
  await guardarExpedientes(lista)
  return { lista }
}

export function AppCampo() {
  const enLinea = useEnLinea()
  const [expedientes, setExpedientes] = useState<ExpedienteCampo[]>([])
  const [relevamientos, setRelevamientos] = useState<RelevamientoCampo[]>([])
  const [elegido, setElegido] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null)
  const [sinSesion, setSinSesion] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [cargado, setCargado] = useState(false)

  const recargarLocal = useCallback(async () => {
    const [e, r] = await Promise.all([listarExpedientes(), listarRelevamientos()])
    setExpedientes(e)
    setRelevamientos(r)
    setCargado(true)
  }, [])

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine) return
    const pendientes = (await listarRelevamientos()).filter(estaPendiente)
    if (!pendientes.length) return
    setSubiendo(true)
    setAviso({ tipo: 'info', texto: `Subiendo ${pendientes.length === 1 ? 'un relevamiento' : `${pendientes.length} relevamientos`}…` })
    try {
      const nums = Object.fromEntries((await listarExpedientes()).map((e) => [e.id, e.numero]))
      const { subidos, errores, sinConexion } = await sincronizarPendientes(nums)
      if (sinConexion) setAviso({ tipo: 'info', texto: 'No hay conexión con el servidor. Lo relevado queda guardado en el celular y se sube cuando vuelva la señal.' })
      else if (errores.length) setAviso({ tipo: 'error', texto: errores.join(' · ') })
      else if (subidos) setAviso({ tipo: 'ok', texto: subidos === 1 ? 'Relevamiento subido al expediente.' : `${subidos} relevamientos subidos.` })
      else setAviso(null)
    } finally {
      setSubiendo(false)
      await recargarLocal()
    }
  }, [recargarLocal])

  const actualizarDesdeServidor = useCallback(async () => {
    if (!navigator.onLine) return
    const r = await traerExpedientes().catch(() => ({ error: 'Sin conexión con el servidor.' }) as const)
    if ('sinSesion' in r && r.sinSesion) setSinSesion(true)
    else if ('error' in r && r.error && !/fetch|network|conexión/i.test(r.error)) setAviso({ tipo: 'error', texto: r.error })
    await recargarLocal()
    await sincronizar()
  }, [recargarLocal, sincronizar])

  // Inicio: datos guardados en el celular primero; después, si hay señal, lo nuevo del servidor.
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    }
    pedirAlmacenamientoPersistente()
    const leerUrl = () => setElegido(new URLSearchParams(window.location.search).get('e'))
    leerUrl()
    window.addEventListener('popstate', leerUrl)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el almacenamiento del celular
    recargarLocal().then(actualizarDesdeServidor)
    return () => window.removeEventListener('popstate', leerUrl)
  }, [recargarLocal, actualizarDesdeServidor])

  // Al volver la señal, sube lo pendiente.
  useEffect(() => {
    window.addEventListener('online', sincronizar)
    return () => window.removeEventListener('online', sincronizar)
  }, [sincronizar])

  const abrir = (id: string | null) => {
    const url = id ? `/campo?e=${id}` : '/campo'
    window.history.pushState(null, '', url)
    setElegido(id)
    window.scrollTo(0, 0)
  }

  const pendientes = relevamientos.filter(estaPendiente).length
  const expediente = expedientes.find((e) => e.id === elegido)

  const filtrados = expedientes
    .filter((e) => {
      const q = busqueda.trim().toLowerCase()
      return !q || [e.numero, e.titular, e.domicilio, e.barrio].some((x) => x?.toLowerCase().includes(q))
    })
    .sort((a, b) => Number(b.asignadoAMi) - Number(a.asignadoAMi))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="degrade sticky top-0 z-20 text-white shadow">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {expediente ? (
            <button onClick={() => abrir(null)} className="-ml-2 rounded-md px-2 py-1 text-2xl leading-none hover:bg-white/15" aria-label="Volver a la lista">‹</button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider opacity-85">Relevamiento</p>
            <p className="truncate font-titulo text-lg leading-tight">{expediente ? `${expediente.numero} · ${expediente.titular}` : 'Expedientes para visitar'}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enLinea ? 'bg-white/20' : 'bg-black/30'}`}>
            {enLinea ? 'Con señal' : 'Sin señal'}
          </span>
        </div>
        {(pendientes > 0 || subiendo) && (
          <div className="bg-black/15">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-1.5 text-sm">
              <span>{subiendo ? 'Subiendo…' : `${pendientes} sin subir${enLinea ? '' : ': se suben solos cuando haya señal'}`}</span>
              {enLinea && !subiendo && <button onClick={sincronizar} className="rounded bg-white/20 px-2 py-0.5 font-semibold">Subir ahora</button>}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {aviso && (
          <p
            role="status"
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${aviso.tipo === 'ok' ? 'bg-ok-suave text-ok' : aviso.tipo === 'error' ? 'bg-error-suave text-error' : 'bg-azul-suave text-azul'}`}
          >
            {aviso.texto}
          </p>
        )}
        {sinSesion && (
          <p className="mb-3 rounded-lg bg-aviso-suave px-3 py-2 text-sm">
            Tu sesión venció. Lo que está en el celular no se pierde. <a href="/ingresar" className="font-semibold underline">Ingresá de nuevo</a> para subirlo.
          </p>
        )}

        {expediente ? (
          <Relevamiento key={expediente.id} expediente={expediente} enLinea={enLinea} alGuardar={recargarLocal} alTerminar={() => { abrir(null); sincronizar() }} />
        ) : (
          <>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por número, titular, domicilio o barrio"
              className="campo mb-3"
              aria-label="Buscar expediente"
            />
            {!cargado ? (
              <p className="text-tenue">Cargando…</p>
            ) : filtrados.length === 0 ? (
              <p className="tarjeta p-4 text-tenue">
                {expedientes.length === 0
                  ? enLinea ? 'No hay expedientes en armado para relevar.' : 'Todavía no hay expedientes guardados en este celular. Abrí la aplicación una vez con señal.'
                  : 'Ningún expediente coincide con la búsqueda.'}
              </p>
            ) : (
              <ul className="grid gap-2">
                {filtrados.map((e) => {
                  const rel = relevamientos.find((r) => r.expedienteId === e.id)
                  return (
                    <li key={e.id}>
                      <button onClick={() => abrir(e.id)} className="tarjeta flex w-full items-start gap-3 p-3 text-left hover:border-azul">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{e.titular}</p>
                          <p className="text-sm text-tenue">{[e.domicilio, e.barrio].filter(Boolean).join(' · ') || 'Sin domicilio cargado'}</p>
                          <p className="mt-1 text-xs text-tenue">{e.numero} · {LEYES[e.ley] ?? e.ley}{e.asignadoAMi ? ' · Asignado a vos' : ''}</p>
                        </div>
                        {rel && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${rel.estado === 'completo' ? 'bg-ok-suave text-ok' : 'bg-aviso-suave text-aviso'}`}>
                            {rel.estado === 'completo' ? (estaPendiente(rel) ? 'Terminado, sin subir' : 'Terminado') : 'Empezado'}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-6 text-center text-xs text-tenue">
              Todo lo que cargás queda guardado en este celular aunque no haya señal, y se sube solo cuando vuelve la conexión.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { RolUsuario } from '@/lib/textos'

export const COOKIE_MUNICIPIO = 'cig_municipio'

export interface Municipio {
  id: string
  nombre: string
  sigla: string
  tipo: 'municipio' | 'comuna'
  color_principal: string | null
}

export interface Contexto {
  userId: string
  nombre: string
  email: string
  esSoporte: boolean
  municipio: Municipio | null
  municipios: Municipio[]
  roles: RolUsuario[]
}

/**
 * Usuario, municipio activo y roles. Se resuelve una vez por pedido.
 * El municipio activo sale de una cookie, pero solo si el usuario pertenece a él;
 * igual la base vuelve a controlar cada acceso.
 */
export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar')

  const [{ data: perfil }, { data: membresias }, { data: soporte }] = await Promise.all([
    supabase.from('profiles').select('nombre, email, activo').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('roles, municipalities(id, nombre, sigla, tipo, color_principal)')
      .eq('user_id', user.id),
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])

  const lista = (membresias ?? []).flatMap((m) => {
    const muni = m.municipalities as unknown as Municipio | null
    return muni ? [{ muni, roles: m.roles as RolUsuario[] }] : []
  })

  const elegido = (await cookies()).get(COOKIE_MUNICIPIO)?.value
  const activo = lista.find((x) => x.muni.id === elegido) ?? lista[0] ?? null

  return {
    userId: user.id,
    nombre: perfil?.nombre ?? user.email ?? '',
    email: perfil?.email ?? user.email ?? '',
    esSoporte: Boolean(soporte),
    municipio: activo?.muni ?? null,
    municipios: lista.map((x) => x.muni),
    roles: activo?.roles ?? [],
  }
})

export function tieneRol(ctx: Contexto, ...roles: RolUsuario[]) {
  return ctx.roles.some((r) => roles.includes(r))
}

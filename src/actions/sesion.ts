'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_MUNICIPIO, obtenerContexto } from '@/lib/sesion'

const esquemaIngreso = z.object({
  email: z.string().trim().email('Revisá el correo.'),
  clave: z.string().min(1, 'Escribí tu contraseña.'),
})

export async function ingresar(_prev: { error?: string } | undefined, formData: FormData) {
  const datos = esquemaIngreso.safeParse({ email: formData.get('email'), clave: formData.get('clave') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: datos.data.email, password: datos.data.clave })
  if (error) return { error: 'El correo o la contraseña no coinciden.' }

  redirect('/')
}

export async function salir() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/ingresar')
}

export async function elegirMunicipio(formData: FormData) {
  const ctx = await obtenerContexto()
  const id = String(formData.get('municipio') ?? '')
  if (!ctx.municipios.some((m) => m.id === id)) return
  ;(await cookies()).set(COOKIE_MUNICIPIO, id, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' })
  redirect('/')
}

const esquemaClave = z
  .object({
    clave: z.string().min(10, 'La contraseña tiene que tener al menos 10 caracteres.').max(72),
    repetida: z.string(),
  })
  .refine((d) => /[a-z]/.test(d.clave) && /[A-Z]/.test(d.clave) && /\d/.test(d.clave), 'Usá mayúsculas, minúsculas y números.')
  .refine((d) => d.clave === d.repetida, 'Las dos contraseñas no coinciden.')

export async function cambiarClave(_prev: { error?: string; ok?: string } | undefined, formData: FormData) {
  await obtenerContexto()
  const datos = esquemaClave.safeParse({ clave: formData.get('clave'), repetida: formData.get('repetida') })
  if (!datos.success) return { error: datos.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: datos.data.clave })
  if (error) return { error: error.message.includes('different') ? 'La nueva contraseña tiene que ser distinta de la anterior.' : 'No se pudo cambiar la contraseña.' }
  return { ok: 'Listo. Desde ahora entrás con la nueva contraseña.' }
}

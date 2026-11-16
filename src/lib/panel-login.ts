'use client'

/**
 * Ingreso por perfil (personal de Banda del Río Salí que venía del panel anterior).
 * La contraseña la verifica la función `panel-login` de Supabase contra la tabla panel_usuarios;
 * acá se manda el SHA-256 de lo escrito, igual que hacía el panel anterior, para que cada persona
 * entre con la contraseña de siempre.
 */

export async function cifrar(clave: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave.trim()))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function llamarPanelLogin(cuerpo: Record<string, string>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  let res: Response
  try {
    res = await fetch(`${url}/functions/v1/panel-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisá la conexión e intentá de nuevo.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo validar el usuario.')
  return data as { ok: true; registrada?: boolean; access_token?: string; refresh_token?: string }
}

/** Clave del perfil de ingreso, si el usuario entró eligiendo su nombre (cuenta interna). */
export function perfilDeCorreo(email: string): string | null {
  const m = /^([a-z0-9-]+)@cig-brs\.local$/.exec(email)
  return m ? m[1] : null
}

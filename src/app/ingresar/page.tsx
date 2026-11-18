import { createClient } from '@/lib/supabase/server'
import { FormIngreso } from './form-ingreso'
import { IngresoPorPerfil, type PerfilIngreso } from './ingreso-perfil'

export const metadata = { title: 'Ingresar · CIG Regularización Dominial' }

// Municipio cuyo personal entra eligiendo su nombre (como en el panel anterior).
// Sin este dato, se entra con correo y contraseña.
const MUNICIPIO = process.env.NEXT_PUBLIC_MUNICIPIO_INGRESO ?? ''

export default async function PaginaIngreso() {
  const supabase = await createClient()
  const [{ data: perfiles }, { data: municipios }] = MUNICIPIO
    ? await Promise.all([
        supabase.rpc('perfiles_de_ingreso', { p_municipio: MUNICIPIO }),
        supabase.rpc('municipio_de_ingreso', { p_municipio: MUNICIPIO }),
      ])
    : [{ data: [] }, { data: [] }]
  const municipio = (municipios as { nombre: string; logo_path: string | null }[] | null)?.[0]
  const lista = (perfiles ?? []) as PerfilIngreso[]

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-linea bg-papel shadow-sm">
        <div className="degrade flex items-center gap-4 px-6 py-6 text-white">
          {municipio?.logo_path && (
            // eslint-disable-next-line @next/next/no-img-element -- logo del municipio
            <img src={municipio.logo_path} alt="" className="size-16 shrink-0 rounded-lg bg-white/90 object-contain p-1" />
          )}
          <div>
            <p className="text-sm uppercase tracking-wider opacity-85">Regularización dominial</p>
            <h1 className="mt-0.5 text-2xl leading-tight">{municipio?.nombre ?? 'CIG'}</h1>
            <p className="mt-1 text-sm opacity-90">Expedientes de escrituración social ante Catastro de Tucumán</p>
          </div>
        </div>
        {lista.length > 0 ? <IngresoPorPerfil perfiles={lista} /> : <FormIngreso />}
      </div>
    </main>
  )
}

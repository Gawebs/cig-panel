import { redirect } from 'next/navigation'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { FormNuevo, type LeyOpcion } from './form-nuevo'

export default async function NuevoExpediente() {
  const ctx = await obtenerContexto()
  if (!tieneRol(ctx, 'armado', 'subdireccion', 'direccion')) redirect('/')

  const supabase = await createClient()
  const { data } = await supabase
    .from('municipality_frameworks')
    .select('legal_frameworks(id, nombre, nombre_corto, usa_nomina_padrones, config)')
    .eq('municipality_id', ctx.municipio!.id)
    .eq('activo', true)

  const leyes: LeyOpcion[] = (data ?? []).map((f) => {
    const l = f.legal_frameworks as unknown as { id: string; nombre: string; nombre_corto: string; usa_nomina_padrones: boolean; config: { pruebas_posesion: { descripcion: string } } }
    return { id: l.id, nombre: l.nombre, nombreCorto: l.nombre_corto, usaNomina: l.usa_nomina_padrones, pruebas: l.config.pruebas_posesion.descripcion }
  })
  leyes.sort((a, b) => (a.id === 'ley_pierri' ? -1 : b.id === 'ley_pierri' ? 1 : a.nombreCorto.localeCompare(b.nombreCorto)))

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <p className="etiqueta">Nuevo expediente</p>
        <h1 className="text-3xl">¿Por qué ley se inicia?</h1>
        <p className="mt-1 text-tenue">La ley define los formularios, los documentos y los años de prueba que pide Catastro.</p>
      </div>
      <FormNuevo leyes={leyes} />
    </div>
  )
}

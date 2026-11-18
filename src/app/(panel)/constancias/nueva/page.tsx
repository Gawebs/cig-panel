import Link from 'next/link'
import { crearConstancia } from '@/actions/constancias'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { FormConstancia } from '../form-constancia'

export default async function NuevaConstancia() {
  const ctx = await obtenerContexto()
  const supabase = await createClient()
  const { data: barrios } = await supabase.from('neighborhoods').select('id, nombre').eq('municipality_id', ctx.municipio!.id).order('nombre')
  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/constancias" className="text-sm text-azul hover:underline">← Constancias</Link>
      <h1 className="text-3xl">Nueva constancia de tenencia precaria</h1>
      <p className="text-tenue">El número se asigna solo al guardar.</p>
      <FormConstancia accion={crearConstancia} valores={{ estado: 'pendiente' }} barrios={barrios ?? []} editable boton="Guardar constancia" />
    </div>
  )
}

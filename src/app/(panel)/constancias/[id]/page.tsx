import Link from 'next/link'
import { notFound } from 'next/navigation'
import { guardarConstancia } from '@/actions/constancias'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS_CONSTANCIA, TONOS } from '@/lib/textos'
import { FormConstancia } from '../form-constancia'
import { ArchivosConstancia, BorrarConstancia } from './archivos'

export default async function FichaConstancia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await obtenerContexto()
  const supabase = await createClient()
  const [{ data: c }, { data: archivos }] = await Promise.all([
    supabase.from('tenure_certificates').select('*').eq('id', id).maybeSingle(),
    supabase.from('tenure_certificate_files').select('id, nombre_archivo, paginas').eq('certificate_id', id).order('created_at'),
  ])
  if (!c) notFound()
  const { data: barrios } = await supabase.from('neighborhoods').select('id, nombre').eq('municipality_id', c.municipality_id).order('nombre')
  const editable = tieneRol(ctx, 'armado', 'relevamiento', 'subdireccion', 'direccion')
  const estado = ESTADOS_CONSTANCIA[c.estado as keyof typeof ESTADOS_CONSTANCIA]

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/constancias" className="text-sm text-azul hover:underline">← Constancias</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl tabular-nums">{c.numero}</h1>
          <p className="text-tenue">{c.vecino_nombre}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${TONOS[estado.tono]}`}>{estado.texto}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/imprimir/constancia/${id}`} target="_blank" rel="noopener" className="boton-principal">Imprimir constancia</a>
        {tieneRol(ctx, 'subdireccion', 'direccion') && c.estado !== 'entregado' && <BorrarConstancia id={id} />}
      </div>
      <FormConstancia accion={guardarConstancia.bind(null, id)} valores={c} barrios={barrios ?? []} editable={editable} boton="Guardar cambios" />
      <ArchivosConstancia id={id} municipioId={c.municipality_id} archivos={archivos ?? []} editable={editable} />
    </div>
  )
}

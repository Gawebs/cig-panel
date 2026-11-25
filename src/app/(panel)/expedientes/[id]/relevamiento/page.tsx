import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { cuestionario } from '@/lib/relevamiento/cuestionario'
import type { RespuestaGuardada } from '@/lib/relevamiento/aplicar'
import { RevisionRespuestas } from './revision'
import { AvanceRelevamiento } from '@/components/avance-relevamiento'

const EDITABLES = ['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

export default async function RevisarRelevamiento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  const [{ data: exp }, { data: rel }, { data: docs }] = await Promise.all([
    supabase.from('case_files').select('id, numero_interno, framework_id, estado').eq('id', id).maybeSingle(),
    supabase.from('field_surveys').select('id, estado, fecha, gps_lat, gps_lng, gps_precision_m, respuestas, observaciones, profiles(nombre)').eq('case_file_id', id).maybeSingle(),
    supabase.from('case_documents').select('id, requisito').eq('case_file_id', id).in('requisito', ['fotos_inmueble', 'croquis']).order('created_at'),
  ])
  const ultimoDoc = (requisito: string) => (docs ?? []).filter((d) => d.requisito === requisito).at(-1)?.id ?? null
  if (!exp) notFound()

  const volver = <Link href={`/expedientes/${id}`} className="text-sm text-azul hover:underline">← {exp.numero_interno}</Link>
  if (!rel) {
    return (
      <div className="grid max-w-2xl gap-4">
        {volver}
        <h1 className="text-3xl">Relevamiento</h1>
        <section className="tarjeta p-5">
          <AvanceRelevamiento expedienteId={id} ley={exp.framework_id} relevamiento={null} fotos={ultimoDoc('fotos_inmueble')} croquis={ultimoDoc('croquis')} />
        </section>
      </div>
    )
  }

  const respuestas = rel.respuestas as Record<string, RespuestaGuardada>
  const familiares = Math.max(0, ...Object.keys(respuestas).map((k) => Number(/^familiar\.(\d+)\./.exec(k)?.[1] ?? 0)))
  const preguntas = cuestionario(exp.framework_id, familiares)

  // Enlaces temporales (1 hora) para escuchar cada grabación.
  const rutas = Object.values(respuestas).map((r) => r.audio).filter(Boolean) as string[]
  const { data: firmados } = rutas.length ? await supabase.storage.from('audios').createSignedUrls(rutas, 3600) : { data: [] }
  const audios = Object.fromEntries((firmados ?? []).filter((f) => f.signedUrl).map((f) => [f.path, f.signedUrl]))

  const editable = EDITABLES.includes(exp.estado) && ctx.roles.some((r) => ['armado', 'subdireccion', 'direccion', 'relevamiento'].includes(r))
  const relevador = (rel.profiles as unknown as { nombre: string } | null)?.nombre

  return (
    <div className="grid max-w-3xl gap-5">
      {volver}
      <div>
        <h1 className="text-3xl">Relevamiento</h1>
        <p className="text-tenue">
          {rel.estado === 'en_curso' ? 'En curso' : rel.estado === 'completo' ? 'Terminado en el lugar' : 'Revisado'} · {new Date(`${rel.fecha}T12:00:00`).toLocaleDateString('es-AR')}
          {relevador ? ` · ${relevador}` : ''}
          {rel.gps_lat !== null ? ` · GPS ${Number(rel.gps_lat).toFixed(6)},${Number(rel.gps_lng).toFixed(6)}${Number(rel.gps_precision_m) === 0 ? " (escrita a mano)" : ` (±${Math.round(rel.gps_precision_m ?? 0)} m)`}` : ''}
        </p>
      </div>
      <section className="tarjeta p-5">
        <h2 className="mb-3 text-lg">Avance en el lugar</h2>
        <AvanceRelevamiento
          expedienteId={id}
          ley={exp.framework_id}
          relevamiento={{ ...rel, relevador, respuestas: respuestas as Record<string, { texto?: string }>, observaciones: (rel.observaciones ?? {}) as Record<string, unknown> }}
          fotos={ultimoDoc('fotos_inmueble')}
          croquis={ultimoDoc('croquis')}
        />
      </section>
      <RevisionRespuestas
        relevamientoId={rel.id}
        preguntas={preguntas.map((p) => ({ clave: p.clave, texto: p.texto }))}
        respuestas={respuestas}
        audios={audios}
        editable={editable}
      />
      <Link href={`/expedientes/${id}/formularios/relevamiento_social`} className="boton-principal justify-self-start">Ver e imprimir el relevamiento social</Link>
    </div>
  )
}

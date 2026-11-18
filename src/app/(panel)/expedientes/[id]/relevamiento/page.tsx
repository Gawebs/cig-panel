import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { cuestionario } from '@/lib/relevamiento/cuestionario'
import type { RespuestaGuardada } from '@/lib/relevamiento/aplicar'
import { RevisionRespuestas } from './revision'

const EDITABLES = ['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

export default async function RevisarRelevamiento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  const [{ data: exp }, { data: rel }] = await Promise.all([
    supabase.from('case_files').select('id, numero_interno, framework_id, estado').eq('id', id).maybeSingle(),
    supabase.from('field_surveys').select('id, estado, fecha, gps_lat, gps_lng, gps_precision_m, respuestas, observaciones, profiles(nombre)').eq('case_file_id', id).maybeSingle(),
  ])
  if (!exp) notFound()

  const volver = <Link href={`/expedientes/${id}`} className="text-sm text-azul hover:underline">← {exp.numero_interno}</Link>
  if (!rel) {
    return (
      <div className="grid max-w-2xl gap-4">
        {volver}
        <h1 className="text-3xl">Relevamiento</h1>
        <p className="tarjeta p-5 text-tenue">
          Todavía no se hizo la visita. El relevador lo carga desde el celular, en la aplicación de relevamiento (<span className="font-semibold">/campo</span>), con o sin señal.
        </p>
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
          {rel.gps_lat !== null ? ` · GPS ${Number(rel.gps_lat).toFixed(6)},${Number(rel.gps_lng).toFixed(6)} (±${Math.round(rel.gps_precision_m ?? 0)} m)` : ''}
        </p>
      </div>
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

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { plantillaDe, valoresDesdeFicha, type FichaExpediente, type FichaPersona } from '@/lib/formularios/plantillas'
import { observacionesEfectivas, type Observaciones } from '@/lib/relevamiento/observaciones'
import { EditorFormulario } from './editor'

const EDITABLES = ['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

export default async function PaginaFormulario({ params }: { params: Promise<{ id: string; clave: string }> }) {
  const { id, clave } = await params
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  const { data: exp } = await supabase
    .from('case_files')
    .select('numero_interno, estado, framework_id, domicilio_inmueble, departamento, padron, ubicacion, origen_posesion, origen_posesion_detalle, fecha_inicio_posesion, fecha_apertura, datos_catastrales, valores_formularios, formularios_impresos, coordenadas, numero_expediente_catastro, localities(nombre), municipalities(departamento), legal_frameworks(config)')
    .eq('id', id)
    .maybeSingle()
  if (!exp) notFound()

  const plantilla = plantillaDe(exp.framework_id, clave)
  const [{ data: personas }, { data: relevamiento }, { data: docsImagen }] = await Promise.all([
    supabase.from('case_people').select('*').eq('case_file_id', id),
    supabase.from('field_surveys').select('fecha, observaciones, respuestas').eq('case_file_id', id).maybeSingle(),
    plantilla?.imagenes?.length
      ? supabase.from('case_documents').select('id, requisito').eq('case_file_id', id).in('requisito', [...new Set(plantilla.imagenes.map((i) => i.requisito))]).order('created_at')
      : Promise.resolve({ data: [] as { id: string; requisito: string }[] }),
  ])
  // El último cargado de cada requisito (croquis, fotos) es el que se imprime dentro del formulario.
  const documentosImagen = Object.fromEntries((docsImagen ?? []).map((d) => [d.requisito, d.id]))

  if (!plantilla) {
    return (
      <div className="grid gap-3">
        <Link href={`/expedientes/${id}`} className="text-sm text-azul hover:underline">← {exp.numero_interno}</Link>
        <h1 className="text-2xl">Este formulario todavía no está cargado en el sistema</h1>
        <p className="text-tenue">Por ahora están la solicitud y la declaración jurada de la Ley Pierri y el relevamiento social de las tres leyes. Los de La Milagrosa y Menem llegan en las próximas etapas.</p>
      </div>
    )
  }

  const ficha: FichaExpediente = {
    ...exp,
    localidad: (exp.localities as unknown as { nombre: string } | null)?.nombre ?? null,
    departamento: exp.departamento ?? (exp.municipalities as unknown as { departamento: string | null } | null)?.departamento ?? null,
    datos_catastrales: (exp.datos_catastrales ?? {}) as Record<string, string>,
    valores_formularios: (exp.valores_formularios ?? {}) as Record<string, Record<string, string>>,
    marco: ((exp.legal_frameworks as unknown as { config: { ley_provincial?: string; decreto_reglamentario?: string } } | null)?.config) ?? {},
    relevamiento: relevamiento
      ? {
          fecha: relevamiento.fecha,
          observaciones: observacionesEfectivas({
            observaciones: relevamiento.observaciones as Observaciones,
            respuestas: relevamiento.respuestas as Record<string, { texto: string }>,
          }),
        }
      : null,
  }
  const valores = valoresDesdeFicha(plantilla, ficha, (personas ?? []) as FichaPersona[])
  const impreso = ((exp.formularios_impresos ?? {}) as Record<string, { huella: string; fecha: string }>)[clave] ?? null
  const editable = EDITABLES.includes(exp.estado) && ctx.roles.some((r) => ['armado', 'subdireccion', 'direccion', 'relevamiento'].includes(r))

  return (
    <div className="grid gap-4">
      <div>
        <Link href={`/expedientes/${id}`} className="text-sm text-azul hover:underline">← {exp.numero_interno}</Link>
        <h1 className="mt-1 text-3xl">{plantilla.titulo}</h1>
        <p className="text-tenue">
          Es el formulario original de Catastro. Los datos salen de la ficha del expediente: si corregís algo acá, se corrige en la ficha y en todos los formularios.
        </p>
      </div>
      <EditorFormulario expedienteId={id} plantilla={plantilla} valoresFicha={valores} editable={editable} impreso={impreso} documentosImagen={documentosImagen} />
    </div>
  )
}

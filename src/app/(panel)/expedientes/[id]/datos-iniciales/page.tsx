import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { FormNuevo, type LeyOpcion } from '../../nuevo/form-nuevo'
import { PasosExpediente } from '@/components/pasos-expediente'

const EDITABLES = ['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

/** La pantalla de apertura otra vez, con lo cargado al principio, para corregirlo. */
export default async function DatosIniciales({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await obtenerContexto()
  if (!tieneRol(ctx, 'armado', 'subdireccion', 'direccion')) redirect(`/expedientes/${id}`)

  const supabase = await createClient()
  const { data: exp } = await supabase
    .from('case_files')
    .select('id, numero_interno, estado, framework_id, municipality_id, padron, datos_catastrales, domicilio_inmueble, locality_id, origen_posesion, origen_posesion_detalle, fecha_inicio_posesion, tiene_documentacion_ipvdu, legal_frameworks(id, nombre, nombre_corto, usa_nomina_padrones, config)')
    .eq('id', id)
    .maybeSingle()
  if (!exp) notFound()
  if (!EDITABLES.includes(exp.estado)) redirect(`/expedientes/${id}`)

  const { data: titular } = await supabase
    .from('case_people')
    .select('id, apellido, nombre, dni, estado_civil, cuil, telefono, correo, domicilio, ciudad, sexo, fecha_nacimiento')
    .eq('case_file_id', id)
    .eq('rol', 'solicitante')
    .eq('solicitante_numero', 1)
    .maybeSingle()
  if (!titular) redirect(`/expedientes/${id}`)

  const l = exp.legal_frameworks as unknown as { id: string; nombre: string; nombre_corto: string; usa_nomina_padrones: boolean; config: { pruebas_posesion: { descripcion: string } } }
  const leyes: LeyOpcion[] = [{ id: l.id, nombre: l.nombre, nombreCorto: l.nombre_corto, usaNomina: l.usa_nomina_padrones, pruebas: l.config.pruebas_posesion.descripcion }]

  const { data: localidades } = await supabase.from('localities').select('id, nombre').eq('municipality_id', exp.municipality_id).order('nombre')
  const valores: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...titular, padron: exp.padron, domicilio_inmueble: exp.domicilio_inmueble, locality_id: exp.locality_id, origen_posesion: exp.origen_posesion, origen_posesion_detalle: exp.origen_posesion_detalle, fecha_inicio_posesion: exp.fecha_inicio_posesion, tiene_documentacion_ipvdu: exp.tiene_documentacion_ipvdu, ...((exp.datos_catastrales ?? {}) as Record<string, string>) })) {
    if (k !== 'id' && v !== null && v !== undefined) valores[k] = String(v)
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PasosExpediente expedienteId={id} actual={1} />
      <div>
        <Link href={`/expedientes/${id}`} className="text-sm text-azul hover:underline">← Volver a {exp.numero_interno}</Link>
        <p className="etiqueta mt-2">Datos iniciales · {exp.numero_interno}</p>
        <h1 className="text-3xl">Datos iniciales</h1>
        <p className="mt-1 text-tenue">Lo que cambies acá se actualiza en todos los formularios. Al guardar, seguís al paso 2.</p>
      </div>
      <FormNuevo
        leyes={leyes}
        localidades={localidades ?? []}
        edicion={{ expedienteId: id, titularId: titular.id, municipioId: exp.municipality_id, ley: l.id, valores }}
      />
    </div>
  )
}

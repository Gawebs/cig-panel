import { notFound } from 'next/navigation'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { calcularInforme, ROLES_INFORME, type CasoInforme } from '@/lib/informe'
import { ImprimirAlAbrir } from '../constancia/[id]/imprimir-al-abrir'
import { DocumentoInforme, type DatosMunicipio, type PlazoAbierto } from './documento'

export const metadata = { title: 'Informe de Regularización Dominial' }

function diasHasta(iso: string) {
  const hoy = new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })}T12:00:00`).getTime()
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - hoy) / 86400000)
}

export default async function ImprimirInforme({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams
  const ctx = await obtenerContexto()
  if (!ctx.municipio || !(ctx.esSoporte || tieneRol(ctx, ...ROLES_INFORME))) notFound()
  const muni = ctx.municipio.id
  const supabase = await createClient()

  const { data: m } = await supabase
    .from('municipalities')
    .select('nombre, tipo, logo_path, area_nombre, secretaria_nombre, informe_intendente')
    .eq('id', muni)
    .maybeSingle()
  if (!m?.informe_intendente) notFound()

  const [{ data: expedientes }, { data: eventos }, { data: observaciones }] = await Promise.all([
    supabase
      .from('case_files')
      .select('id, estado, fecha_apertura, framework_id, legal_frameworks(nombre_corto), neighborhoods(nombre)')
      .eq('municipality_id', muni)
      .limit(10000),
    supabase
      .from('case_events')
      .select('case_file_id, a_estado, created_at')
      .eq('municipality_id', muni)
      .eq('tipo', 'cambio_estado')
      .in('a_estado', ['presentado', 'aceptado'])
      .limit(20000),
    supabase
      .from('catastro_observations')
      .select('vence_el, prorroga_hasta, case_files(numero_interno, neighborhoods(nombre))')
      .eq('municipality_id', muni)
      .neq('estado', 'respondida'),
  ])

  const casos: CasoInforme[] = (expedientes ?? []).map((e) => ({
    id: e.id,
    estado: e.estado,
    fecha_apertura: e.fecha_apertura,
    barrio: (e.neighborhoods as unknown as { nombre: string } | null)?.nombre ?? 'Sin barrio',
    ley: (e.legal_frameworks as unknown as { nombre_corto: string } | null)?.nombre_corto ?? e.framework_id,
  }))
  const informe = calcularInforme(casos, eventos ?? [])
  const plazos: PlazoAbierto[] = (observaciones ?? [])
    .map((o) => {
      const cf = o.case_files as unknown as { numero_interno: string; neighborhoods: { nombre: string } | null } | null
      return { numero: cf?.numero_interno ?? '—', barrio: cf?.neighborhoods?.nombre ?? 'Sin barrio', dias: diasHasta(o.prorroga_hasta ?? o.vence_el) }
    })
    .sort((a, b) => a.dias - b.dias)

  return (
    <>
      <ImprimirAlAbrir automatico={!vista} />
      <p className="no-imprimir" style={{ textAlign: 'center', color: '#555', fontSize: 13, margin: '0 0 12px' }}>
        Para guardarlo como PDF, en la ventana de impresión elegí “Guardar como PDF” como impresora.
      </p>
      <DocumentoInforme municipio={m as DatosMunicipio} informe={informe} plazos={plazos} generadoPor={ctx.nombre} fecha={new Date()} />
    </>
  )
}

import Link from 'next/link'
import { EstadoChip } from '@/components/estado'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS } from '@/lib/textos'

type Busqueda = { q?: string; estado?: string; ley?: string; barrio?: string }

export default async function ListaExpedientes({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { q = '', estado = '', ley = '', barrio = '' } = await searchParams
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  const [{ data: leyes }, { data }, { data: barrios }] = await Promise.all([
    supabase.from('municipality_frameworks').select('framework_id, legal_frameworks(nombre_corto)').eq('municipality_id', ctx.municipio!.id).eq('activo', true),
    (() => {
      let consulta = supabase
        .from('case_files')
        .select('id, numero_interno, estado, padron, fecha_apertura, framework_id, legal_frameworks(nombre_corto), case_people(apellido, nombre, dni, rol, solicitante_numero)')
        .eq('municipality_id', ctx.municipio!.id)
        .order('created_at', { ascending: false })
        .limit(300)
      if (estado) consulta = consulta.eq('estado', estado)
      if (ley) consulta = consulta.eq('framework_id', ley)
      if (barrio) consulta = consulta.eq('neighborhood_id', barrio)
      return consulta
    })(),
    supabase.from('neighborhoods').select('id, nombre').eq('municipality_id', ctx.municipio!.id).order('nombre'),
  ])

  const termino = q.trim().toLowerCase()
  const filas = (data ?? []).filter((f) => {
    if (!termino) return true
    const personas = f.case_people.map((p) => `${p.apellido} ${p.nombre} ${p.dni ?? ''}`).join(' ')
    return `${f.numero_interno} ${f.padron ?? ''} ${personas}`.toLowerCase().includes(termino)
  })

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl">Expedientes</h1>
        {tieneRol(ctx, 'armado', 'subdireccion', 'direccion') && <Link href="/expedientes/nuevo" className="boton-principal">Nuevo expediente</Link>}
      </div>

      <form className="tarjeta grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre, DNI, padrón o número" className="campo" aria-label="Buscar" />
        <select id="estado" name="estado" defaultValue={estado} className="campo" aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </select>
        <select id="ley" name="ley" defaultValue={ley} className="campo" aria-label="Ley">
          <option value="">Todas las leyes</option>
          {(leyes ?? []).map((l) => (
            <option key={l.framework_id} value={l.framework_id}>{(l.legal_frameworks as unknown as { nombre_corto: string }).nombre_corto}</option>
          ))}
        </select>
        <select id="barrio" name="barrio" defaultValue={barrio} className="campo" aria-label="Barrio">
          <option value="">Todos los barrios</option>
          {(barrios ?? []).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <button className="boton">Filtrar</button>
      </form>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-fondo text-sm text-tenue">
            <tr>
              <th className="px-4 py-3 font-semibold">Número</th>
              <th className="px-4 py-3 font-semibold">Titular</th>
              <th className="px-4 py-3 font-semibold">Ley</th>
              <th className="px-4 py-3 font-semibold">Padrón</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-tenue">No hay expedientes con estos filtros.</td></tr>
            )}
            {filas.map((f) => {
              const t = f.case_people.find((p) => p.rol === 'solicitante' && p.solicitante_numero === 1)
              return (
                <tr key={f.id} className="hover:bg-fondo">
                  <td className="px-4 py-3 tabular-nums"><Link href={`/expedientes/${f.id}`} className="font-semibold text-azul hover:underline">{f.numero_interno}</Link></td>
                  <td className="px-4 py-3">{t ? `${t.apellido}, ${t.nombre}` : '—'}</td>
                  <td className="px-4 py-3">{(f.legal_frameworks as unknown as { nombre_corto: string }).nombre_corto}</td>
                  <td className="px-4 py-3 tabular-nums">{f.padron ?? '—'}</td>
                  <td className="px-4 py-3"><EstadoChip estado={f.estado} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS_CONSTANCIA, TONOS } from '@/lib/textos'

type Busqueda = { q?: string; estado?: string }

export default async function Constancias({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { q = '', estado = '' } = await searchParams
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  let consulta = supabase
    .from('tenure_certificates')
    .select('id, numero, estado, vecino_nombre, dni, domicilio, barrio, created_at, tenure_certificate_files(count)')
    .eq('municipality_id', ctx.municipio!.id)
    .order('created_at', { ascending: false })
    .limit(500)
  if (estado) consulta = consulta.eq('estado', estado)
  const { data } = await consulta

  const todas = data ?? []
  const termino = q.trim().toLowerCase()
  const filas = todas.filter((c) => !termino || [c.numero, c.vecino_nombre, c.dni, c.domicilio, c.barrio].some((x) => x?.toLowerCase().includes(termino)))
  const conArchivos = (c: (typeof todas)[number]) => ((c.tenure_certificate_files as unknown as { count: number }[])[0]?.count ?? 0) > 0

  const resumen = [
    ['Constancias', todas.length, 'Solicitudes registradas'],
    ['Pendientes', todas.filter((c) => c.estado === 'pendiente').length, 'Requieren gestión'],
    ['Listas o entregadas', todas.filter((c) => c.estado === 'listo' || c.estado === 'entregado').length, 'Proceso avanzado'],
    ['Con archivos', todas.filter(conArchivos).length, 'Documentación cargada'],
  ] as const

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Constancias de tenencia precaria</h1>
          <p className="text-tenue">Para vecinos que todavía no inician la escrituración.</p>
        </div>
        {tieneRol(ctx, 'armado', 'relevamiento', 'subdireccion', 'direccion') && <Link href="/constancias/nueva" className="boton-principal">Nueva constancia</Link>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resumen.map(([titulo, valor, nota]) => (
          <div key={titulo} className="tarjeta p-4">
            <p className="text-sm text-tenue">{titulo}</p>
            <p className="font-titulo text-3xl tabular-nums">{valor}</p>
            <p className="text-xs text-tenue">{nota}</p>
          </div>
        ))}
      </div>

      <form className="tarjeta grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Buscar vecino, DNI, domicilio, barrio o número" className="campo" aria-label="Buscar" />
        <select name="estado" defaultValue={estado} className="campo" aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_CONSTANCIA).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </select>
        <button className="boton">Filtrar</button>
      </form>

      <div className="tarjeta overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-fondo text-sm text-tenue">
            <tr>
              <th className="px-4 py-3 font-semibold">Número</th>
              <th className="px-4 py-3 font-semibold">Vecino</th>
              <th className="px-4 py-3 font-semibold">Domicilio</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Archivos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-tenue">{todas.length ? 'Ninguna constancia coincide con la búsqueda.' : 'Todavía no hay constancias.'}</td></tr>
            ) : filas.map((c) => {
              const e = ESTADOS_CONSTANCIA[c.estado as keyof typeof ESTADOS_CONSTANCIA]
              return (
                <tr key={c.id} className="hover:bg-fondo">
                  <td className="px-4 py-3 font-semibold tabular-nums"><Link href={`/constancias/${c.id}`} className="text-azul hover:underline">{c.numero}</Link></td>
                  <td className="px-4 py-3">{c.vecino_nombre}{c.dni ? <span className="block text-sm text-tenue">DNI {c.dni}</span> : null}</td>
                  <td className="px-4 py-3 text-sm">{[c.domicilio, c.barrio].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONOS[e.tono]}`}>{e.texto}</span></td>
                  <td className="px-4 py-3 text-sm">{conArchivos(c) ? 'Sí' : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

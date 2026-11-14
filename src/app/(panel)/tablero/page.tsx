import Link from 'next/link'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { EstadoExpediente } from '@/lib/textos'

// Etapas del trámite, agrupando estados, para leer el avance de un vistazo.
const ETAPAS: { clave: string; titulo: string; estados: EstadoExpediente[]; color: string }[] = [
  { clave: 'armado', titulo: 'En armado', estados: ['en_armado', 'devuelto'], color: 'bg-azul-suave text-azul' },
  { clave: 'oficina', titulo: 'Revisión y firma', estados: ['listo_para_revisar', 'aprobado', 'firmado'], color: 'bg-aviso-suave text-aviso' },
  { clave: 'catastro', titulo: 'En Catastro', estados: ['presentado', 'reingresado', 'prorroga_pedida'], color: 'bg-azul-suave text-azul' },
  { clave: 'observado', titulo: 'Observados', estados: ['observado'], color: 'bg-error-suave text-error' },
  { clave: 'aceptado', titulo: 'Aceptados', estados: ['aceptado'], color: 'bg-ok-suave text-ok' },
]

function diasHasta(iso: string) {
  const hoy = new Date(`${new Date().toLocaleDateString('sv-SE')}T12:00:00`).getTime()
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - hoy) / 86400000)
}

export default async function Tablero() {
  const ctx = await obtenerContexto()
  const supabase = await createClient()
  const muni = ctx.municipio!.id

  const [{ data: expedientes }, { data: observaciones }] = await Promise.all([
    supabase
      .from('case_files')
      .select('id, estado, framework_id, legal_frameworks(nombre_corto), neighborhoods(nombre)')
      .eq('municipality_id', muni)
      .not('estado', 'in', '(desistido,archivado)')
      .limit(5000),
    supabase
      .from('catastro_observations')
      .select('id, case_file_id, vence_el, prorroga_hasta, estado, texto, case_files(numero_interno)')
      .eq('municipality_id', muni)
      .neq('estado', 'respondida'),
  ])

  const lista = expedientes ?? []
  const etapaDe = (estado: string) => ETAPAS.find((e) => (e.estados as string[]).includes(estado))?.clave
  const contar = (filas: typeof lista, clave: string) => filas.filter((x) => etapaDe(x.estado) === clave).length

  const barrios = new Map<string, typeof lista>()
  for (const e of lista) {
    const nombre = (e.neighborhoods as unknown as { nombre: string } | null)?.nombre ?? 'Sin barrio'
    barrios.set(nombre, [...(barrios.get(nombre) ?? []), e])
  }
  const filasBarrio = [...barrios.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  const leyes = new Map<string, typeof lista>()
  for (const e of lista) {
    const nombre = (e.legal_frameworks as unknown as { nombre_corto: string } | null)?.nombre_corto ?? e.framework_id
    leyes.set(nombre, [...(leyes.get(nombre) ?? []), e])
  }

  const vencimientos = (observaciones ?? [])
    .map((o) => ({ ...o, vence: o.prorroga_hasta ?? o.vence_el }))
    .map((o) => ({ ...o, dias: diasHasta(o.vence) }))
    .sort((a, b) => a.dias - b.dias)

  const aceptados = contar(lista, 'aceptado')
  const avance = lista.length ? Math.round((aceptados / lista.length) * 100) : 0

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Tablero</h1>
        <p className="text-tenue">{lista.length} expedientes en curso o terminados · {avance}% aceptados por Catastro</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ETAPAS.map((e) => (
          <Link key={e.clave} href={`/expedientes?estado=${e.estados[0]}`} className="tarjeta p-4 hover:border-azul">
            <p className="text-sm text-tenue">{e.titulo}</p>
            <p className="font-titulo text-3xl tabular-nums">{contar(lista, e.clave)}</p>
          </Link>
        ))}
      </div>

      <section className="tarjeta p-5">
        <h2 className="text-lg">Plazos de Catastro</h2>
        {vencimientos.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">No hay observaciones abiertas.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {vencimientos.map((o) => {
              const tono = o.dias < 0 ? 'bg-error-suave text-error' : o.dias <= 3 ? 'bg-aviso-suave text-aviso' : 'bg-azul-suave text-azul'
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linea px-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/expedientes/${o.case_file_id}`} className="font-semibold text-azul hover:underline">{(o.case_files as unknown as { numero_interno: string }).numero_interno}</Link>
                    <span className="block truncate text-sm text-tenue">{o.texto}</span>
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tono}`}>
                    {o.dias < 0 ? `Vencido hace ${-o.dias} día(s)` : o.dias === 0 ? 'Vence hoy' : `Faltan ${o.dias} día(s)`}{o.estado === 'prorroga' ? ' · con prórroga' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="tarjeta overflow-x-auto">
        <h2 className="px-5 pt-5 text-lg">Por barrio</h2>
        <table className="mt-3 w-full min-w-[640px] text-left text-sm">
          <thead className="bg-fondo text-tenue">
            <tr>
              <th className="px-4 py-2 font-semibold">Barrio</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
              {ETAPAS.map((e) => <th key={e.clave} className="px-4 py-2 text-right font-semibold">{e.titulo}</th>)}
              <th className="px-4 py-2 font-semibold">Avance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filasBarrio.length === 0 ? (
              <tr><td colSpan={ETAPAS.length + 3} className="px-4 py-6 text-center text-tenue">Todavía no hay expedientes.</td></tr>
            ) : filasBarrio.map(([barrio, filas]) => {
              const pct = Math.round((contar(filas, 'aceptado') / filas.length) * 100)
              return (
                <tr key={barrio}>
                  <td className="px-4 py-2 font-semibold">{barrio}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{filas.length}</td>
                  {ETAPAS.map((e) => <td key={e.clave} className="px-4 py-2 text-right tabular-nums">{contar(filas, e.clave) || ''}</td>)}
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-linea"><span className="block h-full bg-ok" style={{ width: `${pct}%` }} /></span>
                      <span className="tabular-nums">{pct}%</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="tarjeta p-5">
        <h2 className="text-lg">Por ley</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {[...leyes.entries()].map(([ley, filas]) => (
            <li key={ley} className="rounded-lg border border-linea px-4 py-3">
              <p className="font-semibold">{ley}</p>
              <p className="text-sm text-tenue">{filas.length} expedientes · {contar(filas, 'aceptado')} aceptados</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

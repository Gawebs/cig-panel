import Link from 'next/link'
import { EstadoChip } from '@/components/estado'
import { obtenerContexto, tieneRol } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { EstadoExpediente } from '@/lib/textos'

type Fila = {
  id: string
  numero_interno: string
  estado: EstadoExpediente
  padron: string | null
  updated_at: string
  legal_frameworks: { nombre_corto: string } | null
  case_people: { apellido: string; nombre: string; rol: string; solicitante_numero: number }[]
}

function titular(f: Fila) {
  const t = f.case_people.find((p) => p.rol === 'solicitante' && p.solicitante_numero === 1)
  return t ? `${t.apellido}, ${t.nombre}`.replace(/, $/, '') : 'Sin titular'
}

function Bandeja({ titulo, ayuda, filas, vacio }: { titulo: string; ayuda: string; filas: Fila[]; vacio: string }) {
  return (
    <section className="tarjeta overflow-hidden">
      <div className="border-b border-linea px-5 py-4">
        <h2 className="text-lg">{titulo} <span className="text-tenue">({filas.length})</span></h2>
        <p className="text-sm text-tenue">{ayuda}</p>
      </div>
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-tenue">{vacio}</p>
      ) : (
        <ul className="divide-y divide-linea">
          {filas.map((f) => (
            <li key={f.id}>
              <Link href={`/expedientes/${f.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-fondo">
                <span className="min-w-0">
                  <span className="block font-semibold">{titular(f)}</span>
                  <span className="block text-sm text-tenue tabular-nums">
                    {f.numero_interno} · {f.legal_frameworks?.nombre_corto} · Padrón {f.padron ?? 'sin cargar'}
                  </span>
                </span>
                <EstadoChip estado={f.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function Inicio() {
  const ctx = await obtenerContexto()
  const supabase = await createClient()
  const { data } = await supabase
    .from('case_files')
    .select('id, numero_interno, estado, padron, updated_at, legal_frameworks(nombre_corto), case_people(apellido, nombre, rol, solicitante_numero)')
    .eq('municipality_id', ctx.municipio!.id)
    .order('updated_at', { ascending: false })
    .limit(200)
  const filas = (data ?? []) as unknown as Fila[]
  const por = (...estados: EstadoExpediente[]) => filas.filter((f) => estados.includes(f.estado))

  const puedeAbrir = tieneRol(ctx, 'armado', 'subdireccion', 'direccion')

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Lo que tengo que hacer hoy</p>
          <h1 className="text-3xl">Hola, {ctx.nombre.split(' ')[0]}</h1>
        </div>
        {puedeAbrir && <Link href="/expedientes/nuevo" className="boton-principal">Nuevo expediente</Link>}
      </div>

      {por('observado').length > 0 && (
        <div role="alert" className="rounded-xl border border-error bg-error-suave px-5 py-4 text-error">
          <strong>Hay {por('observado').length} expediente(s) observados por Catastro.</strong> Corren 10 días desde el aviso.
        </div>
      )}

      {tieneRol(ctx, 'relevamiento') && (
        <a href="/campo" className="tarjeta flex items-center justify-between gap-4 p-5 hover:border-azul">
          <span>
            <span className="block font-titulo text-xl">Aplicación de relevamiento</span>
            <span className="block text-sm text-tenue">Para las visitas: ubicación, fotos, croquis y entrevista grabada. Funciona sin señal. En el celular, abrila y elegí “Agregar a la pantalla de inicio”.</span>
          </span>
          <span className="boton-principal shrink-0">Abrir</span>
        </a>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {tieneRol(ctx, 'subdireccion', 'direccion') && (
          <Bandeja titulo="Esperan tu revisión" ayuda="Completos, listos para aprobar o devolver." filas={por('listo_para_revisar')} vacio="No hay expedientes esperando revisión." />
        )}
        {tieneRol(ctx, 'direccion') && (
          <Bandeja titulo="Esperan tu firma digital" ayuda="Aprobados por subdirección." filas={por('aprobado')} vacio="No hay expedientes para firmar." />
        )}
        {tieneRol(ctx, 'subdireccion', 'direccion') && (
          <Bandeja titulo="Listos para presentar en Catastro" ayuda="Firmados, falta subirlos al portal." filas={por('firmado', 'reingresado')} vacio="Nada pendiente de presentar." />
        )}
        {tieneRol(ctx, 'armado', 'subdireccion', 'direccion', 'relevamiento') && (
          <Bandeja titulo="En armado" ayuda="Todavía les falta documentación." filas={por('en_armado', 'devuelto')} vacio="No hay expedientes en armado." />
        )}
        {tieneRol(ctx, 'consulta') && (
          <Bandeja titulo="Últimos movimientos" ayuda="Los expedientes que cambiaron hace poco." filas={filas.slice(0, 10)} vacio="Todavía no hay expedientes." />
        )}
      </div>
    </div>
  )
}

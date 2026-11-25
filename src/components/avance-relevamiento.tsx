import { cuestionario } from '@/lib/relevamiento/cuestionario'
import { GRUPOS } from '@/lib/relevamiento/observaciones'
import { MiniaturasPdf } from '@/components/miniaturas-pdf'

export interface DatosAvance {
  expedienteId: string
  ley: string
  relevamiento: {
    estado: string
    fecha: string
    relevador?: string | null
    gps_lat: number | null
    gps_lng: number | null
    gps_precision_m: number | null
    respuestas: Record<string, { texto?: string } | undefined>
    observaciones: Record<string, unknown>
  } | null
  /** Último documento subido de cada tipo (id). */
  fotos?: string | null
  croquis?: string | null
}

const ROTULOS_FOTOS = ['Frente', 'Contrafrente', 'Interior 1', 'Interior 2']
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Lo que hizo el relevador en la calle, tal como está en el sistema (no lo que hay guardado en esta computadora):
 * avance por parte, las fotos, el croquis y la ubicación. Se ve aunque el relevamiento no esté terminado.
 */
export function AvanceRelevamiento({ expedienteId, ley, relevamiento: r, fotos, croquis }: DatosAvance) {
  if (!r && !fotos && !croquis) {
    return <p className="text-sm text-tenue">Todavía no se hizo la visita. El relevador la carga desde el celular, en la aplicación de relevamiento.</p>
  }
  const respuestas = r?.respuestas ?? {}
  const familiares = Math.max(0, ...Object.keys(respuestas).map((k) => Number(/^familiar\.(\d+)\./.exec(k)?.[1] ?? 0)))
  const preguntas = cuestionario(ley, familiares)
  const contestadas = preguntas.filter((p) => texto(respuestas[p.clave]?.texto)).length
  const obs = r?.observaciones ?? {}
  const obligatorios = GRUPOS.filter((g) => g.obligatorio)
  const marcados = obligatorios.filter((g) => { const v = obs[g.clave]; return Array.isArray(v) ? v.length > 0 : Boolean(texto(v)) }).length
  const datosCroquis = Object.keys(obs).some((k) => k.startsWith('croquis_'))
  const gps = r?.gps_lat !== null && r?.gps_lat !== undefined ? `${Number(r.gps_lat).toFixed(6)},${Number(r.gps_lng).toFixed(6)}` : ''

  const partes: { titulo: string; ok: boolean; detalle: string }[] = [
    { titulo: 'Ubicación', ok: Boolean(gps), detalle: gps ? `${gps}${Number(r?.gps_precision_m) === 0 ? ' (escrita a mano)' : r?.gps_precision_m ? ` (±${Math.round(Number(r.gps_precision_m))} m)` : ''}` : 'Falta' },
    { titulo: 'Fotos', ok: Boolean(fotos), detalle: fotos ? 'Las 4 fotos subidas' : 'Faltan' },
    { titulo: 'Croquis', ok: Boolean(croquis), detalle: croquis ? (datosCroquis ? 'Dibujo y medidas subidos' : 'Dibujo subido') : 'Falta' },
    { titulo: 'Entrevista', ok: contestadas >= preguntas.length, detalle: contestadas ? `${contestadas} de ${preguntas.length} respuestas` : 'Sin empezar' },
    { titulo: 'Lo que se ve', ok: marcados >= obligatorios.length, detalle: marcados ? `${marcados} de ${obligatorios.length} marcados` : 'Sin empezar' },
    { titulo: 'Terminado', ok: r?.estado === 'completo' || r?.estado === 'revisado', detalle: r?.estado === 'completo' || r?.estado === 'revisado' ? 'El relevador lo dio por terminado' : 'Todavía en curso' },
  ]

  const croquisFilas: [string, string][] = ([
    ['Frente', obs.croquis_frente_m ? `${texto(obs.croquis_frente_m)} m` : ''],
    ['Fondo', obs.croquis_fondo_m ? `${texto(obs.croquis_fondo_m)} m` : ''],
    ['Esquina más cercana', obs.croquis_distancia_esquina_m ? `${texto(obs.croquis_distancia_esquina_m)} m a la ${texto(obs.croquis_esquina) || '—'}` : ''],
    ['Calle del frente', texto(obs.croquis_calle_frente)],
    ['Calle de la derecha', texto(obs.croquis_calle_derecha)],
    ['Calle de la izquierda', texto(obs.croquis_calle_izquierda)],
    ['Calle del fondo', texto(obs.croquis_calle_fondo)],
    ['Referencia', [texto(obs.croquis_referencia), texto(obs.croquis_referencia_cuadras) || (texto(obs.croquis_referencia_lado) ? `(al ${texto(obs.croquis_referencia_lado)})` : '')].filter(Boolean).join(' ')],
  ] as [string, string][]).filter(([, v]) => v)

  return (
    <div className="grid gap-4">
      {r && (
        <p className="text-sm text-tenue">
          {r.estado === 'en_curso' ? 'En curso' : 'Terminado'} · empezado el {new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es-AR')}{r.relevador ? ` · ${r.relevador}` : ''}
        </p>
      )}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {partes.map((p) => (
          <li key={p.titulo} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${p.ok ? 'bg-ok' : 'bg-linea text-tenue'}`}>{p.ok ? '✓' : '·'}</span>
            <span><strong>{p.titulo}:</strong> {p.detalle}</span>
          </li>
        ))}
      </ul>
      {gps && (
        <a href={`https://www.google.com/maps?q=${gps}`} target="_blank" rel="noopener" className="w-fit text-sm font-semibold text-azul hover:underline">Ver la ubicación en el mapa →</a>
      )}
      {fotos && <MiniaturasPdf expedienteId={expedienteId} documentoId={fotos} titulo="Fotos del inmueble" rotulos={ROTULOS_FOTOS} />}
      {croquis && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
          <MiniaturasPdf expedienteId={expedienteId} documentoId={croquis} titulo="Croquis" grande />
          {croquisFilas.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {croquisFilas.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-tenue">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

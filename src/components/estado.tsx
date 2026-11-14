import { ESTADOS, TONOS, type EstadoExpediente } from '@/lib/textos'

export function EstadoChip({ estado }: { estado: string }) {
  const e = ESTADOS[estado as EstadoExpediente] ?? { texto: estado, tono: 'neutro' as const }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${TONOS[e.tono]}`}>
      {e.texto}
    </span>
  )
}

export function PasoPunto({ estado }: { estado: 'completo' | 'incompleto' | 'sin_empezar' }) {
  const clase = estado === 'completo' ? 'bg-ok' : estado === 'incompleto' ? 'bg-aviso' : 'bg-linea'
  const texto = estado === 'completo' ? 'Completo' : estado === 'incompleto' ? 'Incompleto' : 'Sin empezar'
  return <span title={texto} aria-label={texto} className={`inline-block size-3 rounded-full ${clase}`} />
}

import Link from 'next/link'

/**
 * Los 3 pasos del armado de un expediente, siempre a la vista y tocables para ir y volver:
 * 1 datos iniciales (titular, padrón, Catastro), 2 formularios llenos, 3 documentos para subir.
 */
export function PasosExpediente({ expedienteId, actual, primerFormulario = 'solicitud' }: {
  /** Sin expediente todavía (pantalla de apertura): los pasos 2 y 3 no se pueden tocar. */
  expedienteId?: string
  actual: 1 | 2 | 3
  primerFormulario?: string
}) {
  const pasos = [
    { n: 1, texto: 'Datos iniciales', href: expedienteId ? `/expedientes/${expedienteId}/datos-iniciales` : null },
    { n: 2, texto: 'Formularios', href: expedienteId ? `/expedientes/${expedienteId}/formularios/${primerFormulario}` : null },
    { n: 3, texto: 'Documentos', href: expedienteId ? `/expedientes/${expedienteId}` : null },
  ]
  return (
    <nav aria-label="Pasos del expediente">
      <ol className="flex flex-wrap items-center gap-2">
        {pasos.map((p, i) => {
          const contenido = (
            <>
              <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${p.n === actual ? 'bg-white text-azul' : p.n < actual ? 'bg-ok text-white' : 'bg-fondo text-tenue'}`}>
                {p.n < actual ? '✓' : p.n}
              </span>
              <span>Paso {p.n}: {p.texto}</span>
            </>
          )
          const clase = `flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
            p.n === actual ? 'border-azul bg-azul text-white' : 'border-linea bg-papel text-azul'
          }`
          return (
            <li key={p.n} className="flex items-center gap-2">
              {p.href && p.n !== actual ? (
                <Link href={p.href} className={`${clase} hover:border-azul`}>{contenido}</Link>
              ) : (
                <span className={clase} aria-current={p.n === actual ? 'step' : undefined}>{contenido}</span>
              )}
              {i < pasos.length - 1 && <span className="text-tenue" aria-hidden>→</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

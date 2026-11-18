'use client'

import { useEffect } from 'react'

/** Abre el diálogo de impresión apenas carga la constancia (como en el panel anterior). */
export function ImprimirAlAbrir({ automatico = true }: { automatico?: boolean }) {
  useEffect(() => {
    if (!automatico) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [automatico])
  return (
    <div className="no-imprimir" style={{ textAlign: 'center', margin: '16px 0' }}>
      <button type="button" onClick={() => window.print()} style={{ padding: '8px 18px', fontWeight: 700 }}>Imprimir</button>
    </div>
  )
}

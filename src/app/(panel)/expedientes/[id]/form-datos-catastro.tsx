'use client'

import { useActionState } from 'react'
import { guardarDatosCatastro } from '@/actions/expedientes'
import { CATASTRO_GIS } from '@/lib/catastro-enlaces'

const CAMPOS: [clave: string, etiqueta: string][] = [
  ['circ', 'Circunscripción'], ['secc', 'Sección'], ['mzna', 'Manzana'], ['parcela', 'Parcela'],
  ['matricula', 'Matrícula'], ['orden', 'Orden'], ['libro', 'Libro'], ['folio', 'Folio'],
  ['serie', 'Serie'], ['anio_dominio', 'Año'],
]

export function FormDatosCatastro({ expedienteId, editable, padron, padron2, catastrales }: {
  expedienteId: string
  editable: boolean
  padron: string | null
  padron2: string | null
  catastrales: Record<string, string>
}) {
  const [estado, accion, enviando] = useActionState(guardarDatosCatastro.bind(null, expedienteId), undefined)
  const v: Record<string, string> = { padron: padron ?? '', padron_2: padron2 ?? '', ...catastrales, ...(estado?.valores ?? {}) }

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg">Datos de Catastro</h2>
        <a href={CATASTRO_GIS} target="_blank" rel="noopener noreferrer" className="boton text-sm">Abrir Catastro ↗</a>
      </div>
      <p className="mt-1 text-sm text-tenue">
        Buscalos en Catastro con tu usuario (se abre en otra pestaña) y copialos acá. Van solos a la solicitud, a la declaración jurada y al relevamiento.
      </p>
      {!padron && <p className="mt-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm text-aviso">Falta el padrón: sin él Catastro no recibe el expediente.</p>}
      <form action={accion} className="mt-3 grid gap-3">
        <fieldset disabled={!editable} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1"><span className="text-sm font-semibold">Padrón</span><input name="padron" defaultValue={v.padron} inputMode="numeric" className="campo" /></label>
            <label className="grid gap-1"><span className="text-sm font-semibold">Repetí el padrón</span><input name="padron_confirmacion" defaultValue={estado?.valores?.padron_confirmacion ?? ''} inputMode="numeric" placeholder="Solo si lo cambiás" className="campo" /></label>
          </div>
          <p className="-mt-1 text-xs text-tenue">Catastro no deja corregir el padrón después de presentado: por eso se escribe dos veces.</p>
          <label className="grid gap-1"><span className="text-sm font-semibold">Segundo padrón (si tiene)</span><input name="padron_2" defaultValue={v.padron_2} inputMode="numeric" className="campo" /></label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CAMPOS.map(([k, et]) => (
              <label key={k} className="grid gap-1"><span className="text-sm font-semibold">{et}</span><input name={k} defaultValue={v[k] ?? ''} className="campo" /></label>
            ))}
          </div>
          <label className="grid gap-1"><span className="text-sm font-semibold">Antecedente de dominio</span><input name="antecedente_dominio" defaultValue={v.antecedente_dominio ?? ''} className="campo" /></label>
          {editable && <div><button disabled={enviando} className="boton">{enviando ? 'Guardando…' : 'Guardar datos de Catastro'}</button></div>}
        </fieldset>
        {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
        {estado?.ok && <p className={`text-sm ${estado.ok.includes('Ojo') ? 'text-aviso' : 'text-ok'}`}>{estado.ok}</p>}
      </form>
    </section>
  )
}

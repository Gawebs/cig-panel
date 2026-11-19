'use client'

import { useActionState, useRef, useState } from 'react'
import { guardarDatosCatastro } from '@/actions/expedientes'
import { CATASTRO_GIS } from '@/lib/catastro-enlaces'
import { CAMPOS_CATASTRALES_FORM, PegarCatastro } from '@/components/pegar-catastro'

export function FormDatosCatastro({ expedienteId, editable, padron, padron2, catastrales }: {
  expedienteId: string
  editable: boolean
  padron: string | null
  padron2: string | null
  catastrales: Record<string, string>
}) {
  const [estado, accion, enviando] = useActionState(guardarDatosCatastro.bind(null, expedienteId), undefined)
  const v: Record<string, string> = { padron: padron ?? '', padron_2: padron2 ?? '', ...catastrales, ...(estado?.valores ?? {}) }
  const formulario = useRef<HTMLFormElement>(null)
  const [llenados, setLlenados] = useState<Set<string>>(new Set())
  const marca = (clave: string) => (llenados.has(clave) ? ' ring-2 ring-ok' : '')

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg">Datos de Catastro</h2>
        {!editable && <a href={CATASTRO_GIS} target="_blank" rel="noopener noreferrer" className="boton text-sm">Abrir Catastro ↗</a>}
      </div>
      <p className="mt-1 text-sm text-tenue">Van solos a la solicitud, a la declaración jurada y al relevamiento.</p>
      {!padron && <p className="mt-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm text-aviso">Falta el padrón: sin él Catastro no recibe el expediente.</p>}

      {editable && (
        <div className="mt-3">
          <PegarCatastro formulario={formulario} alLlenar={(c) => setLlenados(new Set(c))} botonGuardar="Guardar datos de Catastro" />
        </div>
      )}

      <form ref={formulario} action={accion} className="mt-3 grid gap-3">
        <fieldset disabled={!editable} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1"><span className="text-sm font-semibold">Padrón</span><input name="padron" defaultValue={v.padron} inputMode="numeric" className={`campo${marca('padron')}`} /></label>
            <label className="grid gap-1"><span className="text-sm font-semibold">Repetí el padrón</span><input name="padron_confirmacion" defaultValue={estado?.valores?.padron_confirmacion ?? ''} inputMode="numeric" placeholder="Solo si lo cambiás" className="campo" /></label>
          </div>
          <p className="-mt-1 text-xs text-tenue">Catastro no deja corregir el padrón después de presentado: por eso se escribe dos veces.</p>
          <label className="grid gap-1"><span className="text-sm font-semibold">Segundo padrón (si tiene)</span><input name="padron_2" defaultValue={v.padron_2} inputMode="numeric" className="campo" /></label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CAMPOS_CATASTRALES_FORM.map(([k, et]) => (
              <label key={k} className="grid min-w-0 gap-1"><span className="truncate text-sm font-semibold" title={et}>{et}</span><input name={k} defaultValue={v[k] ?? ''} className={`campo${marca(k)}`} /></label>
            ))}
          </div>
          <label className="grid gap-1"><span className="text-sm font-semibold">Antecedente de dominio</span><input name="antecedente_dominio" defaultValue={v.antecedente_dominio ?? ''} className={`campo${marca('antecedente_dominio')}`} /></label>
          {editable && <div><button disabled={enviando} className="boton">{enviando ? 'Guardando…' : 'Guardar datos de Catastro'}</button></div>}
        </fieldset>
        {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
        {estado?.ok && <p className={`text-sm ${estado.ok.includes('Ojo') ? 'text-aviso' : 'text-ok'}`}>{estado.ok}</p>}
      </form>
    </section>
  )
}

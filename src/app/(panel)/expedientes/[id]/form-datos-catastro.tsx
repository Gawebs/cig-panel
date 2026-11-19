'use client'

import { useActionState, useRef, useState } from 'react'
import { guardarDatosCatastro } from '@/actions/expedientes'
import { CATASTRO_GIS } from '@/lib/catastro-enlaces'
import { ETIQUETAS_LECTURA, interpretarTextoCatastro, type ClaveLectura } from '@/lib/catastro-lectura'

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
  const formulario = useRef<HTMLFormElement>(null)
  const [pegado, setPegado] = useState('')
  const [lectura, setLectura] = useState<{ tipo: 'ok' | 'aviso' | 'error'; texto: string } | null>(null)
  const [llenados, setLlenados] = useState<Set<string>>(new Set())

  const poner = (nombre: string, valor: string) => {
    const campo = formulario.current?.elements.namedItem(nombre)
    if (campo instanceof HTMLInputElement) campo.value = valor
  }

  const alPegar = (texto: string) => {
    setPegado('')
    const datos = interpretarTextoCatastro(texto)
    const claves = Object.keys(datos) as ClaveLectura[]
    if (!claves.length) {
      setLectura({ tipo: 'error', texto: 'No se encontraron datos de Catastro en lo que pegaste. Copiá la pantalla "Datos Parcelarios Generales" o "Antecedentes de Dominio" entera (Ctrl+A y Ctrl+C).' })
      return
    }
    const actual = String((formulario.current?.elements.namedItem('padron') as HTMLInputElement | null)?.value ?? '').trim()
    let aviso = ''
    if (datos.padron && actual && datos.padron !== actual) {
      aviso = ` Ojo: lo que pegaste es del padrón ${datos.padron} y acá estaba el ${actual}. Revisá que sea el inmueble correcto antes de guardar.`
    }
    for (const k of claves) {
      poner(k, datos[k]!)
      // Lo pegado sale de Catastro tal cual: no hace falta escribir el padrón dos veces.
      if (k === 'padron') poner('padron_confirmacion', datos[k]!)
    }
    const todos = new Set([...llenados, ...claves])
    setLlenados(todos)
    const faltaParcelarios = !todos.has('circ') && !todos.has('parcela')
    const faltaDominio = !todos.has('antecedente_dominio')
    const otra = faltaDominio && !faltaParcelarios ? 'Ahora pegá "Antecedentes de Dominio".' : faltaParcelarios && !faltaDominio ? 'Ahora pegá "Datos Parcelarios Generales".' : ''
    setLectura({
      tipo: aviso ? 'aviso' : 'ok',
      texto: `Se llenó: ${claves.map((k) => ETIQUETAS_LECTURA[k]).join(', ')}.${aviso} ${otra} Revisá y tocá "Guardar datos de Catastro".`.replace(/\s+/g, ' ').trim(),
    })
  }

  const marca = (clave: string) => (llenados.has(clave) ? ' ring-2 ring-ok' : '')

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg">Datos de Catastro</h2>
        <a href={CATASTRO_GIS} target="_blank" rel="noopener noreferrer" className="boton text-sm">Abrir Catastro ↗</a>
      </div>
      <p className="mt-1 text-sm text-tenue">
        Entrá a Catastro con tu usuario (se abre en otra pestaña) y buscá el padrón en Consultas. Van solos a la solicitud, a la declaración jurada y al relevamiento.
      </p>
      {!padron && <p className="mt-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm text-aviso">Falta el padrón: sin él Catastro no recibe el expediente.</p>}

      {editable && (
        <div className="mt-3 grid gap-2 rounded-lg border border-dashed border-azul bg-papel p-3">
          <p className="text-sm font-semibold">Traer los datos copiando la pantalla de Catastro</p>
          <ol className="list-decimal pl-5 text-sm text-tenue">
            <li>En la pantalla <b>Datos Parcelarios Generales</b>, apretá <kbd>Ctrl</kbd>+<kbd>A</kbd> y después <kbd>Ctrl</kbd>+<kbd>C</kbd>.</li>
            <li>Volvé acá, hacé clic en el recuadro de abajo y apretá <kbd>Ctrl</kbd>+<kbd>V</kbd>.</li>
            <li>Hacé lo mismo con la pantalla <b>Antecedentes de Dominio</b>.</li>
          </ol>
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            onPaste={(e) => { e.preventDefault(); alPegar(e.clipboardData.getData('text')) }}
            onBlur={() => { if (pegado.trim()) alPegar(pegado) }}
            rows={2}
            placeholder="Pegá acá (Ctrl+V)"
            aria-label="Pegar la pantalla de Catastro"
            className="campo resize-none"
          />
          {lectura && (
            <p role="status" className={`text-sm ${lectura.tipo === 'error' ? 'text-error' : lectura.tipo === 'aviso' ? 'text-aviso' : 'text-ok'}`}>{lectura.texto}</p>
          )}
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
            {CAMPOS.map(([k, et]) => (
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

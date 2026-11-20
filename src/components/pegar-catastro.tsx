'use client'

import { useState, type RefObject } from 'react'
import { CATASTRO_GIS } from '@/lib/catastro-enlaces'
import { ETIQUETAS_LECTURA, interpretarTextoCatastro, type ClaveLectura } from '@/lib/catastro-lectura'

type Pantalla = 'parcelarios' | 'dominio'

/** Casilleros que salen de la pantalla "Datos Parcelarios Generales" de Catastro. */
export const CAMPOS_PARCELARIOS: [clave: string, etiqueta: string][] = [
  ['circ', 'Circunscripción'], ['secc', 'Sección'], ['mzna', 'Manzana'], ['parcela', 'Parcela'],
  ['matricula', 'Matrícula catastral'], ['orden', 'Orden catastral'],
]

/** Casilleros que salen de la pantalla "Antecedentes de Dominio" de Catastro. */
export const CAMPOS_DOMINIO: [clave: string, etiqueta: string][] = [
  ['libro', 'Libro'], ['folio', 'Folio'], ['serie', 'Serie'], ['anio_dominio', 'Año'],
]

const NOMBRE: Record<Pantalla, string> = { parcelarios: 'Datos Parcelarios Generales', dominio: 'Antecedentes de Dominio' }

/**
 * Recuadro para pegar lo copiado de una pantalla del Acceso GIS (Ctrl+A, Ctrl+C) y llenar los casilleros
 * del formulario que lo contiene. No guarda nada: la persona revisa y guarda con el botón del formulario.
 */
export function PegarCatastro({ formulario, pantalla, alLlenar }: {
  formulario: RefObject<HTMLFormElement | null>
  pantalla: Pantalla
  /** Avisa qué casilleros se llenaron, para marcarlos. */
  alLlenar?: (claves: string[]) => void
}) {
  const [pegado, setPegado] = useState('')
  const [lectura, setLectura] = useState<{ tipo: 'ok' | 'aviso' | 'error'; texto: string } | null>(null)

  const poner = (nombre: string, valor: string) => {
    const campo = formulario.current?.elements.namedItem(nombre)
    if (campo instanceof HTMLInputElement) campo.value = valor
  }

  const alPegar = (texto: string) => {
    setPegado('')
    const datos = interpretarTextoCatastro(texto)
    const claves = Object.keys(datos) as ClaveLectura[]
    if (!claves.some((k) => k !== 'padron')) {
      setLectura({ tipo: 'error', texto: `No se encontraron datos en lo que pegaste. Copiá la pantalla "${NOMBRE[pantalla]}" entera (Ctrl+A y Ctrl+C).` })
      return
    }
    const actual = String((formulario.current?.elements.namedItem('padron') as HTMLInputElement | null)?.value ?? '').trim()
    const aviso = datos.padron && actual && datos.padron !== actual
      ? ` Ojo: es del padrón ${datos.padron} y acá está el ${actual}. Revisá que sea el inmueble correcto.`
      : ''
    for (const k of claves) {
      poner(k, datos[k]!)
      // Lo pegado sale de Catastro tal cual: no hace falta escribir el padrón dos veces.
      if (k === 'padron') poner('padron_confirmacion', datos[k]!)
    }
    alLlenar?.(claves)
    setLectura({ tipo: aviso ? 'aviso' : 'ok', texto: `Listo: ${claves.map((k) => ETIQUETAS_LECTURA[k]).join(', ')}.${aviso}` })
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-azul bg-papel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">En Catastro, abrí <b>{NOMBRE[pantalla]}</b>, apretá <kbd>Ctrl</kbd>+<kbd>A</kbd> y <kbd>Ctrl</kbd>+<kbd>C</kbd>, y pegalo acá.</p>
        <a href={CATASTRO_GIS} target="_blank" rel="noopener noreferrer" className="boton min-h-9 text-sm">Abrir Catastro ↗</a>
      </div>
      <textarea
        value={pegado}
        onChange={(e) => setPegado(e.target.value)}
        onPaste={(e) => { e.preventDefault(); alPegar(e.clipboardData.getData('text')) }}
        onBlur={() => { if (pegado.trim()) alPegar(pegado) }}
        rows={1}
        placeholder={`Pegá acá ${NOMBRE[pantalla]} (Ctrl+V)`}
        aria-label={`Pegar la pantalla ${NOMBRE[pantalla]}`}
        className="campo resize-none"
      />
      {lectura && (
        <p role="status" className={`text-sm ${lectura.tipo === 'error' ? 'text-error' : lectura.tipo === 'aviso' ? 'text-aviso' : 'text-ok'}`}>{lectura.texto}</p>
      )}
    </div>
  )
}

/**
 * Los datos de Catastro en dos partes, una por pantalla del Acceso GIS, cada una con su recuadro para pegar.
 * Va dentro del formulario que guarda (los casilleros tienen el `name` del dato de la ficha).
 */
export function CamposCatastro({ formulario, valores, llenados, alLlenar, editable = true }: {
  formulario: RefObject<HTMLFormElement | null>
  valores: Record<string, string | undefined>
  llenados: Set<string>
  alLlenar: (claves: string[]) => void
  editable?: boolean
}) {
  const marca = (clave: string) => (llenados.has(clave) ? ' ring-2 ring-ok' : '')
  const casillero = ([k, et]: [string, string]) => (
    <label key={k} className="grid min-w-0 gap-1"><span className="truncate text-sm font-semibold" title={et}>{et}</span><input name={k} defaultValue={valores[k] ?? ''} className={`campo${marca(k)}`} /></label>
  )
  return (
    <>
      <div className="grid gap-3">
        <h3 className="text-base font-semibold">1. Datos Parcelarios Generales</h3>
        {editable && <PegarCatastro formulario={formulario} pantalla="parcelarios" alLlenar={alLlenar} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{CAMPOS_PARCELARIOS.map(casillero)}</div>
      </div>
      <div className="grid gap-3 border-t border-linea pt-4">
        <h3 className="text-base font-semibold">2. Antecedentes de Dominio</h3>
        {editable && <PegarCatastro formulario={formulario} pantalla="dominio" alLlenar={alLlenar} />}
        <label className="grid gap-1"><span className="text-sm font-semibold">Antecedente de dominio (matrícula)</span><input name="antecedente_dominio" defaultValue={valores.antecedente_dominio ?? ''} placeholder="Ej.: A-11846" className={`campo${marca('antecedente_dominio')}`} /></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CAMPOS_DOMINIO.map(casillero)}</div>
        <p className="-mt-1 text-xs text-tenue">Si en Catastro libro, folio y serie están vacíos, dejalos vacíos. El año no figura en esa pantalla: va solo si está en la escritura.</p>
      </div>
    </>
  )
}

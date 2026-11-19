'use client'

import { useState, type RefObject } from 'react'
import { CATASTRO_GIS } from '@/lib/catastro-enlaces'
import { ETIQUETAS_LECTURA, interpretarTextoCatastro, type ClaveLectura } from '@/lib/catastro-lectura'

/** Casilleros catastrales que se guardan en la ficha (además del padrón). */
export const CAMPOS_CATASTRALES_FORM: [clave: string, etiqueta: string][] = [
  ['circ', 'Circunscripción'], ['secc', 'Sección'], ['mzna', 'Manzana'], ['parcela', 'Parcela'],
  ['matricula', 'Matrícula'], ['orden', 'Orden'], ['libro', 'Libro'], ['folio', 'Folio'],
  ['serie', 'Serie'], ['anio_dominio', 'Año'],
]

/**
 * Recuadro para pegar lo copiado de las pantallas del Acceso GIS (Ctrl+A, Ctrl+C) y llenar los casilleros
 * del formulario que lo contiene. No guarda nada: la persona revisa y guarda con el botón del formulario.
 */
export function PegarCatastro({ formulario, alLlenar, botonGuardar }: {
  formulario: RefObject<HTMLFormElement | null>
  /** Avisa qué casilleros se llenaron, para marcarlos. */
  alLlenar?: (claves: string[]) => void
  /** Texto del botón con el que se guarda, para el mensaje. */
  botonGuardar: string
}) {
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
      aviso = ` Ojo: lo que pegaste es del padrón ${datos.padron} y acá estaba el ${actual}. Revisá que sea el inmueble correcto.`
    }
    for (const k of claves) {
      poner(k, datos[k]!)
      // Lo pegado sale de Catastro tal cual: no hace falta escribir el padrón dos veces.
      if (k === 'padron') poner('padron_confirmacion', datos[k]!)
    }
    const todos = new Set([...llenados, ...claves])
    setLlenados(todos)
    alLlenar?.([...todos])
    const faltaParcelarios = !todos.has('circ') && !todos.has('parcela')
    const faltaDominio = !todos.has('antecedente_dominio')
    const otra = faltaDominio && !faltaParcelarios ? 'Ahora pegá "Antecedentes de Dominio".' : faltaParcelarios && !faltaDominio ? 'Ahora pegá "Datos Parcelarios Generales".' : ''
    setLectura({
      tipo: aviso ? 'aviso' : 'ok',
      texto: `Se llenó: ${claves.map((k) => ETIQUETAS_LECTURA[k]).join(', ')}.${aviso} ${otra} Revisá y tocá "${botonGuardar}".`.replace(/\s+/g, ' ').trim(),
    })
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-azul bg-papel p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold">Traer los datos copiando la pantalla de Catastro</p>
        <a href={CATASTRO_GIS} target="_blank" rel="noopener noreferrer" className="boton min-h-9 text-sm">Abrir Catastro ↗</a>
      </div>
      <ol className="list-decimal pl-5 text-sm text-tenue">
        <li>Entrá a Catastro con tu usuario (se abre en otra pestaña) y buscá el padrón en Consultas.</li>
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
  )
}

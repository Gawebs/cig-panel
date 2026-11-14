'use client'

import { useState } from 'react'
import type { RelevamientoCampo } from '@/lib/campo/almacen'
import { GRUPOS, TEXTOS, valorObservacion, type Grupo } from '@/lib/relevamiento/observaciones'
import type { Actualizar } from './relevamiento'

export { observacionesCompletas } from '@/lib/relevamiento/observaciones'

/**
 * Lo que el relevador ve y marca (hojas 2 y 3 del relevamiento social).
 * Destino, servicios y mejoras se proponen solos con lo que dijo el vecino en la entrevista;
 * el relevador confirma o corrige tocando.
 */

export function Observaciones({ r, actualizar, siguiente }: { r: RelevamientoCampo; actualizar: Actualizar; siguiente: () => void }) {
  const marcar = (g: Grupo, valor: string) =>
    actualizar((x) => {
      const actual = valorObservacion(x, g).valor
      let nuevo: string | string[]
      if (g.varias) {
        const lista = Array.isArray(actual) ? actual : []
        nuevo = lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
      } else nuevo = valor
      return { ...x, observaciones: { ...x.observaciones, [g.clave]: nuevo } }
    })

  return (
    <section className="grid gap-3">
      <div className="tarjeta p-4">
        <h2 className="text-xl">Lo que se ve en el lugar</h2>
        <p className="text-sm text-tenue">Marcalo vos, mirando la casa. Lo que aparece con borde punteado salió de la entrevista: tocá para confirmar o corregir.</p>
      </div>

      {GRUPOS.map((g) => {
        const { valor, deEntrevista } = valorObservacion(r, g)
        const elegido = (v: string) => (Array.isArray(valor) ? valor.includes(v) : valor === v)
        const conDetalle = g.detalle && (g.varias || valor === 'otro' || (g.clave === 'signos_residencia' && valor === 'si'))
        return (
          <fieldset key={g.clave} className="tarjeta grid gap-2 p-3">
            <legend className="sr-only">{g.titulo}</legend>
            <p className="font-semibold">{g.titulo}{g.varias ? <span className="font-normal text-tenue"> (todas las que haya)</span> : null}</p>
            <div className="flex flex-wrap gap-2">
              {g.opciones.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={elegido(o.valor)}
                  onClick={() => marcar(g, o.valor)}
                  className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${
                    elegido(o.valor)
                      ? deEntrevista ? 'border-dashed border-azul bg-azul-suave text-azul' : 'border-azul bg-azul text-white'
                      : 'border-linea bg-papel'
                  }`}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>
            {conDetalle && (
              <CampoTexto
                valor={String(r.observaciones[g.detalle!] ?? '')}
                etiqueta={g.clave === 'signos_residencia' ? 'Cuáles (mobiliario, servicios activos, mejoras)' : g.clave === 'tipologia' ? 'Cuál' : 'Otros'}
                guardar={(t) => actualizar((x) => ({ ...x, observaciones: { ...x.observaciones, [g.detalle!]: t } }))}
              />
            )}
          </fieldset>
        )
      })}

      {TEXTOS.map((t) => (
        <div key={t.clave} className="tarjeta grid gap-1 p-3">
          <CampoTexto
            valor={String(r.observaciones[t.clave] ?? '')}
            etiqueta={t.titulo}
            ayuda={t.ayuda}
            largo
            guardar={(v) => actualizar((x) => ({ ...x, observaciones: { ...x.observaciones, [t.clave]: v } }))}
          />
        </div>
      ))}

      <button className="boton" onClick={siguiente}>Revisar y terminar</button>
    </section>
  )
}

function CampoTexto(props: { valor: string; etiqueta: string; ayuda?: string; largo?: boolean; guardar: (t: string) => void }) {
  const [texto, setTexto] = useState(props.valor)
  const comun = {
    value: texto,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTexto(e.target.value),
    onBlur: () => texto !== props.valor && props.guardar(texto.trim()),
    className: 'campo py-2',
    'aria-label': props.etiqueta,
  }
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">{props.etiqueta}</span>
      {props.ayuda && <span className="text-xs text-tenue">{props.ayuda}</span>}
      {props.largo ? <textarea rows={2} maxLength={1000} {...comun} /> : <input maxLength={200} {...comun} />}
    </label>
  )
}

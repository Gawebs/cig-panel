'use client'

import { useRef, useState } from 'react'
import { calcularCuil, extraerDomicilio, interpretarCodigoDni, type DatosDni } from '@/lib/dni'
import { leerCodigoDni, leerTexto } from '@/lib/escaneo'

export type LecturaDni = Partial<DatosDni> & { cuil?: string | null; domicilio?: string | null }

/**
 * Pide la foto del frente y del dorso del DNI.
 * Frente: lee el código de barras (nombre, DNI, sexo, nacimiento) y calcula el CUIL.
 * Dorso: lee el domicilio impreso. Todo se procesa en el equipo; las fotos no salen a ningún servicio.
 */
export function LectorDni({ onLectura, onFotos }: {
  onLectura: (datos: LecturaDni) => void
  onFotos: (fotos: { frente?: File; dorso?: File }) => void
}) {
  const [fotos, setFotos] = useState<{ frente?: File; dorso?: File }>({})
  const [estadoFrente, setEstadoFrente] = useState('')
  const [estadoDorso, setEstadoDorso] = useState('')
  const frente = useRef<HTMLInputElement>(null)
  const dorso = useRef<HTMLInputElement>(null)

  const guardarFoto = (lado: 'frente' | 'dorso', archivo: File) => {
    const nuevas = { ...fotos, [lado]: archivo }
    setFotos(nuevas)
    onFotos(nuevas)
  }

  const alElegirFrente = async (archivo?: File) => {
    if (!archivo) return
    guardarFoto('frente', archivo)
    setEstadoFrente('Leyendo el código de barras…')
    try {
      const texto = await leerCodigoDni(archivo)
      const datos = texto ? interpretarCodigoDni(texto) : null
      if (!datos) {
        setEstadoFrente('No se pudo leer el código. Probá otra foto: derecha, con luz y sin reflejo. La foto queda guardada igual.')
        return
      }
      const cuil = calcularCuil(datos.dni, datos.sexo)
      onLectura({ ...datos, cuil })
      setEstadoFrente(`Leído: ${datos.apellido}, ${datos.nombre} · DNI ${datos.dni}. CUIL calculado ${cuil}: confirmalo con la constancia.`)
    } catch {
      setEstadoFrente('No se pudo leer el código. La foto queda guardada igual.')
    }
  }

  const alElegirDorso = async (archivo?: File) => {
    if (!archivo) return
    guardarFoto('dorso', archivo)
    setEstadoDorso('Leyendo el domicilio… (la primera vez tarda un poco más)')
    try {
      const texto = await leerTexto(
        archivo,
        (p) => setEstadoDorso(`Leyendo el domicilio… ${p}%`),
        (t) => extraerDomicilio(t) !== null,
      )
      const domicilio = extraerDomicilio(texto)
      if (!domicilio) {
        setEstadoDorso('No se encontró el domicilio en la foto. Escribilo a mano.')
        return
      }
      onLectura({ domicilio })
      setEstadoDorso(`Domicilio leído: ${domicilio}. Revisalo: un error acá termina en una observación de Catastro.`)
    } catch {
      setEstadoDorso('No se pudo leer el dorso. Escribí el domicilio a mano.')
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-azul bg-papel p-3">
      <p className="text-sm font-semibold">Leer el DNI con la cámara</p>
      <div className="flex flex-wrap gap-2">
        <input ref={frente} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { alElegirFrente(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={dorso} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { alElegirDorso(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" onClick={() => frente.current?.click()} className="boton min-h-9 text-sm">
          {fotos.frente ? '✓ Frente (cambiar)' : 'Foto del frente'}
        </button>
        <button type="button" onClick={() => dorso.current?.click()} className="boton min-h-9 text-sm">
          {fotos.dorso ? '✓ Dorso (cambiar)' : 'Foto del dorso'}
        </button>
      </div>
      {estadoFrente && <p className="text-sm text-azul" aria-live="polite">{estadoFrente}</p>}
      {estadoDorso && <p className="text-sm text-azul" aria-live="polite">{estadoDorso}</p>}
      {(fotos.frente || fotos.dorso) && (
        <p className="text-xs text-tenue">Al guardar, las fotos quedan cargadas como el DNI de esta persona.</p>
      )}
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { calcularCuil, extraerDomicilio, interpretarCodigoDni, separarDomicilio, type DatosDni } from '@/lib/dni'
import { leerCodigoDni, leerCodigoEnCanvas, leerTexto } from '@/lib/escaneo'
import { CamaraGuiada, type Validacion } from '@/components/camara-guiada'

export type LecturaDni = Partial<DatosDni> & { cuil?: string | null; domicilio?: string | null; ciudad?: string | null }

const NO_LEIDO_FRENTE = 'No se pudo leer el código de barras. Acercá el DNI hasta que llene el recuadro, derecho y sin reflejo, y sacala de nuevo.'
const NO_LEIDO_DORSO = 'No se pudo leer el domicilio. Acercá el DNI hasta que llene el recuadro, con luz y sin reflejo, y sacala de nuevo.'

async function codigoEnVivo(canvas: HTMLCanvasElement): Promise<DatosDni | null> {
  const texto = await leerCodigoEnCanvas(canvas)
  return texto ? interpretarCodigoDni(texto) : null
}

async function validarFrente(foto: Blob): Promise<Validacion<DatosDni>> {
  const texto = await leerCodigoDni(foto)
  const datos = texto ? interpretarCodigoDni(texto) : null
  return datos ? { ok: true, datos } : { ok: false, motivo: NO_LEIDO_FRENTE }
}

async function validarDorso(foto: Blob, alAvanzar: (t: string) => void): Promise<Validacion<string>> {
  alAvanzar('Leyendo el domicilio… (la primera vez tarda un poco más)')
  const texto = await leerTexto(foto, (p) => alAvanzar(`Leyendo el domicilio… ${p}%`), (t) => extraerDomicilio(t) !== null)
  const domicilio = extraerDomicilio(texto)
  return domicilio ? { ok: true, datos: domicilio } : { ok: false, motivo: NO_LEIDO_DORSO }
}

const comoArchivo = (foto: Blob, nombre: string) => new File([foto], nombre, { type: foto.type || 'image/jpeg' })

/**
 * Saca la foto del frente y del dorso del DNI con la cámara guiada.
 * Frente: lee el código de barras (nombre, DNI, sexo, nacimiento) y calcula el CUIL.
 * Dorso: lee el domicilio impreso. Solo se guarda la foto que se pudo leer.
 * Todo se procesa en el equipo; las fotos no salen a ningún servicio.
 */
export function LectorDni({ onLectura, onFotos }: {
  onLectura: (datos: LecturaDni) => void
  onFotos: (fotos: { frente?: File; dorso?: File }) => void
}) {
  const [fotos, setFotos] = useState<{ frente?: File; dorso?: File }>({})
  const [estadoFrente, setEstadoFrente] = useState('')
  const [estadoDorso, setEstadoDorso] = useState('')
  const [camara, setCamara] = useState<'frente' | 'dorso' | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState('')

  // Ref para que frente y dorso subidos juntos no se pisen (el estado todavía no se actualizó).
  const fotosRef = useRef<{ frente?: File; dorso?: File }>({})
  const guardarFoto = (lado: 'frente' | 'dorso', archivo: File) => {
    const nuevas = { ...fotosRef.current, [lado]: archivo }
    fotosRef.current = nuevas
    setFotos(nuevas)
    onFotos(nuevas)
  }

  const alLeerFrente = (foto: Blob, datos: DatosDni | undefined) => {
    setCamara(null)
    if (!datos) return
    guardarFoto('frente', comoArchivo(foto, 'dni-frente.jpg'))
    const cuil = calcularCuil(datos.dni, datos.sexo)
    onLectura({ ...datos, cuil })
    setEstadoFrente(`Leído: ${datos.apellido}, ${datos.nombre} · DNI ${datos.dni}. CUIL calculado ${cuil}: confirmalo con la constancia.`)
  }

  const alLeerDorso = (foto: Blob, domicilio: string | undefined) => {
    setCamara(null)
    if (!domicilio) return
    guardarFoto('dorso', comoArchivo(foto, 'dni-dorso.jpg'))
    // Catastro pide solo calle y número en "Domicilio"; la localidad va en "Ciudad".
    const { calle, ciudad } = separarDomicilio(domicilio)
    onLectura({ domicilio: calle, ciudad })
    setEstadoDorso(`Domicilio leído: ${calle}${ciudad ? ` · Ciudad: ${ciudad}` : ''}. Revisalo: un error acá termina en una observación de Catastro.`)
  }

  /**
   * Fotos que ya están en la computadora (una o las dos juntas). Se leen igual que las de la cámara:
   * la que tiene el código de barras es el frente; si no, se prueba como dorso.
   */
  const desdeArchivos = async (archivos: File[]) => {
    if (!archivos.length) return
    setAviso('')
    const imagenes = archivos.filter((a) => a.type.startsWith('image/')).slice(0, 2)
    if (!imagenes.length) {
      setAviso('Elegí fotos (JPG o PNG). Un PDF no se puede leer acá.')
      return
    }
    setLeyendo(true)
    const sinLeer: string[] = []
    try {
      for (const archivo of imagenes) {
        setAviso(`Leyendo ${archivo.name}…`)
        try {
          const frente = await validarFrente(archivo)
          if (frente.ok) { alLeerFrente(archivo, frente.datos); continue }
          const dorso = await validarDorso(archivo, (t) => setAviso(`${archivo.name}: ${t}`))
          if (dorso.ok) { alLeerDorso(archivo, dorso.datos); continue }
          sinLeer.push(archivo.name)
        } catch {
          sinLeer.push(archivo.name)
        }
      }
      setAviso(sinLeer.length
        ? `No se pudo leer ${sinLeer.join(' ni ')}: ni el código de barras del frente ni el domicilio del dorso. Probá con una foto más nítida y derecha, o sacala con la cámara.`
        : '')
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-azul bg-papel p-3">
      <p className="text-sm font-semibold">Leer el DNI</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCamara('frente')} className="boton min-h-9 text-sm" disabled={leyendo}>
          {fotos.frente ? '✓ Frente (cambiar)' : 'Foto del frente'}
        </button>
        <button type="button" onClick={() => setCamara('dorso')} className="boton min-h-9 text-sm" disabled={leyendo}>
          {fotos.dorso ? '✓ Dorso (cambiar)' : 'Foto del dorso'}
        </button>
        <label
          className={`boton min-h-9 cursor-pointer text-sm ${leyendo ? 'pointer-events-none opacity-50' : ''}`}
          title="Elegí la foto del frente, la del dorso o las dos juntas"
        >
          {leyendo ? 'Leyendo…' : 'Subir desde la compu'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={leyendo}
            onChange={(e) => { const lista = Array.from(e.target.files ?? []); e.target.value = ''; desdeArchivos(lista) }}
          />
        </label>
      </div>
      {aviso && <p className="text-sm text-azul" aria-live="polite">{aviso}</p>}
      {estadoFrente && <p className="text-sm text-azul" aria-live="polite">{estadoFrente}</p>}
      {estadoDorso && <p className="text-sm text-azul" aria-live="polite">{estadoDorso}</p>}
      {(fotos.frente || fotos.dorso) && (
        <p className="text-xs text-tenue">Al guardar, las fotos quedan cargadas como el DNI de esta persona.</p>
      )}

      {camara === 'frente' && (
        <CamaraGuiada<DatosDni>
          titulo="DNI: frente"
          guia="Poné el frente del DNI dentro del recuadro, con el código de barras a la vista"
          tipo="documento"
          forma="dni"
          enVivo={codigoEnVivo}
          validar={validarFrente}
          alCapturar={alLeerFrente}
          alCerrar={() => setCamara(null)}
        />
      )}
      {camara === 'dorso' && (
        <CamaraGuiada<string>
          titulo="DNI: dorso"
          guia="Poné el dorso del DNI dentro del recuadro, derecho"
          tipo="documento"
          forma="dni"
          validar={validarDorso}
          alCapturar={alLeerDorso}
          alCerrar={() => setCamara(null)}
        />
      )}
    </div>
  )
}

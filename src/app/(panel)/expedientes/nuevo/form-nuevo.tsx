'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { abrirExpediente } from '@/actions/expedientes'
import { LectorDni, type LecturaDni } from '@/components/lector-dni'
import { subirDocumento } from '@/lib/subida'
import { ESTADOS_CIVILES } from '@/lib/textos'

export type LeyOpcion = { id: string; nombre: string; nombreCorto: string; usaNomina: boolean; pruebas: string }

export function FormNuevo({ leyes }: { leyes: LeyOpcion[] }) {
  const [ley, setLey] = useState<string>('')
  const [estado, accion, enviando] = useActionState(abrirExpediente, undefined)
  const elegida = leyes.find((l) => l.id === ley)
  const v = estado?.valores ?? {}
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const fotosDni = useRef<{ frente?: File; dorso?: File }>({})
  const [leido, setLeido] = useState({ cuil: '', sexo: '', fecha_nacimiento: '', domicilio: '' })
  const [origen, setOrigen] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')

  const alLeerDni = (d: LecturaDni) => {
    const form = formRef.current
    if (!form) return
    for (const [campo, valor] of [['apellido', d.apellido], ['nombre', d.nombre], ['dni', d.dni]] as const) {
      const el = form.elements.namedItem(campo) as HTMLInputElement | null
      if (el && valor) el.value = valor
    }
    setLeido((l) => ({
      cuil: d.cuil ?? l.cuil, sexo: d.sexo ?? l.sexo, fecha_nacimiento: d.fechaNacimiento ?? l.fecha_nacimiento, domicilio: d.domicilio ?? l.domicilio,
    }))
    setOrigen((o) => ({
      ...o,
      ...(d.dni ? { apellido: 'dni_frente', nombre: 'dni_frente', dni: 'dni_frente', sexo: 'dni_frente', fecha_nacimiento: 'dni_frente', cuil: 'cuil_calculado' } : {}),
      ...(d.domicilio ? { domicilio: 'dni_dorso' } : {}),
    }))
  }

  // Abierto el expediente: se suben las fotos del DNI del titular y se va a la ficha.
  useEffect(() => {
    if (!estado?.ok || !estado.id) return
    const [expedienteId, titularId, municipioId] = estado.id.split('|')
    const fotos = [fotosDni.current.frente, fotosDni.current.dorso].filter(Boolean) as File[]
    const ir = () => router.push(`/expedientes/${expedienteId}`)
    if (fotos.length === 0 || !titularId) return ir()
    setAviso('Cargando las fotos del DNI…')
    subirDocumento({ expedienteId, municipioId, paso: 1, requisito: 'dni', personaId: titularId, paginas: fotos })
      .then(ir)
      .catch(() => { setAviso('El expediente se abrió, pero no se pudieron cargar las fotos del DNI. Cargalas desde la ficha.'); setTimeout(ir, 2500) })
  }, [estado, router])

  return (
    <form ref={formRef} action={accion} className="grid gap-5">
      <input type="hidden" name="cuil" value={leido.cuil} />
      <input type="hidden" name="sexo" value={leido.sexo} />
      <input type="hidden" name="fecha_nacimiento" value={leido.fecha_nacimiento} />
      <input type="hidden" name="domicilio" value={leido.domicilio} />
      <input type="hidden" name="origen_datos" value={JSON.stringify(origen)} />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Ley</legend>
        {leyes.map((l) => (
          <label
            key={l.id}
            className={`tarjeta cursor-pointer p-4 transition-colors ${ley === l.id ? 'border-azul ring-2 ring-azul' : 'hover:border-azul'}`}
          >
            <input type="radio" name="ley" value={l.id} required checked={ley === l.id} onChange={() => setLey(l.id)} className="sr-only" />
            <span className="block font-titulo text-xl">{l.nombreCorto}</span>
            <span className="mt-1 block text-sm text-tenue">{l.nombre}</span>
          </label>
        ))}
      </fieldset>

      {elegida && (
        <>
          <p className="rounded-lg bg-azul-suave px-4 py-3 text-sm text-azul">
            <strong>Pruebas de posesión:</strong> {elegida.pruebas}
          </p>

          <section className="tarjeta grid gap-4 p-5">
            <h2 className="text-xl">Titular</h2>
            <LectorDni onLectura={alLeerDni} onFotos={(f) => { fotosDni.current = f }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Apellido</span><input id="apellido" name="apellido" defaultValue={v.apellido} required className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Nombre</span><input id="nombre" name="nombre" defaultValue={v.nombre} className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">DNI</span><input id="dni" name="dni" defaultValue={v.dni} inputMode="numeric" placeholder="Sin puntos" className="campo" /></label>
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">Estado civil</span>
                <select id="estado_civil" name="estado_civil" className="campo" defaultValue={v.estado_civil ?? ""}>
                  <option value="">Todavía no se sabe</option>
                  {ESTADOS_CIVILES.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="tarjeta grid gap-4 p-5">
            <h2 className="text-xl">Padrón</h2>
            <p className="-mt-2 text-sm text-tenue">
              {elegida.usaNomina
                ? 'En este barrio Catastro trabaja con una lista fija de padrones. Cuando tengamos la lista, se va a elegir de ahí.'
                : 'Catastro no deja corregir el padrón después de presentado: escribilo dos veces. Si todavía no se encontró, dejalo vacío.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Padrón</span><input id="padron" name="padron" defaultValue={v.padron} inputMode="numeric" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Repetí el padrón</span><input id="padron_confirmacion" name="padron_confirmacion" defaultValue={v.padron_confirmacion} inputMode="numeric" className="campo" /></label>
            </div>
          </section>

          {estado?.error && <p role="alert" className="rounded-md bg-error-suave px-4 py-3 text-error">{estado.error}</p>}
          {aviso && <p className="text-azul" aria-live="polite">{aviso}</p>}
          <div><button disabled={enviando} className="boton-principal">{enviando ? 'Abriendo…' : 'Abrir expediente'}</button></div>
        </>
      )}
    </form>
  )
}

'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { abrirExpediente, corregirDatosIniciales } from '@/actions/expedientes'
import { LectorDni, type LecturaDni } from '@/components/lector-dni'
import { CamposCatastro } from '@/components/pegar-catastro'
import { subirDocumento } from '@/lib/subida'
import { ESTADOS_CIVILES } from '@/lib/textos'

export type LeyOpcion = { id: string; nombre: string; nombreCorto: string; usaNomina: boolean; pruebas: string }

/** Para volver a esta pantalla con un expediente ya abierto y corregir lo cargado al principio. */
export type Edicion = { expedienteId: string; titularId: string; municipioId: string; ley: string; valores: Record<string, string> }

export function FormNuevo({ leyes, localidades = [], edicion }: { leyes: LeyOpcion[]; localidades?: { id: string; nombre: string }[]; edicion?: Edicion }) {
  const [ley, setLey] = useState<string>(edicion?.ley ?? '')
  const [estado, accion, enviando] = useActionState(
    edicion ? corregirDatosIniciales.bind(null, edicion.expedienteId, edicion.titularId) : abrirExpediente,
    undefined,
  )
  const elegida = leyes.find((l) => l.id === ley)
  const v = estado?.valores ?? edicion?.valores ?? {}
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const fotosDni = useRef<{ frente?: File; dorso?: File }>({})
  const [leido, setLeido] = useState({ cuil: v.cuil ?? '', sexo: v.sexo ?? '', fecha_nacimiento: v.fecha_nacimiento ?? '', domicilio: v.domicilio ?? '' })
  const [origen, setOrigen] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [llenados, setLlenados] = useState<Set<string>>(new Set())
  const [origenPosesion, setOrigenPosesion] = useState(v.origen_posesion ?? '')
  const [domicilioInmueble, setDomicilioInmueble] = useState(v.domicilio_inmueble ?? '')
  const marca = (clave: string) => (llenados.has(clave) ? ' ring-2 ring-ok' : '')

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
    const [expedienteId, titularId, municipioDeApertura] = estado.id.split('|')
    const municipioId = municipioDeApertura || edicion?.municipioId || ''
    const fotos = [fotosDni.current.frente, fotosDni.current.dorso].filter(Boolean) as File[]
    const ir = () => router.push(`/expedientes/${expedienteId}/formularios/solicitud`)
    if (fotos.length === 0 || !titularId) return ir()
    setAviso('Cargando las fotos del DNI…')
    subirDocumento({ expedienteId, municipioId, paso: 1, requisito: 'dni', personaId: titularId, paginas: fotos })
      .then(ir)
      .catch(() => { setAviso('El expediente se abrió, pero no se pudieron cargar las fotos del DNI. Cargalas desde la ficha.'); setTimeout(ir, 2500) })
  }, [estado, router, edicion])

  return (
    <form ref={formRef} action={accion} className="grid gap-5">
      <input type="hidden" name="sexo" value={leido.sexo} />
      <input type="hidden" name="fecha_nacimiento" value={leido.fecha_nacimiento} />
      <input type="hidden" name="origen_datos" value={JSON.stringify(origen)} />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Ley</legend>
        {leyes.filter((l) => !edicion || l.id === edicion.ley).map((l) => (
          <label
            key={l.id}
            className={`tarjeta cursor-pointer p-4 transition-colors ${ley === l.id ? 'border-azul ring-2 ring-azul' : 'hover:border-azul'}`}
          >
            <input type="radio" name="ley" value={l.id} required checked={ley === l.id} onChange={() => setLey(l.id)} disabled={Boolean(edicion)} className="sr-only" />
            <span className="block font-titulo text-xl">{l.nombreCorto}</span>
            <span className="mt-1 block text-sm text-tenue">{l.nombre}</span>
          </label>
        ))}
      </fieldset>
      {edicion && (
        <p className="-mt-2 text-sm text-tenue">La ley no se cambia después de abrir el expediente: de ella salen los formularios y los documentos. Si se eligió mal, marcá que el vecino desistió y abrí otro.</p>
      )}

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
              <label className="grid gap-1.5"><span className="text-sm font-semibold">CUIL</span><input id="cuil" name="cuil" value={leido.cuil} onChange={(e) => setLeido((l) => ({ ...l, cuil: e.target.value }))} inputMode="numeric" placeholder="20-12345678-3" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Teléfono</span><input id="telefono" name="telefono" defaultValue={v.telefono} inputMode="tel" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Correo</span><input id="correo" name="correo" type="email" defaultValue={v.correo} placeholder="nombre@gmail.com" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Domicilio</span><input id="domicilio" name="domicilio" value={leido.domicilio} onChange={(e) => setLeido((l) => ({ ...l, domicilio: e.target.value }))} className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Ciudad</span><input id="ciudad" name="ciudad" defaultValue={v.ciudad} className="campo" /></label>
            </div>
            <p className="-mt-1 text-sm text-tenue">Si escaneás el DNI, el CUIL y el domicilio se completan solos. Estos datos van a la solicitud de Catastro; el teléfono y el correo los pide el portal al presentar.</p>
          </section>

          <section className="tarjeta grid gap-4 p-5">
            <h2 className="text-xl">Padrón y datos de Catastro</h2>
            <p className="-mt-2 text-sm text-tenue">
              {elegida.usaNomina
                ? 'En este barrio Catastro trabaja con una lista fija de padrones. Copiá el padrón tal cual figura en esa lista.'
                : 'Catastro no deja corregir el padrón después de presentado: escribilo dos veces. Si todavía no se encontró, dejalo vacío.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Padrón</span><input id="padron" name="padron" defaultValue={v.padron} inputMode="numeric" className={`campo${marca('padron')}`} /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Repetí el padrón</span><input id="padron_confirmacion" name="padron_confirmacion" defaultValue={v.padron_confirmacion} inputMode="numeric" placeholder={edicion ? 'Solo si lo cambiás' : undefined} className="campo" /></label>
            </div>
            <CamposCatastro formulario={formRef} valores={v} llenados={llenados} alLlenar={(c) => setLlenados((p) => new Set([...p, ...c]))} />
          </section>

          <section className="tarjeta grid gap-4 p-5">
            <h2 className="text-xl">Inmueble y posesión</h2>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">Domicilio del inmueble</span>
              <input name="domicilio_inmueble" value={domicilioInmueble} onChange={(e) => setDomicilioInmueble(e.target.value)} placeholder="Calle y número, barrio" className="campo" />
            </label>
            {leido.domicilio && domicilioInmueble !== leido.domicilio && (
              <button type="button" onClick={() => setDomicilioInmueble(leido.domicilio)} className="-mt-2 justify-self-start text-sm font-semibold text-azul hover:underline">
                Es el mismo domicilio del DNI: {leido.domicilio}
              </button>
            )}
            {elegida.id === 'ley_pierri' && localidades.length > 0 && (
              <label className="grid gap-1.5 sm:max-w-sm">
                <span className="text-sm font-semibold">Localidad del inmueble</span>
                <select name="locality_id" defaultValue={v.locality_id ?? (localidades.length === 1 ? localidades[0].id : '')} className="campo">
                  <option value="">Elegí la localidad</option>
                  {localidades.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </label>
            )}
            {elegida.id === 'ley_5670' ? (
              <label className="grid gap-1.5 sm:max-w-sm">
                <span className="text-sm font-semibold">¿Tiene documentación del IPVDU?</span>
                <select name="tiene_documentacion_ipvdu" defaultValue={v.tiene_documentacion_ipvdu ?? ''} className="campo">
                  <option value="">Todavía no se sabe</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Cómo empezó a ocupar el inmueble</span>
                  <select name="origen_posesion" value={origenPosesion} onChange={(e) => setOrigenPosesion(e.target.value)} className="campo">
                    <option value="">Todavía no se sabe</option>
                    <option value="compra">Compra</option>
                    <option value="otro">Otro (herencia, cesión, ocupación…)</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Desde cuándo</span>
                  <input name="fecha_inicio_posesion" type="date" defaultValue={v.fecha_inicio_posesion} className="campo" />
                </label>
                {origenPosesion === 'otro' && (
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-sm font-semibold">Contá brevemente cómo fue</span>
                    <input name="origen_posesion_detalle" defaultValue={v.origen_posesion_detalle} placeholder="Ej.: herencia de los padres" className="campo" />
                  </label>
                )}
              </div>
            )}
          </section>

          {estado?.error && <p role="alert" className="rounded-md bg-error-suave px-4 py-3 text-error">{estado.error}</p>}
          {aviso && <p className="text-azul" aria-live="polite">{aviso}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={enviando} className="boton-principal">
              {edicion ? (enviando ? 'Guardando…' : 'Guardar y seguir al paso 2') : enviando ? 'Abriendo…' : 'Abrir expediente y seguir al paso 2'}
            </button>
            {edicion && <Link href={`/expedientes/${edicion.expedienteId}`} className="boton">Volver sin cambiar</Link>}
          </div>
        </>
      )}
    </form>
  )
}

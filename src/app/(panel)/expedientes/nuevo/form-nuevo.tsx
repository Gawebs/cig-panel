'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { abrirExpediente, corregirDatosIniciales } from '@/actions/expedientes'
import { LectorDni, type LecturaDni } from '@/components/lector-dni'
import { CamposCatastro } from '@/components/pegar-catastro'
import { BloqueConyuge } from './bloque-conyuge'
import { subirDocumento } from '@/lib/subida'
import { separarDomicilio } from '@/lib/dni'
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
  const fotosConyuge = useRef<{ frente?: File; dorso?: File }>({})
  const [estadoCivil, setEstadoCivil] = useState(v.estado_civil ?? '')
  const conPareja = estadoCivil === 'casado' || estadoCivil === 'conviviente'
  // Un domicilio cargado entero del DNI (con barrio, localidad y provincia) se separa: Catastro pide solo calle y número.
  const [leido, setLeido] = useState(() => {
    const separado = v.domicilio ? separarDomicilio(v.domicilio) : { calle: '', ciudad: null }
    return { cuil: v.cuil ?? '', sexo: v.sexo ?? '', fecha_nacimiento: v.fecha_nacimiento ?? '', domicilio: separado.calle, ciudad: v.ciudad || separado.ciudad || '' }
  })
  const [origen, setOrigen] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [llenados, setLlenados] = useState<Set<string>>(new Set())
  const [origenPosesion, setOrigenPosesion] = useState(v.origen_posesion ?? '')
  const [localidadElegida, setLocalidadElegida] = useState(v.locality_id ?? (localidades.length === 1 ? localidades[0].id : ''))
  const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
  const localidadDeCiudad = leido.ciudad ? localidades.find((l) => sinTildes(l.nombre) === sinTildes(leido.ciudad)) : undefined
  const marca = (clave: string) => (llenados.has(clave) ? ' ring-2 ring-ok' : '')

  const alLeerDni = (d: LecturaDni) => {
    const form = formRef.current
    if (!form) return
    for (const [campo, valor] of [['apellido', d.apellido], ['nombre', d.nombre], ['dni', d.dni]] as const) {
      const el = form.elements.namedItem(campo) as HTMLInputElement | null
      if (el && valor) el.value = valor
    }
    setLeido((l) => ({
      cuil: d.cuil ?? l.cuil, sexo: d.sexo ?? l.sexo, fecha_nacimiento: d.fechaNacimiento ?? l.fecha_nacimiento, domicilio: d.domicilio ?? l.domicilio, ciudad: d.ciudad ?? l.ciudad,
    }))
    setOrigen((o) => ({
      ...o,
      ...(d.dni ? { apellido: 'dni_frente', nombre: 'dni_frente', dni: 'dni_frente', sexo: 'dni_frente', fecha_nacimiento: 'dni_frente', cuil: 'cuil_calculado' } : {}),
      ...(d.domicilio ? { domicilio: 'dni_dorso' } : {}),
      ...(d.ciudad ? { ciudad: 'dni_dorso' } : {}),
    }))
  }

  // Guardado: se suben las fotos del DNI del titular y del cónyuge (cada una a su persona) y se sigue al paso 2.
  useEffect(() => {
    if (!estado?.ok || !estado.id) return
    const [expedienteId, titularId, municipioDeApertura, conyugeId] = estado.id.split('|')
    const municipioId = municipioDeApertura || edicion?.municipioId || ''
    const deTitular = [fotosDni.current.frente, fotosDni.current.dorso].filter(Boolean) as File[]
    const deConyuge = [fotosConyuge.current.frente, fotosConyuge.current.dorso].filter(Boolean) as File[]
    const subidas = [
      ...(deTitular.length && titularId ? [{ personaId: titularId, paginas: deTitular }] : []),
      ...(deConyuge.length && conyugeId ? [{ personaId: conyugeId, paginas: deConyuge }] : []),
    ]
    const ir = () => router.push(`/expedientes/${expedienteId}/formularios/solicitud`)
    if (subidas.length === 0) return ir()
    setAviso('Cargando las fotos del DNI…')
    Promise.all(subidas.map((s) => subirDocumento({ expedienteId, municipioId, paso: 1, requisito: 'dni', ...s })))
      .then(ir)
      .catch(() => { setAviso('Los datos se guardaron, pero no se pudieron cargar las fotos del DNI. Cargalas desde la ficha.'); setTimeout(ir, 2500) })
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
            <div>
              <h2 className="text-xl">Titular</h2>
              <p className="mt-1 text-sm text-tenue">Escaneá acá el DNI del titular. Si es casado o conviviente, el de la pareja se escanea más abajo, en su propio recuadro.</p>
            </div>
            <LectorDni onLectura={alLeerDni} onFotos={(f) => { fotosDni.current = f }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Apellido</span><input id="apellido" name="apellido" defaultValue={v.apellido} required className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Nombre</span><input id="nombre" name="nombre" defaultValue={v.nombre} className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">DNI</span><input id="dni" name="dni" defaultValue={v.dni} inputMode="numeric" placeholder="Ej.: 28.123.456" className="campo" /></label>
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">Estado civil</span>
                <select id="estado_civil" name="estado_civil" className="campo" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)}>
                  <option value="">Todavía no se sabe</option>
                  {ESTADOS_CIVILES.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">CUIL</span><input id="cuil" name="cuil" value={leido.cuil} onChange={(e) => setLeido((l) => ({ ...l, cuil: e.target.value }))} inputMode="numeric" placeholder="20-12345678-3" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Teléfono</span><input id="telefono" name="telefono" defaultValue={v.telefono} inputMode="tel" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Correo</span><input id="correo" name="correo" type="email" defaultValue={v.correo} placeholder="nombre@gmail.com" className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Domicilio (calle y número)</span><input id="domicilio" name="domicilio" value={leido.domicilio} onChange={(e) => setLeido((l) => ({ ...l, domicilio: e.target.value }))} className="campo" /></label>
              <label className="grid gap-1.5"><span className="text-sm font-semibold">Ciudad</span><input id="ciudad" name="ciudad" value={leido.ciudad} onChange={(e) => setLeido((l) => ({ ...l, ciudad: e.target.value }))} className="campo" /></label>
            </div>
            <p className="-mt-1 text-sm text-tenue">Si escaneás el DNI, el CUIL y el domicilio se completan solos. Estos datos van a la solicitud de Catastro; el teléfono y el correo los pide el portal al presentar.</p>
          </section>

          {conPareja && <BloqueConyuge valores={v} alFotos={(f) => { fotosConyuge.current = f }} />}

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
            {/* El inmueble es donde vive el titular: domicilio y localidad salen de los datos de arriba. */}
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">Domicilio del inmueble <span className="font-normal text-tenue">(el mismo del titular)</span></span>
              <input name="domicilio_inmueble" value={leido.domicilio} readOnly tabIndex={-1} placeholder="Se completa con el domicilio del titular" className="campo bg-papel text-tenue" />
            </label>
            {elegida.id === 'ley_pierri' && localidades.length > 0 && (
              <label className="grid gap-1.5 sm:max-w-sm">
                <span className="text-sm font-semibold">Localidad del inmueble</span>
                {localidadDeCiudad ? (
                  <>
                    <input type="hidden" name="locality_id" value={localidadDeCiudad.id} />
                    <input value={localidadDeCiudad.nombre} readOnly tabIndex={-1} className="campo bg-papel text-tenue" />
                  </>
                ) : (
                  <select name="locality_id" value={localidadElegida} onChange={(e) => setLocalidadElegida(e.target.value)} className="campo">
                    <option value="">Elegí la localidad</option>
                    {localidades.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                )}
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
                    <option value="" disabled hidden>Elegí una opción</option>
                    <option value="compra">Compra</option>
                    <option value="otro">Otro (herencia, cesión, ocupación…)</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Desde qué año</span>
                  <input name="anio_inicio_posesion" defaultValue={v.anio_inicio_posesion ?? v.fecha_inicio_posesion?.slice(0, 4)} inputMode="numeric" maxLength={4} placeholder="Ej.: 2005" className="campo sm:max-w-40" />
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

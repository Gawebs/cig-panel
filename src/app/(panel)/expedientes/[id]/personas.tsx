'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarPersona, quitarPersona } from '@/actions/expedientes'
import { LectorDni, type LecturaDni } from '@/components/lector-dni'
import { subirDocumento } from '@/lib/subida'
import { ESTADOS_CIVILES, ROLES_PERSONA } from '@/lib/textos'

export type PersonaFila = {
  id: string
  rol: 'solicitante' | 'conyuge' | 'grupo_familiar'
  solicitante_numero: number
  apellido: string
  nombre: string
  dni: string | null
  cuil: string | null
  telefono: string | null
  correo?: string | null
  domicilio: string | null
  ciudad: string | null
  estado_civil: string | null
  vinculo: string | null
  ocupacion: string | null
  sexo?: string | null
  fecha_nacimiento?: string | null
}

const VACIA: Omit<PersonaFila, 'id' | 'rol'> = {
  solicitante_numero: 1, apellido: '', nombre: '', dni: null, cuil: null, telefono: null, correo: null,
  domicilio: null, ciudad: null, estado_civil: null, vinculo: null, ocupacion: null,
}

function FormPersona({ expedienteId, municipioId, persona, onListo }: { expedienteId: string; municipioId: string; persona: Partial<PersonaFila> & { rol: PersonaFila['rol'] }; onListo: () => void }) {
  const [estado, accion, enviando] = useActionState(guardarPersona.bind(null, expedienteId), undefined)
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const fotosDni = useRef<{ frente?: File; dorso?: File }>({})
  const [origen, setOrigen] = useState<Record<string, string>>({})
  const [avisoFotos, setAvisoFotos] = useState('')
  // Datos que vienen del DNI y no tienen casillero visible: se guardan en estado (un input oculto
  // con defaultValue se reinicia en cada render).
  const [ocultos, setOcultos] = useState({ sexo: persona.sexo ?? '', fecha_nacimiento: persona.fecha_nacimiento ?? '' })

  // Completa el formulario con lo leído del DNI y anota de dónde salió cada dato.
  const alLeerDni = (d: LecturaDni) => {
    const form = formRef.current
    if (!form) return
    const poner = (campo: string, valor: string | null | undefined, fuente: string) => {
      if (valor && (campo === 'sexo' || campo === 'fecha_nacimiento')) {
        setOcultos((o) => ({ ...o, [campo]: valor }))
        setOrigen((o) => ({ ...o, [campo]: fuente }))
        return
      }
      const el = form.elements.namedItem(campo) as HTMLInputElement | null
      if (el && valor) {
        el.value = valor
        setOrigen((o) => ({ ...o, [campo]: fuente }))
      }
    }
    poner('apellido', d.apellido, 'dni_frente')
    poner('nombre', d.nombre, 'dni_frente')
    poner('dni', d.dni, 'dni_frente')
    poner('cuil', d.cuil, 'cuil_calculado')
    poner('sexo', d.sexo, 'dni_frente')
    poner('fecha_nacimiento', d.fechaNacimiento, 'dni_frente')
    poner('domicilio', d.domicilio, 'dni_dorso')
  }

  // Después de guardar a la persona, las fotos del DNI se cargan como su documento.
  useEffect(() => {
    const fotos = [fotosDni.current.frente, fotosDni.current.dorso].filter(Boolean) as File[]
    if (!estado?.id || fotos.length === 0) return
    fotosDni.current = {}
    subirDocumento({ expedienteId, municipioId, paso: 1, requisito: 'dni', personaId: estado.id, paginas: fotos })
      .then(() => { setAvisoFotos('Fotos del DNI cargadas.'); router.refresh() })
      .catch((e) => setAvisoFotos(e instanceof Error ? e.message : 'No se pudieron cargar las fotos del DNI.'))
  }, [estado, expedienteId, municipioId, router])
  // Si hubo un error, se muestran los valores que se habían escrito.
  const p = { ...VACIA, ...persona, ...((estado?.valores ?? {}) as Partial<PersonaFila>), rol: persona.rol, id: persona.id }
  const esSolicitante = p.rol === 'solicitante'
  const esFamiliar = p.rol === 'grupo_familiar'
  const clave = p.id ?? `nueva-${p.rol}`

  return (
    <form ref={formRef} action={accion} className="grid gap-3 rounded-lg border border-azul bg-azul-suave/40 p-4">
      <input type="hidden" name="id" value={p.id ?? ''} />
      <input type="hidden" name="rol" value={p.rol} />
      <input type="hidden" name="sexo" value={ocultos.sexo} />
      <input type="hidden" name="fecha_nacimiento" value={ocultos.fecha_nacimiento} />
      <input type="hidden" name="origen_datos" value={JSON.stringify(origen)} />
      <LectorDni onLectura={alLeerDni} onFotos={(f) => { fotosDni.current = f }} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1"><span className="text-sm font-semibold">Apellido</span><input id={`${clave}-apellido`} name="apellido" defaultValue={p.apellido} required className="campo" /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Nombre</span><input id={`${clave}-nombre`} name="nombre" defaultValue={p.nombre} className="campo" /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">DNI</span><input id={`${clave}-dni`} name="dni" defaultValue={p.dni ?? ''} inputMode="numeric" className="campo" /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">CUIL</span><input id={`${clave}-cuil`} name="cuil" defaultValue={p.cuil ?? ''} placeholder="20-12345678-3" className="campo" /></label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{esFamiliar ? 'Familiar de' : 'Solicitante número'}</span>
          <input id={`${clave}-sn`} name="solicitante_numero" type="number" min={1} max={10} defaultValue={p.solicitante_numero} className="campo" />
        </label>
        {!esFamiliar && <label className="grid gap-1"><span className="text-sm font-semibold">Teléfono</span><input id={`${clave}-tel`} name="telefono" defaultValue={p.telefono ?? ''} inputMode="tel" className="campo" /></label>}
        {!esFamiliar && <label className="grid gap-1"><span className="text-sm font-semibold">Correo</span><input id={`${clave}-correo`} name="correo" type="email" defaultValue={p.correo ?? ''} placeholder="nombre@gmail.com" className="campo" /></label>}
        {esSolicitante && (
          <>
            <label className="grid gap-1"><span className="text-sm font-semibold">Domicilio (del DNI)</span><input id={`${clave}-dom`} name="domicilio" defaultValue={p.domicilio ?? ''} className="campo" /></label>
            <label className="grid gap-1"><span className="text-sm font-semibold">Ciudad</span><input id={`${clave}-ciudad`} name="ciudad" defaultValue={p.ciudad ?? ''} className="campo" /></label>
            <label className="grid gap-1">
              <span className="text-sm font-semibold">Estado civil</span>
              <select id={`${clave}-ec`} name="estado_civil" defaultValue={p.estado_civil ?? ''} className="campo">
                <option value="">Todavía no se sabe</option>
                {ESTADOS_CIVILES.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
              </select>
            </label>
          </>
        )}
        {esFamiliar && (
          <>
            <label className="grid gap-1"><span className="text-sm font-semibold">Vínculo</span><input id={`${clave}-vinc`} name="vinculo" defaultValue={p.vinculo ?? ''} placeholder="Hijo, madre…" className="campo" /></label>
            <label className="grid gap-1"><span className="text-sm font-semibold">Ocupación</span><input id={`${clave}-ocup`} name="ocupacion" defaultValue={p.ocupacion ?? ''} className="campo" /></label>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={enviando} className="boton-principal">{enviando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" onClick={onListo} className="boton">Cerrar</button>
      </div>
      {estado?.error && <p role="alert" className="text-sm text-error">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-ok">{estado.ok}</p>}
      {avisoFotos && <p className="text-sm text-azul">{avisoFotos}</p>}
    </form>
  )
}

export function Personas({ expedienteId, municipioId, personas, editable, grupoFamiliar }: {
  expedienteId: string
  municipioId: string
  personas: PersonaFila[]
  editable: boolean
  grupoFamiliar: boolean
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const roles: PersonaFila['rol'][] = grupoFamiliar ? ['solicitante', 'conyuge', 'grupo_familiar'] : ['solicitante', 'conyuge']

  return (
    <section className="tarjeta p-5">
      <h2 className="text-xl">Personas del expediente</h2>
      <p className="text-sm text-tenue">Se cargan una sola vez y se usan en todos los formularios.</p>

      <ul className="mt-4 grid gap-3">
        {personas.map((p) => (
          <li key={p.id}>
            {editando === p.id ? (
              <FormPersona expedienteId={expedienteId} municipioId={municipioId} persona={p} onListo={() => setEditando(null)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linea px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.apellido}{p.nombre ? `, ${p.nombre}` : ''}</p>
                  <p className="text-sm text-tenue">
                    {ROLES_PERSONA[p.rol]}{p.rol === 'solicitante' ? ` ${p.solicitante_numero}` : ''}
                    {p.dni ? ` · DNI ${p.dni}` : ' · Sin DNI'}
                    {p.estado_civil ? ` · ${ESTADOS_CIVILES.find((e) => e.valor === p.estado_civil)?.texto}` : ''}
                    {p.vinculo ? ` · ${p.vinculo}` : ''}
                  </p>
                </div>
                {editable && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditando(p.id)} className="boton">Editar</button>
                    {!(p.rol === 'solicitante' && p.solicitante_numero === 1) && (
                      <button
                        type="button"
                        onClick={() => { if (confirm(`¿Quitar a ${p.apellido} del expediente?`)) quitarPersona(expedienteId, p.id) }}
                        className="boton text-error"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <div className="mt-4 grid gap-3">
          {editando?.startsWith('nueva-') ? (
            <FormPersona expedienteId={expedienteId} municipioId={municipioId} persona={{ rol: editando.slice(6) as PersonaFila['rol'] }} onListo={() => setEditando(null)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button key={r} type="button" onClick={() => setEditando(`nueva-${r}`)} className="boton">+ {ROLES_PERSONA[r]}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

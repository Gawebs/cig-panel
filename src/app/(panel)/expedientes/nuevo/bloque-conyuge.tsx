'use client'

import { useState } from 'react'
import { LectorDni, type LecturaDni } from '@/components/lector-dni'

/**
 * Cónyuge o conviviente del titular, en la pantalla de apertura. Tiene su propio lector de DNI:
 * lo que se lee acá es siempre del cónyuge, nunca del titular (no depende del orden de las fotos).
 * Los casilleros van con prefijo "c_" y se guardan como persona con rol cónyuge del solicitante 1.
 */
export function BloqueConyuge({ valores, alFotos }: {
  valores: Record<string, string | undefined>
  alFotos: (fotos: { frente?: File; dorso?: File }) => void
}) {
  const [d, setD] = useState({
    apellido: valores.c_apellido ?? '', nombre: valores.c_nombre ?? '', dni: valores.c_dni ?? '', cuil: valores.c_cuil ?? '',
    sexo: valores.c_sexo ?? '', fecha_nacimiento: valores.c_fecha_nacimiento ?? '',
  })
  const [origen, setOrigen] = useState<Record<string, string>>({})
  const cambiar = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }))

  const alLeer = (l: LecturaDni) => {
    setD((x) => ({
      apellido: l.apellido ?? x.apellido, nombre: l.nombre ?? x.nombre, dni: l.dni ?? x.dni, cuil: l.cuil ?? x.cuil,
      sexo: l.sexo ?? x.sexo, fecha_nacimiento: l.fechaNacimiento ?? x.fecha_nacimiento,
    }))
    if (l.dni) setOrigen((o) => ({ ...o, apellido: 'dni_frente', nombre: 'dni_frente', dni: 'dni_frente', sexo: 'dni_frente', fecha_nacimiento: 'dni_frente', cuil: 'cuil_calculado' }))
  }

  return (
    <section className="tarjeta grid gap-4 p-5">
      <div>
        <h2 className="text-xl">Cónyuge o conviviente</h2>
        <p className="mt-1 text-sm text-tenue">Escaneá acá el DNI del cónyuge o conviviente. El DNI del titular va arriba, en su recuadro.</p>
      </div>
      {valores.c_id && <input type="hidden" name="c_id" value={valores.c_id} />}
      <input type="hidden" name="c_sexo" value={d.sexo} />
      <input type="hidden" name="c_fecha_nacimiento" value={d.fecha_nacimiento} />
      <input type="hidden" name="c_origen_datos" value={JSON.stringify(origen)} />
      <LectorDni onLectura={alLeer} onFotos={alFotos} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5"><span className="text-sm font-semibold">Apellido</span><input name="c_apellido" value={d.apellido} onChange={cambiar('apellido')} className="campo" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-semibold">Nombre</span><input name="c_nombre" value={d.nombre} onChange={cambiar('nombre')} className="campo" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-semibold">DNI</span><input name="c_dni" value={d.dni} onChange={cambiar('dni')} inputMode="numeric" placeholder="Sin puntos" className="campo" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-semibold">CUIL</span><input name="c_cuil" value={d.cuil} onChange={cambiar('cuil')} inputMode="numeric" placeholder="27-12345678-3" className="campo" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-semibold">Teléfono</span><input name="c_telefono" defaultValue={valores.c_telefono} inputMode="tel" className="campo" /></label>
      </div>
    </section>
  )
}

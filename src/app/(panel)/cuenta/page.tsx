import { obtenerContexto } from '@/lib/sesion'
import { ROLES } from '@/lib/textos'
import { FormClave } from './form-clave'
import { FormClavePerfil } from './form-clave-perfil'

export default async function MiCuenta() {
  const ctx = await obtenerContexto()
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-3xl">Mi cuenta</h1>
      <div className="tarjeta grid gap-1 p-5 text-sm">
        <p><span className="etiqueta">Nombre</span><br />{ctx.nombre}</p>
        <p><span className="etiqueta">Correo</span><br />{ctx.email}</p>
        <p><span className="etiqueta">Municipio y roles</span><br />{ctx.municipio?.nombre} · {ctx.roles.map((r) => ROLES[r]).join(', ')}</p>
      </div>
      {/^[a-z0-9-]+@cig-brs\.local$/.test(ctx.email) ? <FormClavePerfil perfil={ctx.email.split('@')[0]} /> : <FormClave />}
    </div>
  )
}

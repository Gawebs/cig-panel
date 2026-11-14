import Link from 'next/link'
import { elegirMunicipio, salir } from '@/actions/sesion'
import { obtenerContexto } from '@/lib/sesion'
import { ROLES } from '@/lib/textos'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContexto()

  if (!ctx.municipio) {
    return (
      <main className="mx-auto grid max-w-lg flex-1 content-center gap-4 px-4 py-10">
        <h1 className="text-2xl">Tu usuario no tiene un municipio asignado</h1>
        <p className="text-tenue">
          {ctx.esSoporte
            ? 'Sos parte del equipo de soporte. La pantalla para configurar municipios llega en una próxima etapa.'
            : 'Pedile a la dirección del área que te dé acceso.'}
        </p>
        <form action={salir}><button className="boton">Salir</button></form>
      </main>
    )
  }

  const color = ctx.municipio.color_principal
  return (
    <div className="flex flex-1 flex-col" style={color ? ({ '--marca': color } as React.CSSProperties) : undefined}>
      <header className="degrade text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-white/15 text-lg font-bold">{ctx.municipio.sigla}</span>
            <span>
              <span className="block text-xs uppercase tracking-wider opacity-85">Regularización dominial</span>
              <span className="block font-titulo text-lg leading-tight">{ctx.municipio.nombre}</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/" className="rounded-md px-3 py-2 hover:bg-white/15">Inicio</Link>
            <Link href="/expedientes" className="rounded-md px-3 py-2 hover:bg-white/15">Expedientes</Link>
            <Link href="/tablero" className="rounded-md px-3 py-2 hover:bg-white/15">Tablero</Link>
            <Link href="/constancias" className="rounded-md px-3 py-2 hover:bg-white/15">Constancias</Link>
            {ctx.roles.some((r) => ['relevamiento', 'armado', 'subdireccion', 'direccion'].includes(r)) && (
              <a href="/campo" className="rounded-md px-3 py-2 hover:bg-white/15">Relevamiento</a>
            )}
            {ctx.municipios.length > 1 && (
              <form action={elegirMunicipio} className="flex items-center gap-1">
                <select name="municipio" defaultValue={ctx.municipio.id} aria-label="Municipio" className="rounded-md bg-white/15 px-2 py-2 text-white">
                  {ctx.municipios.map((m) => <option key={m.id} value={m.id} className="text-tinta">{m.nombre}</option>)}
                </select>
                <button className="rounded-md px-2 py-2 hover:bg-white/15">Cambiar</button>
              </form>
            )}
            <Link href="/cuenta" className="hidden rounded-md px-2 py-2 opacity-85 hover:bg-white/15 sm:inline" title="Mi cuenta">
              {ctx.nombre} · {ctx.roles.map((r) => ROLES[r]).join(', ')}
            </Link>
            <form action={salir}><button className="rounded-md px-3 py-2 hover:bg-white/15">Salir</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}

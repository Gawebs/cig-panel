import { FormIngreso } from './form-ingreso'

export const metadata = { title: 'Ingresar · CIG Regularización Dominial' }

export default function PaginaIngreso() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-linea bg-papel shadow-sm">
        <div className="degrade px-6 py-7 text-white">
          <p className="text-sm uppercase tracking-wider opacity-85">Regularización dominial</p>
          <h1 className="mt-1 text-3xl">CIG</h1>
          <p className="mt-2 text-sm opacity-90">Expedientes de escrituración social ante Catastro de Tucumán</p>
        </div>
        <FormIngreso />
      </div>
    </main>
  )
}

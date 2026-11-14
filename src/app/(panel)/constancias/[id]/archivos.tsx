'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { borrarConstancia, enlaceArchivoConstancia, quitarArchivoConstancia, registrarArchivoConstancia } from '@/actions/constancias'
import { unirEnPdf } from '@/lib/escaneo'
import { createClient } from '@/lib/supabase/client'

export function ArchivosConstancia(props: {
  id: string
  municipioId: string
  archivos: { id: string; nombre_archivo: string | null; paginas: number | null }[]
  editable: boolean
}) {
  const router = useRouter()
  const [paginas, setPaginas] = useState<File[]>([])
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [, startTransition] = useTransition()
  const camara = useRef<HTMLInputElement>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const agregar = (lista: FileList | null) => {
    if (!lista?.length) return
    const nuevas = Array.from(lista)
    setPaginas((p) => [...p, ...nuevas])
  }

  const subir = async () => {
    setSubiendo(true)
    setError('')
    try {
      const { bytes, paginas: n } = await unirEnPdf(paginas)
      const nombre = `constancia-${crypto.randomUUID().slice(0, 8)}.pdf`
      const ruta = `${props.municipioId}/${props.id}/${nombre}`
      const { error: e } = await createClient().storage.from('constancias').upload(ruta, new Blob([bytes as BlobPart], { type: 'application/pdf' }), { contentType: 'application/pdf' })
      if (e) throw new Error(`No se pudo subir: ${e.message}`)
      const r = await registrarArchivoConstancia(props.id, { ruta, nombre: paginas[0]?.name ?? nombre, tamano: bytes.byteLength, paginas: n })
      if (r.error) throw new Error(r.error)
      setPaginas([])
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <section className="tarjeta grid gap-3 p-5">
      <h2 className="text-lg">Archivos</h2>
      <p className="text-sm text-tenue">La constancia firmada escaneada y la documentación del vecino. Se guardan privados, como PDF.</p>
      {props.archivos.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {props.archivos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-azul hover:underline"
                onClick={async () => {
                  const v = window.open('', '_blank')
                  const { url } = await enlaceArchivoConstancia(props.id, a.id)
                  if (url && v) v.location.href = url
                  else v?.close()
                }}
              >
                {a.nombre_archivo ?? 'Archivo'} ({a.paginas ?? 1} pág.)
              </button>
              {props.editable && (
                <button
                  type="button"
                  className="text-tenue hover:text-error"
                  onClick={async () => {
                    if (!confirm('¿Quitar este archivo?')) return
                    const r = await quitarArchivoConstancia(props.id, a.id)
                    if (r.error) setError(r.error)
                    else startTransition(() => router.refresh())
                  }}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-tenue">Sin archivos.</p>}

      {props.editable && (
        <div className="grid gap-2">
          {paginas.length > 0 && <p className="text-sm text-azul">{paginas.length} página(s) lista(s) para unir en un PDF.</p>}
          <div className="flex flex-wrap gap-2">
            <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
            <input ref={archivo} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
            <button type="button" className="boton min-h-9 text-sm" onClick={() => camara.current?.click()}>{paginas.length ? '+ Otra foto' : 'Sacar foto'}</button>
            <button type="button" className="boton min-h-9 text-sm" onClick={() => archivo.current?.click()}>Elegir archivo</button>
            {paginas.length > 0 && (
              <>
                <button type="button" className="boton-principal min-h-9 text-sm" disabled={subiendo} onClick={subir}>{subiendo ? 'Subiendo…' : 'Guardar'}</button>
                <button type="button" className="boton min-h-9 text-sm" disabled={subiendo} onClick={() => setPaginas([])}>Descartar</button>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </section>
  )
}

export function BorrarConstancia({ id }: { id: string }) {
  const [error, setError] = useState('')
  return (
    <div className="grid gap-1">
      <button
        type="button"
        className="boton text-error"
        onClick={async () => {
          if (!confirm('¿Borrar esta constancia y sus archivos? No se puede deshacer.')) return
          const r = await borrarConstancia(id)
          if (r?.error) setError(r.error)
        }}
      >
        Borrar constancia
      </button>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  )
}

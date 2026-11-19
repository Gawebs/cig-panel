import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EstadoChip, PasoPunto } from '@/components/estado'
import { armarChecklist, tiposDePrueba, type MarcoConfig, type PersonaExpediente } from '@/lib/requisitos'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ACCIONES, ESTADOS, ROLES_PERSONA, type EstadoExpediente } from '@/lib/textos'
import { CargaDocumento } from '@/components/carga-documento'
import { DescargaPaso } from '@/components/descarga-paso'
import { AccionEstado } from './accion-estado'
import { datosFaltantes, type DondeSeCarga, type ExpedienteDatos, type PersonaDatos } from '@/lib/datos-obligatorios'
import { FormDatosCatastro } from './form-datos-catastro'
import { FormInmueble } from './form-inmueble'
import { completarBarrioDeLaLey } from '@/lib/barrio-ley'
import { Personas, type PersonaFila } from './personas'
import { SeccionCatastro, type Observacion } from './catastro'

// Requisito del checklist → formulario que se imprime para firmar
const FORMULARIO_DE: Record<string, string> = {
  formulario_solicitud: 'solicitud',
  anexo_i: 'anexo_i',
  ddjj: 'ddjj',
  relevamiento_social: 'relevamiento_social',
}

const EDITABLES: EstadoExpediente[] =['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

export default async function FichaExpediente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await obtenerContexto()
  const supabase = await createClient()

  const { data: leido } = await supabase
    .from('case_files')
    .select('*, legal_frameworks(nombre, nombre_corto, valor_catastro, config)')
    .eq('id', id)
    .maybeSingle()
  // La Milagrosa y Menem son de un solo barrio: si quedó vacío, se pone solo (con su localidad).
  const barrioPuesto = leido ? await completarBarrioDeLaLey(supabase, leido) : null
  const exp = leido && barrioPuesto ? { ...leido, ...barrioPuesto } : leido
  if (!exp) notFound()

  const [{ data: personasSinOrden }, { data: documentos }, { data: eventos }, { data: barrios }, { data: relevamiento }] = await Promise.all([
    supabase.from('case_people').select('*').eq('case_file_id', id).order('rol').order('solicitante_numero').order('orden'),
    supabase.from('case_documents').select('id, paso, requisito, person_id, anio, firmado, nombre_archivo, paginas, tipo_prueba, created_at').eq('case_file_id', id).order('created_at'),
    supabase.from('case_events').select('id, tipo, de_estado, a_estado, nota, created_at, profiles(nombre)').eq('case_file_id', id).order('created_at', { ascending: false }),
    supabase.from('neighborhoods').select('id, nombre').eq('municipality_id', exp.municipality_id).order('nombre'),
    supabase.from('field_surveys').select('estado, fecha, respuestas').eq('case_file_id', id).maybeSingle(),
  ])
  const { data: observaciones } = await supabase
    .from('catastro_observations')
    .select('id, recibida_el, texto, vence_el, prorroga_hasta, estado, respondida_el, plazo_dias, plazo_tipo')
    .eq('case_file_id', id)
    .order('recibida_el', { ascending: false })
  const { data: localidades } = await supabase.from('localities').select('id, nombre').eq('municipality_id', exp.municipality_id).order('nombre')
  const respuestasRel = Object.values((relevamiento?.respuestas ?? {}) as Record<string, { texto: string; origen: string; revisado?: boolean }>)
  const porRevisar = respuestasRel.filter((r) => r.origen === 'voz' && !r.revisado).length

  const ORDEN_ROL = { solicitante: 0, conyuge: 1, grupo_familiar: 2 } as const
  const personas = [...(personasSinOrden ?? [])].sort(
    (a, b) =>
      a.solicitante_numero - b.solicitante_numero ||
      ORDEN_ROL[a.rol as keyof typeof ORDEN_ROL] - ORDEN_ROL[b.rol as keyof typeof ORDEN_ROL] ||
      a.orden - b.orden,
  )

  const ley = exp.legal_frameworks as unknown as { nombre: string; nombre_corto: string; valor_catastro: string; config: MarcoConfig }
  const estado = exp.estado as EstadoExpediente
  const editable = EDITABLES.includes(estado) && ctx.roles.some((r) => ['armado', 'subdireccion', 'direccion', 'relevamiento'].includes(r))

  const checklist = armarChecklist({
    config: ley.config,
    personas: (personas ?? []) as PersonaExpediente[],
    documentos: documentos ?? [],
    fechaApertura: new Date(`${exp.fecha_apertura}T12:00:00`),
    coordenadas: exp.coordenadas,
  })

  const faltanDatos = datosFaltantes(exp as unknown as ExpedienteDatos, (personas ?? []) as unknown as PersonaDatos[])
  const IR_A: Record<DondeSeCarga, { href: string; texto: string }> = {
    personas: { href: '#personas', texto: 'Ir a Personas' },
    catastro: { href: '#datos-catastro', texto: 'Ir a Datos de Catastro' },
    inmueble: { href: '#inmueble', texto: 'Ir a Inmueble' },
    ddjj: { href: `/expedientes/${id}/formularios/ddjj`, texto: 'Abrir la declaración jurada' },
  }

  const acciones = ACCIONES.filter((a) => a.desde.includes(estado) && a.roles.some((r) => ctx.roles.includes(r)))
  const ultimaDevolucion = (eventos ?? []).find((e) => e.a_estado === 'devuelto')

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/expedientes" className="text-sm text-azul hover:underline">← Expedientes</Link>
          <h1 className="mt-1 text-3xl tabular-nums">{exp.numero_interno}</h1>
          <p className="text-tenue">{ley.nombre}</p>
        </div>
        <div className="grid justify-items-end gap-2">
          <EstadoChip estado={estado} />
          <span className="text-sm text-tenue">Abierto el {new Date(`${exp.fecha_apertura}T12:00:00`).toLocaleDateString('es-AR')}</span>
        </div>
      </div>

      {estado === 'devuelto' && ultimaDevolucion?.nota && (
        <div role="alert" className="rounded-xl border border-error bg-error-suave px-5 py-4 text-error">
          <strong>Devuelto para corregir:</strong> {ultimaDevolucion.nota}
        </div>
      )}

      {estado === 'listo_para_revisar' && ctx.roles.some((r) => r === 'subdireccion' || r === 'direccion') && (() => {
        const impresos = (exp.formularios_impresos ?? {}) as Record<string, unknown>
        const formulariosPaso1 = ley.config.formularios.filter((f) => f.paso === 1 && (f.clave !== 'anexo_i' || (personas ?? []).filter((p) => p.rol === 'solicitante').length > 2))
        const puntos: { ok: boolean; texto: string }[] = [
          { ok: checklist.faltantes.length === 0, texto: checklist.faltantes.length ? `Faltan ${checklist.faltantes.length} documento(s) del checklist` : 'Todos los documentos del checklist están cargados' },
          { ok: faltanDatos.length === 0, texto: faltanDatos.length ? `Faltan ${faltanDatos.length} dato(s) obligatorio(s): ${faltanDatos.map((f) => f.texto).join('; ')}` : 'Todos los datos obligatorios están cargados' },
          { ok: checklist.avisos.length === 0, texto: checklist.avisos.length ? `${checklist.avisos.length} aviso(s) sobre los datos: ${checklist.avisos.join(' ')}` : 'Sin avisos sobre los datos de las personas' },
          ...formulariosPaso1.map((f) => ({ ok: Boolean(impresos[f.clave]), texto: impresos[f.clave] ? `${f.titulo}: impreso para firmar` : `${f.titulo}: todavía no se imprimió desde el sistema` })),
          { ok: Boolean(relevamiento), texto: relevamiento ? 'Relevamiento en el lugar hecho' : 'Falta el relevamiento en el lugar' },
          ...(porRevisar > 0 ? [{ ok: false, texto: `${porRevisar} respuesta(s) grabada(s) del relevamiento sin revisar` }] : []),
        ]
        return (
          <section className="tarjeta p-4">
            <h2 className="text-lg">Antes de aprobar</h2>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {puntos.map((p) => (
                <li key={p.texto} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${p.ok ? 'bg-ok' : 'bg-aviso'}`}>{p.ok ? '✓' : '!'}</span>
                  {p.texto}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-tenue">Revisá los PDF de cada paso con el botón “PDF del paso”. Si algo está mal, devolvelo con una nota que diga qué corregir.</p>
          </section>
        )
      })()}

      {editable && faltanDatos.length > 0 && (
        <section className="rounded-xl border border-aviso bg-aviso-suave px-5 py-4">
          <h2 className="text-lg text-aviso">Faltan {faltanDatos.length} dato(s) que Catastro necesita</h2>
          <p className="text-sm text-tenue">Sin estos datos los formularios salen incompletos. Cargalos antes de imprimir.</p>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {faltanDatos.map((f) => (
              <li key={f.texto} className="flex flex-wrap items-baseline gap-x-2">
                <span>• {f.texto}</span>
                <a href={IR_A[f.donde].href} className="font-semibold text-azul hover:underline">{IR_A[f.donde].texto} →</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {acciones.length > 0 && (
        <section className="tarjeta flex flex-wrap items-start gap-3 p-4">
          {acciones.map((a) => (
            <AccionEstado
              key={a.hacia}
              expedienteId={id}
              hacia={a.hacia}
              texto={a.texto}
              pideNota={a.pideNota}
              principal={a.principal}
              aviso={a.hacia === 'listo_para_revisar' && (!checklist.completo || faltanDatos.length) ? `Todavía faltan ${[checklist.faltantes.length ? `${checklist.faltantes.length} documento(s)` : '', faltanDatos.length ? `${faltanDatos.length} dato(s)` : ''].filter(Boolean).join(' y ')}. Podés enviarlo igual, pero en la revisión va a figurar incompleto.` : undefined}
            />
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 gap-6">
          {/* Los 4 pasos de Catastro */}
          <section className="tarjeta overflow-hidden">
            <div className="degrade px-5 py-4 text-white">
              <h2 className="text-xl">Lo que pide Catastro</h2>
              <p className="text-sm opacity-90">Los mismos 4 pasos del portal, con lo que corresponde a esta ley y a este grupo familiar.</p>
            </div>
            {checklist.avisos.length > 0 && (
              <ul className="grid gap-1 border-b border-linea bg-aviso-suave px-5 py-3 text-sm text-aviso">
                {checklist.avisos.map((a) => <li key={a}>• {a}</li>)}
              </ul>
            )}
            <ol className="divide-y divide-linea">
              {checklist.pasos.map((p) => (
                <li key={p.paso} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-lg">
                      <PasoPunto estado={p.estado} />
                      Paso {p.paso}: {p.titulo}
                    </h3>
                    <span className="text-sm tabular-nums text-tenue">{p.completos} de {p.total}</span>
                  </div>
                  <DescargaPaso
                    expedienteId={id}
                    numeroInterno={exp.numero_interno}
                    paso={p.paso}
                    completo={p.estado === 'completo'}
                    hojaCoordenadas={p.items.find((i) => i.deFicha)?.deFicha}
                    documentos={p.items.flatMap((i) =>
                      (documentos ?? [])
                        .filter((d) => d.requisito === i.requisito && (i.personaId ? d.person_id === i.personaId : true) && (i.anio ? d.anio === i.anio : true))
                        .map((d) => d.id),
                    )}
                  />
                  <ul className="mt-3 grid gap-2">
                    {p.items.map((i) => (
                      <li key={i.id} className="flex items-start gap-3 rounded-lg border border-linea px-3 py-2">
                        <span className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${i.completo ? 'bg-ok' : 'bg-error'}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <span className="block">{i.titulo}</span>
                          {i.personaNombre && <span className="block text-sm text-tenue">{i.personaNombre}</span>}
                          {i.ayuda && <span className="block text-sm text-tenue">{i.ayuda}</span>}
                          {i.aviso && <span className="block text-sm font-semibold text-aviso">{i.aviso}</span>}
                          {i.requisito === 'coordenadas' && (
                            i.deFicha
                              ? <span className="block text-sm text-ok">Escritas en Inmueble: {i.deFicha}. Van solas en el PDF del paso 2, no hace falta subir nada.</span>
                              : <span className="block text-sm text-tenue">Escribilas en <a href="#inmueble" className="font-semibold text-azul hover:underline">Inmueble</a> (como las da Google Maps) y listo: no hace falta subir un archivo.</span>
                          )}
                          {FORMULARIO_DE[i.requisito] && ley.config.formularios.some((f) => f.clave === FORMULARIO_DE[i.requisito]) && (
                            <Link href={`/expedientes/${id}/formularios/${FORMULARIO_DE[i.requisito]}`} className="mt-1 inline-block text-sm font-semibold text-azul hover:underline">
                              Ver, corregir e imprimir el formulario →
                            </Link>
                          )}
                          {!(i.requisito === 'coordenadas' && !(documentos ?? []).some((d) => d.requisito === 'coordenadas')) && <CargaDocumento
                            expedienteId={id}
                            municipioId={exp.municipality_id}
                            paso={i.paso}
                            requisito={i.requisito}
                            personaId={i.personaId}
                            anio={i.anio}
                            tiposPrueba={i.requisito === 'prueba_posesion' ? tiposDePrueba(ley.config.pruebas_posesion.tipos_aceptados) : undefined}
                            editable={editable}
                            documentos={(documentos ?? []).filter(
                              (d) => d.requisito === i.requisito && (i.personaId ? d.person_id === i.personaId : true) && (i.anio ? d.anio === i.anio : true),
                            )}
                          />}
                        </div>
                        <span className={`shrink-0 text-sm font-semibold ${i.completo ? 'text-ok' : 'text-error'}`}>
                          {i.completo ? 'Cargado' : i.cantidadMinima > 1 ? `${i.cantidadCargada} de ${i.cantidadMinima}` : 'Falta'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <p className="border-t border-linea bg-fondo px-5 py-3 text-sm text-tenue">
              Cada documento puede tener varias fotos o archivos: se unen solos en un PDF liviano. Los archivos quedan privados, solo para este municipio.
            </p>
          </section>

          <SeccionCatastro
            expedienteId={id}
            municipioId={exp.municipality_id}
            numeroInterno={exp.numero_interno}
            estado={estado}
            esDireccion={ctx.roles.includes('direccion')}
            gestiona={ctx.roles.some((r) => r === 'direccion' || r === 'subdireccion')}
            pasos={checklist.pasos.map((p) => ({
              paso: p.paso,
              titulo: p.titulo,
              completo: p.estado === 'completo',
              documentos: p.items.flatMap((i) =>
                (documentos ?? [])
                  .filter((d) => d.requisito === i.requisito && (i.personaId ? d.person_id === i.personaId : true) && (i.anio ? d.anio === i.anio : true))
                  .map((d) => d.id),
              ),
            }))}
            firmados={(documentos ?? []).filter((d) => d.requisito === 'pdf_firmado').map((d) => ({ id: d.id, paso: d.paso, created_at: d.created_at }))}
            numeroCatastro={exp.numero_expediente_catastro}
            fechaPresentacion={exp.fecha_presentacion}
            observaciones={(observaciones ?? []) as Observacion[]}
            datosPortal={[
              { etiqueta: 'Marco normativo', valor: ley.valor_catastro },
              { etiqueta: 'Padrón', valor: exp.padron },
              ...(exp.padron_2 ? [{ etiqueta: 'Segundo padrón', valor: exp.padron_2 }] : []),
              ...(personas ?? []).filter((p) => p.rol !== 'grupo_familiar').flatMap((p) => {
                const quien = `${ROLES_PERSONA[p.rol as keyof typeof ROLES_PERSONA]} ${p.solicitante_numero}`
                return [
                  { etiqueta: `${quien}: apellido`, valor: p.apellido },
                  { etiqueta: `${quien}: nombre`, valor: p.nombre },
                  { etiqueta: `${quien}: DNI`, valor: p.dni },
                  { etiqueta: `${quien}: CUIL`, valor: p.cuil },
                  ...(p.rol === 'solicitante' ? [
                    { etiqueta: `${quien}: teléfono`, valor: p.telefono },
                    { etiqueta: `${quien}: correo`, valor: p.correo },
                  ] : []),
                ]
              }),
              { etiqueta: 'Domicilio del inmueble', valor: exp.domicilio_inmueble },
              { etiqueta: 'Coordenadas', valor: exp.coordenadas },
            ]}
          />

          <div id="personas" className="scroll-mt-4">
          <Personas
            expedienteId={id}
            municipioId={exp.municipality_id}
            personas={(personas ?? []) as PersonaFila[]}
            editable={editable}
            grupoFamiliar={ley.config.grupo_familiar}
          />
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <section className="tarjeta p-5">
            <h2 className="text-lg">Falta traer</h2>
            {checklist.faltantes.length === 0 ? (
              <p className="mt-2 text-ok">No falta nada.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm">
                {checklist.faltantes.slice(0, 12).map((f) => (
                  <li key={f.id}>• {f.titulo}{f.personaNombre ? ` — ${f.personaNombre.replace(/ \(.*\)$/, '')}` : ''}</li>
                ))}
                {checklist.faltantes.length > 12 && <li className="text-tenue">y {checklist.faltantes.length - 12} más</li>}
              </ul>
            )}
          </section>

          <section className="tarjeta p-5">
            <h2 className="text-lg">Relevamiento en el lugar</h2>
            {relevamiento ? (
              <>
                <p className="mt-2 text-sm">
                  {relevamiento.estado === 'en_curso' ? 'Empezado' : 'Terminado'} el {new Date(`${relevamiento.fecha}T12:00:00`).toLocaleDateString('es-AR')} · {respuestasRel.length} respuestas
                </p>
                {porRevisar > 0 && <p className="mt-1 text-sm font-semibold text-aviso">{porRevisar} {porRevisar === 1 ? 'respuesta grabada' : 'respuestas grabadas'} para revisar</p>}
                <Link href={`/expedientes/${id}/relevamiento`} className="mt-2 inline-block text-sm font-semibold text-azul hover:underline">Escuchar y revisar las respuestas →</Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-tenue">Todavía no se hizo la visita. El relevador la carga desde el celular, en la aplicación de relevamiento.</p>
            )}
          </section>

          <div id="inmueble" className="scroll-mt-4">
          <FormInmueble
            expedienteId={id}
            editable={editable}
            barrios={barrios ?? []}
            localidades={localidades ?? []}
            valores={{
              padron: exp.padron, domicilio_inmueble: exp.domicilio_inmueble, neighborhood_id: exp.neighborhood_id, locality_id: exp.locality_id,
              manzana: exp.manzana, lote: exp.lote, coordenadas: exp.coordenadas, notas: exp.notas,
            }}
          />
          </div>

          <div id="datos-catastro" className="scroll-mt-4">
          <FormDatosCatastro
            expedienteId={id}
            editable={editable}
            padron={exp.padron}
            padron2={exp.padron_2}
            catastrales={(exp.datos_catastrales ?? {}) as Record<string, string>}
          />
          </div>

          <section className="tarjeta p-5">
            <h2 className="text-lg">Historial</h2>
            <ol className="mt-3 grid gap-3 text-sm">
              {(eventos ?? []).map((e) => (
                <li key={e.id} className="border-l-2 border-linea pl-3">
                  <span className="block font-semibold">
                    {e.tipo === 'creado' ? 'Expediente abierto' : e.tipo === 'nota' ? 'Nota' : ESTADOS[e.a_estado as EstadoExpediente]?.texto}
                  </span>
                  {e.nota && <span className="block">{e.nota}</span>}
                  <span className="block text-tenue">
                    {(e.profiles as unknown as { nombre: string } | null)?.nombre ?? '—'} · {new Date(e.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

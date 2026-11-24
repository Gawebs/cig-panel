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
import { FormInmueble } from './form-inmueble'
import { completarBarrioDeLaLey } from '@/lib/barrio-ley'
import { proximoPaso } from '@/lib/proximo-paso'
import { Personas, type PersonaFila } from './personas'
import { SeccionCatastro, type Observacion } from './catastro'
import { PasosExpediente } from '@/components/pasos-expediente'

// Requisito del checklist → formulario que se imprime para firmar
const FORMULARIO_DE: Record<string, string> = {
  formulario_solicitud: 'solicitud',
  anexo_i: 'anexo_i',
  ddjj: 'ddjj',
  relevamiento_social: 'relevamiento_social',
}

const EDITABLES: EstadoExpediente[] =['en_armado', 'devuelto', 'listo_para_revisar', 'observado']

type PartePdfConfig = { letra: string; titulo: string; requisitos: string[] }
/** PDF 2: Catastro lo recibe en dos archivos. */
const PARTES_PDF: Record<number, PartePdfConfig[] | undefined> = {
  2: [
    { letra: 'a', titulo: 'Fotos del inmueble', requisitos: ['fotos_inmueble'] },
    { letra: 'b', titulo: 'Ubicación: coordenadas, croquis y Google Earth', requisitos: ['coordenadas', 'croquis', 'captura_google_earth'] },
  ],
}

export default async function FichaExpediente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pdf?: string }> }) {
  const { id } = await params
  const { pdf } = await searchParams
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
  // Quién supervisa los expedientes en este municipio (rol Subdirección): su nombre sale de los usuarios, no está escrito a mano.
  const { data: supervisores } = await supabase
    .from('memberships')
    .select('profiles(nombre, activo)')
    .eq('municipality_id', exp.municipality_id)
    .contains('roles', ['subdireccion'])
  const nombresSupervision = (supervisores ?? [])
    .map((m) => m.profiles as unknown as { nombre: string | null; activo: boolean } | null)
    .filter((p) => p?.activo && p.nombre)
    .map((p) => p!.nombre!)
  const supervision = nombresSupervision.length ? nombresSupervision.join(' o ') : 'la Subdirección'
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
    personas: { href: '?pdf=1#personas', texto: 'Ir a Personas' },
    catastro: { href: `/expedientes/${id}/datos-iniciales`, texto: 'Completar en el paso 1' },
    inmueble: { href: '?pdf=2#inmueble', texto: 'Ir a Inmueble' },
    ddjj: { href: `/expedientes/${id}/formularios/ddjj`, texto: 'Abrir la declaración jurada' },
  }

  const primerDoc = [...checklist.faltantes].sort((a, b) => a.paso - b.paso)[0]
  const siguiente = proximoPaso({
    estado,
    roles: ctx.roles,
    datoFaltante: faltanDatos[0] && { texto: faltanDatos[0].texto, href: IR_A[faltanDatos[0].donde].href, boton: IR_A[faltanDatos[0].donde].texto },
    cantidadDatosFaltantes: faltanDatos.length,
    documentoFaltante: primerDoc && { paso: primerDoc.paso, titulo: primerDoc.titulo, persona: primerDoc.personaNombre, href: `?pdf=${primerDoc.paso}#req-${primerDoc.id}` },
    cantidadDocumentosFaltantes: checklist.faltantes.length,
    firmados: new Set((documentos ?? []).filter((d) => d.requisito === 'pdf_firmado').map((d) => d.paso)).size,
    prorrogaHasta: (() => {
      const h = (observaciones ?? []).find((o) => o.estado !== 'respondida' && o.prorroga_hasta)?.prorroga_hasta
      return h ? new Date(`${h}T12:00:00`).toLocaleDateString('es-AR') : undefined
    })(),
  })
  const TONO_PROXIMO = { hacer: 'border-azul bg-azul-suave', esperar: 'border-linea bg-fondo', listo: 'border-ok bg-ok-suave' } as const

  // Confirmación antes de los cambios de estado que importan: si falta algo, se dice qué.
  const falta = [checklist.faltantes.length ? `${checklist.faltantes.length} documento(s)` : '', faltanDatos.length ? `${faltanDatos.length} dato(s)` : ''].filter(Boolean).join(' y ')
  const avisoDe = (hacia: string): string | undefined => {
    if (hacia === 'listo_para_revisar') return falta ? `Todavía faltan ${falta}. Podés enviarlo igual, pero en la revisión va a figurar incompleto.` : undefined
    if (hacia === 'aprobado') return falta ? `Ojo: faltan ${falta}. Si lo aprobás así, Catastro lo va a observar. ¿Lo aprobás igual?` : '¿Confirmás que lo revisaste y está todo bien? Pasa a la firma de la Dirección.'
    if (hacia === 'firmado') return '¿Confirmás que los 4 PDF subidos son los firmados? Después ya no se cambian hasta que Catastro responda.'
    if (hacia === 'aceptado') return '¿Catastro lo aceptó de verdad? Es el último estado: después no se puede volver atrás.'
    return undefined
  }

  // Paso 3 en pestañas, una por cada PDF que pide Catastro. Se abre la primera que falta completar.
  const pdfElegido = Number(pdf)
  const pdfActual = [1, 2, 3, 4].includes(pdfElegido) ? pdfElegido : (checklist.pasos.find((p) => p.estado !== 'completo')?.paso ?? 1)
  const pasoActual = checklist.pasos[pdfActual - 1]
  const docsDe = (i: (typeof pasoActual.items)[number]) =>
    (documentos ?? []).filter((d) => d.requisito === i.requisito && (i.personaId ? d.person_id === i.personaId : true) && (i.anio ? d.anio === i.anio : true))

  // Pasos que Catastro recibe en varios PDF: cada parte con sus documentos, en este orden.
  const partesActual = PARTES_PDF[pasoActual.paso]
  const itemsDeParte = (parte: PartePdfConfig) =>
    parte.requisitos.flatMap((r) => pasoActual.items.filter((i) => i.requisito === r))
  const filaDocumento = (i: (typeof pasoActual.items)[number]) => (
    <li key={i.id} id={`req-${i.id}`} className="flex scroll-mt-4 items-start gap-3 rounded-lg border border-linea px-3 py-2 target:border-azul target:ring-2 target:ring-azul">
      <span className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${i.opcional && !i.cantidadCargada ? 'bg-linea' : i.completo ? 'bg-ok' : 'bg-error'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="block font-semibold">
          {i.completo && !i.opcional ? '' : i.opcional && !i.cantidadCargada ? 'Podés sumar: ' : FORMULARIO_DE[i.requisito] ? 'Imprimí, hacé firmar y subí: ' : i.requisito === 'coordenadas' ? 'Escribí: ' : 'Subí: '}
          {i.titulo}{i.personaNombre ? ` de ${i.personaNombre}` : ''}
        </span>
        {i.ayuda && (
          <details className="text-sm text-tenue">
            <summary className="cursor-pointer text-azul">¿Qué sirve?</summary>
            {i.ayuda}
          </details>
        )}
        {i.aviso && <span className="block text-sm font-semibold text-aviso">{i.aviso}</span>}
        {i.requisito === 'coordenadas' && (
          i.deFicha
            ? <span className="block text-sm text-ok">Escritas en Inmueble: {i.deFicha}. Van solas en este PDF, no hace falta subir nada.</span>
            : <span className="block text-sm text-tenue">Escribilas abajo, en <a href="#inmueble" className="font-semibold text-azul hover:underline">Inmueble</a> (como las da Google Maps) y listo: no hace falta subir un archivo.</span>
        )}
        {FORMULARIO_DE[i.requisito] && ley.config.formularios.some((f) => f.clave === FORMULARIO_DE[i.requisito]) && (
          <Link href={`/expedientes/${id}/formularios/${FORMULARIO_DE[i.requisito]}`} className="mt-1 inline-block text-sm font-semibold text-azul hover:underline">
            Abrir el formulario para imprimir →
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
          documentos={docsDe(i)}
        />}
      </div>
      <span className={`shrink-0 text-sm font-semibold ${i.opcional && !i.cantidadCargada ? 'text-tenue' : i.completo ? 'text-ok' : 'text-error'}`}>
        {i.opcional && !i.cantidadCargada ? 'Opcional' : i.completo ? 'Cargado' : i.cantidadMinima > 1 ? `${i.cantidadCargada} de ${i.cantidadMinima}` : 'Falta'}
      </span>
    </li>
  )

  const acciones = ACCIONES.filter((a) => a.desde.includes(estado) && a.roles.some((r) => ctx.roles.includes(r)))
  const ultimaDevolucion = (eventos ?? []).find((e) => e.a_estado === 'devuelto')

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      {editable && <PasosExpediente expedienteId={id} actual={3} />}
      <div id="arriba" className="flex scroll-mt-16 flex-wrap items-start justify-between gap-4">
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

      {/* Índice fijo: se puede ir y volver a cualquier parte de la ficha, no solo hacia adelante. */}
      <nav aria-label="Partes del expediente" className="sticky top-0 z-10 -mx-2 -my-3 flex gap-1 overflow-x-auto bg-fondo/95 px-2 py-2 backdrop-blur">
        {[
          ['#arriba', '↑ Arriba'],
          ['#documentos', 'Documentos (4 PDF)'],
          ['#catastro', 'Firma y presentación'],
          ['#historial', 'Historial'],
        ].map(([href, texto]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-linea bg-papel px-3 py-1.5 text-sm font-semibold text-azul hover:border-azul">
            {texto}
          </a>
        ))}
      </nav>

      {siguiente && (
        <section aria-label="Próximo paso" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-5 py-4 ${TONO_PROXIMO[siguiente.tono]}`}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-tenue">{siguiente.tono === 'esperar' ? 'Ahora' : siguiente.tono === 'listo' ? 'Terminado' : 'Próximo paso'}</p>
            <p className="text-lg font-semibold">{siguiente.titulo}</p>
            {siguiente.detalle && <p className="text-sm text-tenue">{siguiente.detalle}</p>}
            {editable && faltanDatos.length > 1 && (
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer font-semibold text-azul">Ver los {faltanDatos.length} datos que faltan</summary>
                <ul className="mt-1 grid gap-1">
                  {faltanDatos.map((f) => (
                    <li key={f.texto} className="flex flex-wrap items-baseline gap-x-2">
                      <span>• {f.texto}</span>
                      {IR_A[f.donde].href.startsWith('/')
                        ? <Link href={IR_A[f.donde].href} className="font-semibold text-azul hover:underline">{IR_A[f.donde].texto} →</Link>
                        : <a href={IR_A[f.donde].href} className="font-semibold text-azul hover:underline">{IR_A[f.donde].texto} →</a>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {siguiente.boton && (
            !siguiente.boton.href.startsWith('/')
              ? <a href={siguiente.boton.href} className="boton-principal shrink-0">{siguiente.boton.texto} →</a>
              : <Link href={siguiente.boton.href} className="boton-principal shrink-0">{siguiente.boton.texto} →</Link>
          )}
        </section>
      )}

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
            <h2 className="text-lg">Revisión de {supervision}</h2>
            <p className="text-sm text-tenue">Antes de aprobar, fijate que esté todo:</p>
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

      {/* Paso 3: una pestaña por cada PDF que se sube a Catastro. Se ve una sola a la vez. */}
      <section id="documentos" className="tarjeta scroll-mt-16 overflow-hidden">
        <div className="degrade px-5 py-4 text-white">
          <h2 className="text-xl">Paso 3: Armá los 4 PDF para Catastro</h2>
          <p className="text-sm opacity-90">Catastro pide 4 PDF. Completá uno por vez: tocá “Sacar foto” o “Elegir archivo” en cada documento. Lo que tiene punto verde ya está.</p>
        </div>
        <nav aria-label="PDF para Catastro" className="grid grid-cols-2 gap-2 border-b border-linea px-5 py-3 sm:grid-cols-4">
          {checklist.pasos.map((p) => (
            <Link
              key={p.paso}
              href={`?pdf=${p.paso}#documentos`}
              scroll={false}
              aria-current={p.paso === pdfActual ? 'page' : undefined}
              className={`grid gap-0.5 rounded-lg border px-3 py-2 text-sm ${p.paso === pdfActual ? 'border-azul bg-azul-suave ring-2 ring-azul' : 'border-linea bg-papel hover:border-azul'}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <PasoPunto estado={p.estado} />
                PDF {p.paso}{p.estado === 'completo' ? ' ✓' : ''}
              </span>
              <span className="text-tenue">{p.titulo}</span>
              <span className="text-xs tabular-nums text-tenue">{p.completos} de {p.total}</span>
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 px-5 py-4">
          <h3 className="text-lg">PDF {pasoActual.paso}: {pasoActual.titulo}</h3>
          {pdfActual === 1 && checklist.avisos.length > 0 && (
            <ul className="grid gap-1 rounded-lg bg-aviso-suave px-4 py-3 text-sm text-aviso">
              {checklist.avisos.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          )}
          {partesActual ? (
            partesActual.map((parte) => (
              <div key={parte.letra} className="grid gap-2">
                <h4 className="font-semibold">PDF {pasoActual.paso}{parte.letra}: {parte.titulo}</h4>
                <ul className="grid gap-2">{itemsDeParte(parte).map(filaDocumento)}</ul>
              </div>
            ))
          ) : (
            <ul className="grid gap-2">{pasoActual.items.map(filaDocumento)}</ul>
          )}

          {/* Lo que se carga para este PDF y no es un documento */}
          {pdfActual === 1 && (
            <div id="personas" className="scroll-mt-16">
              <Personas
                expedienteId={id}
                municipioId={exp.municipality_id}
                personas={(personas ?? []) as PersonaFila[]}
                editable={editable}
                grupoFamiliar={ley.config.grupo_familiar}
              />
            </div>
          )}
          {pdfActual === 2 && (
            <div id="inmueble" className="scroll-mt-16">
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
          )}
          {pdfActual === 4 && (
            <section className="rounded-lg border border-linea p-4">
              <h4 className="font-semibold">Relevamiento en el lugar</h4>
              {relevamiento ? (
                <>
                  <p className="mt-1 text-sm">
                    {relevamiento.estado === 'en_curso' ? 'Empezado' : 'Terminado'} el {new Date(`${relevamiento.fecha}T12:00:00`).toLocaleDateString('es-AR')} · {respuestasRel.length} respuestas
                  </p>
                  {porRevisar > 0 && <p className="mt-1 text-sm font-semibold text-aviso">{porRevisar} {porRevisar === 1 ? 'respuesta grabada' : 'respuestas grabadas'} para revisar</p>}
                  <Link href={`/expedientes/${id}/relevamiento`} className="mt-2 inline-block text-sm font-semibold text-azul hover:underline">Escuchar y revisar las respuestas →</Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-tenue">Todavía no se hizo la visita. El relevador la carga desde el celular, en la aplicación de relevamiento.</p>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
            {partesActual ? (
              <div className="grid gap-1">
                {partesActual.map((parte) => {
                  const items = itemsDeParte(parte)
                  return (
                    <DescargaPaso
                      key={parte.letra}
                      expedienteId={id}
                      numeroInterno={exp.numero_interno}
                      paso={pasoActual.paso}
                      parte={parte}
                      completo={items.every((i) => i.completo)}
                      hojaCoordenadas={items.find((i) => i.deFicha)?.deFicha}
                      documentos={items.flatMap((i) => docsDe(i).map((d) => d.id))}
                    />
                  )
                })}
              </div>
            ) : (
              <DescargaPaso
                expedienteId={id}
                numeroInterno={exp.numero_interno}
                paso={pasoActual.paso}
                completo={pasoActual.estado === 'completo'}
                hojaCoordenadas={pasoActual.items.find((i) => i.deFicha)?.deFicha}
                documentos={pasoActual.items.flatMap((i) => docsDe(i).map((d) => d.id))}
              />
            )}
            {pdfActual < 4 && (
              <Link href={`?pdf=${pdfActual + 1}#documentos`} scroll={false} className="boton min-h-9 text-sm">
                Seguir con el PDF {pdfActual + 1} →
              </Link>
            )}
          </div>
          <p className="text-sm text-tenue">Podés subir varias fotos por documento: se unen solas en un PDF.</p>
        </div>
      </section>

      <div id="catastro" className="-mb-6 scroll-mt-16" aria-hidden />
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
        faltanDatos={faltanDatos.map((f) => f.texto)}
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

      {acciones.length > 0 && (
        <section id="acciones" className="tarjeta flex scroll-mt-4 flex-wrap items-start gap-3 p-4">
          {estado === 'listo_para_revisar' && (
            <p className="w-full text-sm text-tenue">Lo revisa y lo aprueba o lo devuelve: <strong className="text-tinta">{supervision}</strong>.</p>
          )}
          {acciones.map((a) => (
            <AccionEstado
              key={a.hacia}
              expedienteId={id}
              hacia={a.hacia}
              texto={a.texto}
              pideNota={a.pideNota}
              principal={a.principal}
              aviso={avisoDe(a.hacia)}
            />
          ))}
        </section>
      )}

      <section id="historial" className="tarjeta scroll-mt-16 p-5">
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
    </div>
  )
}

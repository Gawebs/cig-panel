import { formatoDni } from '@/lib/dni'
import { notFound } from 'next/navigation'
import { obtenerContexto } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { ImprimirAlAbrir } from './imprimir-al-abrir'

export const metadata = { title: 'Constancia de tenencia precaria' }

/** Nombre de la ciudad para la fecha: "Municipalidad de Banda del Río Salí" → "Banda del Río Salí". */
function ciudadDe(nombre: string) {
  return nombre.replace(/\s*\(.*\)\s*$/, '').replace(/^(municipalidad|municipio|comuna rural|comuna)\s+de\s+/i, '')
}

const destacado = (v: string | null) => <strong style={{ textTransform: 'uppercase' }}>{v || '—'}</strong>

export default async function ImprimirConstancia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vista?: string }> }) {
  const { id } = await params
  const { vista } = await searchParams
  await obtenerContexto()
  const supabase = await createClient()
  const { data: c } = await supabase
    .from('tenure_certificates')
    .select('*, municipalities(nombre, tipo, logo_path, area_nombre, secretaria_nombre)')
    .eq('id', id)
    .maybeSingle()
  if (!c) notFound()
  const m = c.municipalities as unknown as { nombre: string; tipo: string; logo_path: string | null; area_nombre: string; secretaria_nombre: string }
  const ciudad = ciudadDe(m.nombre)
  const ente = m.tipo === 'comuna' ? `de la Comuna de ${ciudad}` : `del Municipio de ${ciudad}`
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="constancia">
      <style>{`
        @page { size: A4; margin: 1.5cm 1.6cm 1.6cm 1.6cm; }
        body { background: #fff !important; color: #000 !important; font-family: Arial, Helvetica, sans-serif !important; font-size: 12pt !important; }
        .constancia { max-width: 18cm; margin: 0 auto; padding: 0.5cm 0; line-height: 1.35; }
        .constancia p { margin: 0 0 12pt; text-align: justify; text-indent: 1.1cm; }
        .encabezado { display: flex; align-items: center; gap: 10px; margin-bottom: 1.2cm; }
        .encabezado img { width: 72px; height: 72px; object-fit: contain; }
        .encabezado .nombre { color: #9ca3af; font-size: 19px; font-weight: 700; line-height: 1.05; }
        .fecha { text-align: right; margin-bottom: 0.45cm; }
        .organismo { margin-bottom: 1.2cm; font-size: 13pt; font-weight: 700; text-transform: uppercase; color: #444; line-height: 1.65; }
        .titulo { text-align: center; font-weight: 700; text-transform: uppercase; margin: 0 0 0.7cm; }
        .firmas { margin-top: 2.1cm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.2cm; align-items: end; font-weight: 700; font-size: 10pt; }
        .firmas .linea { border-top: 1px solid #000; padding-top: 6px; }
        .firmas .campos { display: grid; gap: 10px; }
        @media print { .no-imprimir { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>
      <ImprimirAlAbrir automatico={!vista} />
      <div className="encabezado">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo del municipio para impresión */}
        {m.logo_path && <img src={m.logo_path} alt="" />}
        <div className="nombre">{m.tipo === 'comuna' ? 'Comuna' : 'Municipalidad'}<br />{ciudad}</div>
      </div>
      <div className="fecha">{ciudad}, {fecha}</div>
      <div className="organismo">
        <div>{m.tipo === 'comuna' ? 'Comuna' : 'Municipio'} de {ciudad}</div>
        <div>{m.secretaria_nombre}</div>
        <div>{m.area_nombre}</div>
      </div>
      <div className="titulo">Constancia de tenencia precaria</div>
      <p>
        La {m.area_nombre} {ente} otorga la presente Tenencia Precaria al Sr/a {destacado(c.vecino_nombre)}; DNI: {destacado(formatoDni(c.dni))}, con domicilio en calle: {destacado(c.domicilio)}; Barrio: {destacado(c.barrio)}. Donde la propiedad se encuentra posicionada en una fracción del Padrón: {destacado(c.padron_catastral)}. Matrícula catastral: {destacado(c.matricula_catastral)}. Propietario legal: {destacado(c.propietario_legal)}.
      </p>
      <p>
        La presente tenencia es de carácter precario, personal e intransferible, y no confiere al/la tenedor/a ningún derecho real ni expectativa de dominio sobre el inmueble mencionado. El/la tenedor/a reconoce que la ocupación se encuentra permitida por razones sociales y de necesidad habitacional, y que la presente autorización administrativa no implica reconocimiento de derecho alguno sobre la titularidad dominial del bien.
      </p>
      <div className="firmas">
        <div className="campos">
          <div>Presentado ante: <strong>{c.presentado_ante || '—'}</strong></div>
          <br />
          <div>FIRMA SOLICITANTE:</div>
          <div>ACLARACIÓN:</div>
          <div>D.N.I.:</div>
        </div>
        <div className="linea">Firma y Sello del Responsable</div>
      </div>
      <p style={{ textIndent: 0, marginTop: '1cm', fontSize: '9pt', color: '#666' }}>{c.numero}</p>
    </div>
  )
}

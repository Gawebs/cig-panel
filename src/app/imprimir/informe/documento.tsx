import { mesLargo, type Informe } from '@/lib/informe'

export interface DatosMunicipio {
  nombre: string
  tipo: string
  logo_path: string | null
  area_nombre: string
  secretaria_nombre: string
}

export interface PlazoAbierto {
  numero: string
  barrio: string
  dias: number
}

const AZUL = '#1d4f91'
const VERDE = '#16936d'
const AMBAR = '#c27c0e'
const ROJO = '#b42318'
const GRIS = '#d5dbe3'
const COLOR_ETAPA: Record<string, string> = { armado: '#7aa3d6', oficina: AMBAR, catastro: AZUL, observado: ROJO, aceptado: VERDE }

const n = (v: number) => v.toLocaleString('es-AR')
const ciudadDe = (nombre: string) => nombre.replace(/\s*\(.*\)\s*$/, '').replace(/^(municipalidad|municipio|comuna rural|comuna)\s+de\s+/i, '')

/** Barras horizontales por etapa. */
function GraficoEtapas({ informe }: { informe: Informe }) {
  const max = Math.max(1, ...informe.porEtapa.map((e) => e.cantidad))
  const alto = 30
  return (
    <svg viewBox={`0 0 640 ${informe.porEtapa.length * alto + 6}`} width="100%" role="img" aria-label="Expedientes por etapa">
      {informe.porEtapa.map((e, i) => {
        const w = (e.cantidad / max) * 430
        return (
          <g key={e.clave} transform={`translate(0 ${i * alto + 4})`}>
            <text x="0" y="17" fontSize="12" fill="#333">{e.titulo}</text>
            <rect x="140" y="4" width={Math.max(w, e.cantidad ? 3 : 0)} height="18" rx="3" fill={COLOR_ETAPA[e.clave]} />
            <text x={146 + w} y="17" fontSize="12" fontWeight="700" fill="#222">{n(e.cantidad)}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Columnas agrupadas: abiertos, presentados y aceptados de los últimos 12 meses. */
function GraficoMeses({ informe }: { informe: Informe }) {
  const series = [
    { clave: 'abiertos' as const, titulo: 'Abiertos', color: '#9bb7dc' },
    { clave: 'presentados' as const, titulo: 'Presentados en Catastro', color: AZUL },
    { clave: 'aceptados' as const, titulo: 'Aceptados por Catastro', color: VERDE },
  ]
  const max = Math.max(1, ...informe.meses.flatMap((m) => series.map((s) => m[s.clave])))
  const ancho = 640, alto = 190, izq = 30, abajo = 22, arriba = 10
  const paso = (ancho - izq) / informe.meses.length
  const barra = (paso - 8) / 3
  const y = (v: number) => arriba + (alto - arriba - abajo) * (1 - v / max)
  const lineas = [0, 0.5, 1].map((f) => Math.round(max * f))
  return (
    <div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" role="img" aria-label="Evolución mensual">
        {lineas.map((v) => (
          <g key={v}>
            <line x1={izq} x2={ancho} y1={y(v)} y2={y(v)} stroke={GRIS} strokeWidth="1" />
            <text x={izq - 4} y={y(v) + 4} fontSize="10" fill="#666" textAnchor="end">{v}</text>
          </g>
        ))}
        {informe.meses.map((m, i) => (
          <g key={m.clave} transform={`translate(${izq + i * paso + 4} 0)`}>
            {series.map((s, j) => (
              <rect key={s.clave} x={j * barra} y={y(m[s.clave])} width={barra - 1} height={alto - abajo - y(m[s.clave])} fill={s.color} />
            ))}
            <text x={(paso - 8) / 2} y={alto - 6} fontSize="10" fill="#555" textAnchor="middle">{m.titulo}</text>
          </g>
        ))}
      </svg>
      <div className="leyenda">
        {series.map((s) => <span key={s.clave}><i style={{ background: s.color }} />{s.titulo}</span>)}
      </div>
    </div>
  )
}

/** Aceptados acumulados hoy y proyectados a 3, 6 y 12 meses, por escenario. */
function GraficoProyeccion({ informe }: { informe: Informe }) {
  const colores = ['#9aa8b8', AZUL, VERDE]
  const puntos = [0, 3, 6, 12]
  const max = Math.max(1, informe.total)
  const ancho = 640, alto = 200, izq = 36, der = 12, abajo = 24, arriba = 12
  const x = (mes: number) => izq + ((ancho - izq - der) * mes) / 12
  const y = (v: number) => arriba + (alto - arriba - abajo) * (1 - v / max)
  return (
    <div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" role="img" aria-label="Proyección de expedientes aceptados">
        {[0, 0.5, 1].map((f) => {
          const v = Math.round(max * f)
          return (
            <g key={f}>
              <line x1={izq} x2={ancho - der} y1={y(v)} y2={y(v)} stroke={GRIS} />
              <text x={izq - 4} y={y(v) + 4} fontSize="10" fill="#666" textAnchor="end">{v}</text>
            </g>
          )
        })}
        <line x1={izq} x2={ancho - der} y1={y(informe.total)} y2={y(informe.total)} stroke={VERDE} strokeDasharray="5 4" />
        <text x={ancho - der} y={y(informe.total) - 5} fontSize="10" fill={VERDE} textAnchor="end">Total en trámite: {n(informe.total)}</text>
        {puntos.map((p) => <text key={p} x={x(p)} y={alto - 6} fontSize="10" fill="#555" textAnchor={p === 0 ? 'start' : p === 12 ? 'end' : 'middle'}>{p === 0 ? 'Hoy' : `+${p} meses`}</text>)}
        {informe.escenarios.map((e, i) => {
          const valores = [informe.aceptados, ...e.aceptadosA.map((a) => a.total)]
          return (
            <g key={e.nombre}>
              <polyline points={puntos.map((p, k) => `${x(p)},${y(valores[k])}`).join(' ')} fill="none" stroke={colores[i]} strokeWidth="2.5" />
              {puntos.map((p, k) => <circle key={p} cx={x(p)} cy={y(valores[k])} r="3" fill={colores[i]} />)}
            </g>
          )
        })}
      </svg>
      <div className="leyenda">
        {informe.escenarios.map((e, i) => <span key={e.nombre}><i style={{ background: colores[i] }} />{e.nombre}</span>)}
      </div>
    </div>
  )
}

/** Frases de lectura rápida, armadas con los números. */
function lecturaRapida(i: Informe, plazos: PlazoAbierto[]): string[] {
  const frases: string[] = []
  frases.push(`Hay ${n(i.total)} expedientes en trámite o terminados; Catastro aceptó ${n(i.aceptados)} (${i.avance} %).`)
  if (i.ritmo.abiertos || i.ritmo.presentados || i.ritmo.aceptados) {
    frases.push(`En los últimos 3 meses, por mes, se abrieron ${n(i.ritmo.abiertos)}, se presentaron en Catastro ${n(i.ritmo.presentados)} y Catastro aceptó ${n(i.ritmo.aceptados)}.`)
  }
  const actual = i.escenarios.find((e) => e.factor === 1)
  if (actual?.terminaEn) {
    frases.push(`A este ritmo, los ${n(i.pendientes)} expedientes pendientes estarían resueltos hacia ${mesLargo(actual.terminaEn)}${i.baseProyeccion === 'presentados' ? ' (estimado con las presentaciones, porque todavía no hay aceptaciones suficientes)' : ''}.`)
  } else if (i.pendientes > 0) {
    frases.push('Todavía no hay movimiento suficiente en Catastro para estimar cuándo se terminan los pendientes.')
  }
  if (i.tiempos.presentacionAAceptacion !== null) frases.push(`Catastro tarda en promedio ${n(i.tiempos.presentacionAAceptacion)} días desde que se presenta un expediente hasta que lo acepta.`)
  const vencidos = plazos.filter((p) => p.dias < 0).length
  if (vencidos) frases.push(`Atención: ${vencidos} observación(es) de Catastro tienen el plazo vencido.`)
  const enCurso = i.porEtapa.find((e) => e.clave === 'observado')?.cantidad ?? 0
  if (enCurso && !vencidos) frases.push(`${n(enCurso)} expediente(s) están observados por Catastro y se están respondiendo dentro del plazo.`)
  return frases
}

export function DocumentoInforme(props: {
  municipio: DatosMunicipio
  informe: Informe
  plazos: PlazoAbierto[]
  generadoPor: string
  fecha: Date
}) {
  const { municipio: m, informe: i, plazos } = props
  const ciudad = ciudadDe(m.nombre)
  const ente = m.tipo === 'comuna' ? 'Comuna' : 'Municipalidad'
  const fecha = props.fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  const vencidos = plazos.filter((p) => p.dias < 0)
  const enCatastro = (i.porEtapa.find((e) => e.clave === 'catastro')?.cantidad ?? 0) + (i.porEtapa.find((e) => e.clave === 'observado')?.cantidad ?? 0)

  return (
    <div className="informe">
      <style>{`
        @page { size: A4; margin: 1.4cm 1.5cm 1.5cm 1.5cm; }
        body { background: #fff !important; color: #1a1a1a !important; font-family: Arial, Helvetica, sans-serif !important; font-size: 10.5pt !important; }
        .informe { max-width: 18.2cm; margin: 0 auto; padding: 0.4cm 0; line-height: 1.4; }
        .informe h1 { font-size: 20pt; margin: 0; color: ${AZUL}; font-family: inherit; }
        .informe h2 { font-size: 13pt; margin: 0 0 8px; color: ${AZUL}; border-bottom: 2px solid ${AZUL}; padding-bottom: 3px; font-family: inherit; }
        .informe section { margin-top: 18px; break-inside: avoid; }
        .encabezado { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid ${VERDE}; padding-bottom: 10px; }
        .encabezado img { width: 60px; height: 60px; object-fit: contain; }
        .encabezado .ente { color: #6b7280; font-weight: 700; font-size: 11pt; line-height: 1.15; }
        .encabezado .derecha { margin-left: auto; text-align: right; font-size: 9.5pt; color: #444; }
        .para { margin-top: 10px; font-size: 10pt; color: #333; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .kpi { border: 1px solid ${GRIS}; border-radius: 6px; padding: 8px 10px; }
        .kpi b { display: block; font-size: 20pt; line-height: 1.1; }
        .kpi span { font-size: 9pt; color: #555; }
        .lectura { margin: 0; padding-left: 18px; }
        .lectura li { margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        th, td { padding: 4px 6px; border-bottom: 1px solid ${GRIS}; text-align: left; }
        th { background: #f1f4f8; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .barra { display: inline-block; width: 70px; height: 7px; background: ${GRIS}; border-radius: 4px; vertical-align: middle; margin-right: 6px; overflow: hidden; }
        .barra i { display: block; height: 100%; background: ${VERDE}; }
        .leyenda { display: flex; flex-wrap: wrap; gap: 14px; font-size: 9pt; color: #444; margin-top: 2px; }
        .leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
        .nota { font-size: 8.5pt; color: #666; margin-top: 6px; }
        .rojo { color: ${ROJO}; font-weight: 700; }
        .pie { margin-top: 22px; border-top: 1px solid ${GRIS}; padding-top: 6px; font-size: 8.5pt; color: #777; }
        @media print { .no-imprimir { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>

      <div className="encabezado">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo del municipio para impresión */}
        {m.logo_path && <img src={m.logo_path} alt="" />}
        <div className="ente">{ente}<br />{ciudad}</div>
        <div className="derecha">{m.secretaria_nombre}<br />{m.area_nombre}<br />{ciudad}, {fecha}</div>
      </div>
      <div className="para">
        <h1>Informe de Regularización Dominial</h1>
        <div>Para el Señor Intendente · Situación al {fecha}</div>
      </div>

      <section>
        <h2>Resumen</h2>
        <div className="kpis">
          <div className="kpi"><b>{n(i.total)}</b><span>expedientes en trámite o terminados</span></div>
          <div className="kpi"><b style={{ color: VERDE }}>{n(i.aceptados)}</b><span>aceptados por Catastro ({i.avance} %)</span></div>
          <div className="kpi"><b style={{ color: AZUL }}>{n(enCatastro)}</b><span>en Catastro (incluye observados)</span></div>
          <div className="kpi"><b style={{ color: vencidos.length ? ROJO : undefined }}>{n(vencidos.length)}</b><span>observaciones con plazo vencido</span></div>
        </div>
      </section>

      <section>
        <h2>Lectura rápida</h2>
        <ul className="lectura">{lecturaRapida(i, plazos).map((f) => <li key={f}>{f}</li>)}</ul>
      </section>

      <section>
        <h2>Dónde está cada expediente</h2>
        <GraficoEtapas informe={i} />
        {i.desistidos > 0 && <p className="nota">Además hay {n(i.desistidos)} expediente(s) desistidos o archivados, que no se cuentan.</p>}
      </section>

      <section>
        <h2>Evolución de los últimos 12 meses</h2>
        <GraficoMeses informe={i} />
      </section>

      <section>
        <h2>Proyecciones</h2>
        {i.baseProyeccion === null ? (
          <p>Todavía no hay presentaciones ni aceptaciones de Catastro en los últimos 3 meses: no hay datos suficientes para proyectar. El informe va a mostrar proyecciones cuando empiece el movimiento en Catastro.</p>
        ) : (
          <>
            <GraficoProyeccion informe={i} />
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Escenario</th>
                  <th className="num">Por mes</th>
                  <th className="num">Aceptados en 3 meses</th>
                  <th className="num">En 6 meses</th>
                  <th className="num">En 12 meses</th>
                  <th>Pendientes resueltos hacia</th>
                </tr>
              </thead>
              <tbody>
                {i.escenarios.map((e) => (
                  <tr key={e.nombre}>
                    <td><b>{e.nombre}</b></td>
                    <td className="num">{n(e.porMes)}</td>
                    {e.aceptadosA.map((a) => <td key={a.meses} className="num">{n(a.total)}</td>)}
                    <td>{e.terminaEn ? mesLargo(e.terminaEn) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="nota">
              Cómo se calcula: se toma el promedio mensual de {i.baseProyeccion === 'aceptados' ? 'expedientes aceptados por Catastro' : 'expedientes presentados en Catastro (todavía no hay aceptaciones suficientes)'} de los últimos 3 meses
              ({n(i.ritmo[i.baseProyeccion])} por mes). “Prudente” supone un 25 % menos y “Si se acelera”, un 25 % más. Los totales son acumulados (incluyen los {n(i.aceptados)} ya aceptados)
              y no cuentan expedientes que se abran de acá en adelante. Es una estimación: depende sobre todo de los tiempos de Catastro.
            </p>
          </>
        )}
      </section>

      <section>
        <h2>Por barrio</h2>
        <table>
          <thead><tr><th>Barrio</th><th className="num">Expedientes</th><th className="num">En Catastro</th><th className="num">Aceptados</th><th>Avance</th></tr></thead>
          <tbody>
            {i.porBarrio.map((b) => (
              <tr key={b.nombre}>
                <td>{b.nombre}</td>
                <td className="num">{n(b.total)}</td>
                <td className="num">{n(b.enCatastro)}</td>
                <td className="num">{n(b.aceptados)}</td>
                <td><span className="barra"><i style={{ width: `${b.avance}%` }} /></span>{b.avance} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Por ley</h2>
        <table>
          <thead><tr><th>Ley</th><th className="num">Expedientes</th><th className="num">Aceptados</th></tr></thead>
          <tbody>{i.porLey.map((l) => <tr key={l.nombre}><td>{l.nombre}</td><td className="num">{n(l.total)}</td><td className="num">{n(l.aceptados)}</td></tr>)}</tbody>
        </table>
        {(i.tiempos.aperturaAPresentacion !== null || i.tiempos.presentacionAAceptacion !== null) && (
          <p className="nota">
            Tiempos típicos (mediana): {i.tiempos.aperturaAPresentacion !== null ? `${n(i.tiempos.aperturaAPresentacion)} días desde que se abre un expediente hasta que se presenta en Catastro` : ''}
            {i.tiempos.aperturaAPresentacion !== null && i.tiempos.presentacionAAceptacion !== null ? '; ' : ''}
            {i.tiempos.presentacionAAceptacion !== null ? `${n(i.tiempos.presentacionAAceptacion)} días desde la presentación hasta la aceptación` : ''}.
          </p>
        )}
      </section>

      <section>
        <h2>Observaciones de Catastro en curso</h2>
        {plazos.length === 0 ? <p>No hay observaciones abiertas.</p> : (
          <table>
            <thead><tr><th>Expediente</th><th>Barrio</th><th>Plazo</th></tr></thead>
            <tbody>
              {plazos.slice(0, 15).map((p) => (
                <tr key={p.numero}>
                  <td>{p.numero}</td>
                  <td>{p.barrio}</td>
                  <td className={p.dias < 0 ? 'rojo' : undefined}>{p.dias < 0 ? `Vencido hace ${p.dias * -1} día(s)` : p.dias === 0 ? 'Vence hoy' : `Faltan ${p.dias} día(s)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {plazos.length > 15 && <p className="nota">Y {plazos.length - 15} más.</p>}
      </section>

      <div className="pie">Generado por el sistema de Regularización Dominial el {props.fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} por {props.generadoPor}. Los datos son los cargados en el sistema a ese momento.</div>
    </div>
  )
}

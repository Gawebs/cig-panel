/**
 * Pruebas de seguridad contra la base LOCAL (supabase start + scripts/semilla-local.mjs).
 * Verifican que las reglas de acceso las impone la base, no la pantalla.
 * Si la base local no está levantada, se saltean.
 */
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const env = (() => {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    ) as Record<string, string>
  } catch {
    return {} as Record<string, string>
  }
})()

const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const esLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(URL)
const baseArriba = esLocal && (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }).then((r) => r.ok).catch(() => false))

async function sesion(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: env.SEMILLA_CLAVE_PRUEBA })
  if (error) throw new Error(`${email}: ${error.message}`)
  return c
}

describe.skipIf(!baseArriba)('Reglas de acceso en la base', () => {
  let armado: SupabaseClient, subdir: SupabaseClient, direccion: SupabaseClient
  let consulta: SupabaseClient, comuna: SupabaseClient, anonimo: SupabaseClient
  let brsId: string, comunaId: string, expId: string

  beforeAll(async () => {
    ;[armado, subdir, direccion, consulta, comuna] = await Promise.all([
      sesion('armado@prueba.local'),
      sesion('subdireccion@prueba.local'),
      sesion('direccion@prueba.local'),
      sesion('consulta@prueba.local'),
      sesion('comuna@prueba.local'),
    ])
    anonimo = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    brsId = (await armado.from('municipalities').select('id').eq('slug', 'brs-prueba').single()).data!.id
    comunaId = (await comuna.from('municipalities').select('id').eq('slug', 'comuna-prueba').single()).data!.id
  })

  it('armado abre un expediente y recibe número correlativo', async () => {
    const { data: u } = await armado.auth.getUser()
    const { data, error } = await armado
      .from('case_files')
      .insert({ municipality_id: brsId, framework_id: 'ley_pierri', padron: '123456', created_by: u.user!.id })
      .select('id, numero_interno, estado')
      .single()
    expect(error).toBeNull()
    expect(data!.numero_interno).toMatch(/^BRS-\d{4}-\d{4}$/)
    expect(data!.estado).toBe('en_armado')
    expidSet(data!.id)
  })

  function expidSet(id: string) {
    expId = id
  }

  it('otro municipio no ve el expediente', async () => {
    const { data } = await comuna.from('case_files').select('id').eq('id', expId)
    expect(data).toEqual([])
    const { data: munis } = await comuna.from('municipalities').select('slug')
    expect(munis!.map((m) => m.slug)).toEqual(['comuna-prueba'])
  })

  it('un visitante sin sesión no ve nada', async () => {
    const { data } = await anonimo.from('case_files').select('id')
    expect(data ?? []).toEqual([])
    const { data: personas } = await anonimo.from('case_people').select('id')
    expect(personas ?? []).toEqual([])
  })

  it('otro municipio no puede cargar personas en el expediente', async () => {
    const { error } = await comuna.from('case_people').insert({ case_file_id: expId, rol: 'solicitante', apellido: 'X' })
    expect(error).not.toBeNull()
  })

  it('consulta no puede abrir expedientes', async () => {
    const { data: u } = await consulta.auth.getUser()
    const { error } = await consulta
      .from('case_files')
      .insert({ municipality_id: brsId, framework_id: 'ley_pierri', created_by: u.user!.id })
    expect(error).not.toBeNull()
  })

  it('una comuna no puede usar una ley que no tiene activada', async () => {
    const { data: u } = await comuna.auth.getUser()
    const { error } = await comuna
      .from('case_files')
      .insert({ municipality_id: comunaId, framework_id: 'ley_5670', created_by: u.user!.id })
    expect(error).not.toBeNull()
  })

  it('no se puede abrir un expediente a nombre de otro usuario', async () => {
    const { data: otro } = await subdir.auth.getUser()
    const { error } = await armado
      .from('case_files')
      .insert({ municipality_id: brsId, framework_id: 'ley_pierri', created_by: otro.user!.id })
    expect(error).not.toBeNull()
  })

  it('el estado no se cambia con un update común', async () => {
    const { error } = await subdir.from('case_files').update({ estado: 'aprobado' }).eq('id', expId)
    expect(error?.message).toMatch(/estado solo se cambia/)
  })

  it('recorrido de estados respeta los roles', async () => {
    // armado no puede aprobar
    expect((await armado.rpc('cambiar_estado', { p_case: expId, p_estado: 'aprobado' })).error).not.toBeNull()
    // armado lo manda a revisar
    expect((await armado.rpc('cambiar_estado', { p_case: expId, p_estado: 'listo_para_revisar' })).error).toBeNull()
    // devolver sin nota no se puede
    expect((await subdir.rpc('cambiar_estado', { p_case: expId, p_estado: 'devuelto' })).error?.message).toMatch(/qué corregir/)
    // subdirección aprueba
    expect((await subdir.rpc('cambiar_estado', { p_case: expId, p_estado: 'aprobado' })).error).toBeNull()
    // subdirección no puede firmar: firma la dirección
    expect((await subdir.rpc('cambiar_estado', { p_case: expId, p_estado: 'firmado' })).error).not.toBeNull()
    // la Dirección sube el PDF firmado de cada paso
    for (const paso of [1, 2, 3, 4]) {
      const { error } = await direccion.from('case_documents').insert({ case_file_id: expId, paso, requisito: 'pdf_firmado', firmado: true, origen: 'firmado' })
      expect(error).toBeNull()
    }
    expect((await direccion.rpc('cambiar_estado', { p_case: expId, p_estado: 'firmado' })).error).toBeNull()
    // una vez firmado, armado ya no puede editar datos
    const { data: editado } = await armado.from('case_files').update({ padron: '999' }).eq('id', expId).select('id')
    expect(editado).toEqual([])
    // queda historial
    const { data: eventos } = await consulta.from('case_events').select('a_estado').eq('case_file_id', expId).order('created_at')
    expect(eventos!.map((e) => e.a_estado)).toEqual(['en_armado', 'listo_para_revisar', 'aprobado', 'firmado'])
  })

  it('nadie puede escribir ni borrar el historial y la auditoría', async () => {
    const { error: e1 } = await direccion.from('audit_log').insert({ tabla: 'x', registro_id: '1', accion: 'INSERT' })
    expect(e1).not.toBeNull()
    await direccion.from('case_events').delete().eq('case_file_id', expId)
    const { count } = await direccion.from('case_events').select('id', { count: 'exact', head: true }).eq('case_file_id', expId)
    expect(count).toBe(4)
    const { data: auditoria } = await direccion.from('audit_log').select('tabla').eq('registro_id', expId)
    expect(auditoria!.length).toBeGreaterThan(0)
  })

  describe('Archivos privados', () => {
    let expAbierto: string
    const pdf = new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' })

    beforeAll(async () => {
      const { data } = await armado.rpc('abrir_expediente', {
        p_municipality: brsId, p_framework: 'ley_pierri', p_padron: '', p_titular: { apellido: 'Archivos' },
      })
      expAbierto = data as string
    })

    it('armado sube un archivo a su expediente', async () => {
      const { error } = await armado.storage.from('expedientes').upload(`${brsId}/${expAbierto}/prueba.pdf`, pdf)
      expect(error).toBeNull()
    })

    it('otro municipio no puede ver ni subir archivos de ese expediente', async () => {
      const { data } = await comuna.storage.from('expedientes').download(`${brsId}/${expAbierto}/prueba.pdf`)
      expect(data).toBeNull()
      const { error } = await comuna.storage.from('expedientes').upload(`${brsId}/${expAbierto}/intruso.pdf`, pdf)
      expect(error).not.toBeNull()
    })

    it('no se puede subir con una ruta que mezcla municipio y expediente', async () => {
      const { error } = await comuna.storage.from('expedientes').upload(`${comunaId}/${expAbierto}/truco.pdf`, pdf)
      expect(error).not.toBeNull()
    })

    it('sin sesión no se baja nada', async () => {
      const { data } = await anonimo.storage.from('expedientes').download(`${brsId}/${expAbierto}/prueba.pdf`)
      expect(data).toBeNull()
    })

    it('consulta puede ver pero no subir', async () => {
      const { data } = await consulta.storage.from('expedientes').download(`${brsId}/${expAbierto}/prueba.pdf`)
      expect(data).not.toBeNull()
      const { error } = await consulta.storage.from('expedientes').upload(`${brsId}/${expAbierto}/consulta.pdf`, pdf)
      expect(error).not.toBeNull()
    })

    it('el expediente firmado ya no acepta archivos nuevos', async () => {
      // El expediente del recorrido de estados quedó firmado
      const { error } = await armado.storage.from('expedientes').upload(`${brsId}/${expId}/tarde.pdf`, pdf)
      expect(error).not.toBeNull()
    })
  })

  describe('Relevamiento y audios', () => {
    let expRel: string
    const relId = crypto.randomUUID()
    const audio = new Blob(['audio de prueba'], { type: 'audio/webm' })

    beforeAll(async () => {
      const { data } = await armado.rpc('abrir_expediente', {
        p_municipality: brsId, p_framework: 'ley_pierri', p_padron: '', p_titular: { apellido: 'Relevamiento' },
      })
      expRel = data as string
    })

    it('el relevador guarda el relevamiento a su nombre', async () => {
      const { data: u } = await armado.auth.getUser()
      const { error } = await armado.from('field_surveys').insert({ id: relId, case_file_id: expRel, relevador: u.user!.id, respuestas: { 'titular.ocupacion': { texto: 'albañil', origen: 'voz' } } })
      expect(error).toBeNull()
    })

    it('no se puede cargar un relevamiento a nombre de otro', async () => {
      const { data: otro } = await subdir.auth.getUser()
      const { error } = await armado.from('field_surveys').insert({ id: crypto.randomUUID(), case_file_id: expId, relevador: otro.user!.id })
      expect(error).not.toBeNull()
    })

    it('otro municipio no ve ni toca el relevamiento', async () => {
      const { data } = await comuna.from('field_surveys').select('id').eq('id', relId)
      expect(data).toEqual([])
      const { data: editado } = await comuna.from('field_surveys').update({ estado: 'completo' }).eq('id', relId).select('id')
      expect(editado ?? []).toEqual([])
    })

    it('consulta lo ve pero no lo cambia', async () => {
      const { data } = await consulta.from('field_surveys').select('id').eq('id', relId)
      expect(data).toHaveLength(1)
      const { data: editado } = await consulta.from('field_surveys').update({ estado: 'completo' }).eq('id', relId).select('id')
      expect(editado ?? []).toEqual([])
    })

    it('nadie puede borrar un relevamiento', async () => {
      await direccion.from('field_surveys').delete().eq('id', relId)
      const { data } = await direccion.from('field_surveys').select('id').eq('id', relId)
      expect(data).toHaveLength(1)
    })

    it('los audios son privados del municipio y no se pueden pisar ni borrar', async () => {
      const ruta = `${brsId}/${expRel}/audio-prueba.webm`
      expect((await armado.storage.from('audios').upload(ruta, audio, { contentType: 'audio/webm' })).error).toBeNull()
      expect((await comuna.storage.from('audios').download(ruta)).data).toBeNull()
      expect((await anonimo.storage.from('audios').download(ruta)).data).toBeNull()
      expect((await consulta.storage.from('audios').upload(`${brsId}/${expRel}/consulta.webm`, audio, { contentType: 'audio/webm' })).error).not.toBeNull()
      expect((await armado.storage.from('audios').upload(ruta, audio, { contentType: 'audio/webm', upsert: true })).error).not.toBeNull()
      await armado.storage.from('audios').remove([ruta])
      expect((await consulta.storage.from('audios').download(ruta)).data).not.toBeNull()
    })

    it('en el depósito de audios no entra otra cosa', async () => {
      const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
      const { error } = await armado.storage.from('audios').upload(`${brsId}/${expRel}/x.pdf`, pdf, { contentType: 'application/pdf' })
      expect(error).not.toBeNull()
    })
  })

  describe('Firma, presentación y observaciones de Catastro', () => {
    let exp: string
    // PDF con diccionario de firma (para la prueba no hace falta un certificado real)
    const firmado = new Blob(['%PDF-1.7\n<< /Type /Sig /SubFilter /adbe.pkcs7.detached /ByteRange [0 10 20 30] /Contents <00> >>\n%%EOF'], { type: 'application/pdf' })

    beforeAll(async () => {
      const { data } = await armado.rpc('abrir_expediente', {
        p_municipality: brsId, p_framework: 'ley_pierri', p_padron: '', p_titular: { apellido: 'Firma' },
      })
      exp = data as string
      await armado.rpc('cambiar_estado', { p_case: exp, p_estado: 'listo_para_revisar' })
      await subdir.rpc('cambiar_estado', { p_case: exp, p_estado: 'aprobado' })
    })

    async function subirFirmado(cliente: SupabaseClient, paso: number) {
      const ruta = `${brsId}/${exp}/firmado-P${paso}-${crypto.randomUUID().slice(0, 6)}.pdf`
      const s = await cliente.storage.from('expedientes').upload(ruta, firmado, { contentType: 'application/pdf' })
      if (s.error) return s.error
      const d = await cliente.from('case_documents').insert({ case_file_id: exp, paso, requisito: 'pdf_firmado', storage_path: ruta, firmado: true, origen: 'firmado' })
      return d.error
    }

    it('solo la Dirección sube los PDF firmados', async () => {
      expect(await subirFirmado(subdir, 1)).not.toBeNull()
      expect(await subirFirmado(armado, 1)).not.toBeNull()
      expect(await subirFirmado(direccion, 1)).toBeNull()
    })

    it('no se puede marcar como firmado sin los 4 pasos firmados', async () => {
      const { error } = await direccion.rpc('cambiar_estado', { p_case: exp, p_estado: 'firmado' })
      expect(error?.message).toMatch(/Falta el PDF firmado de los pasos: 2, 3, 4/)
      for (const p of [2, 3, 4]) expect(await subirFirmado(direccion, p)).toBeNull()
      expect((await direccion.rpc('cambiar_estado', { p_case: exp, p_estado: 'firmado' })).error).toBeNull()
    })

    it('presentar pide el número de Catastro y solo lo hace subdirección o dirección', async () => {
      expect((await armado.rpc('registrar_presentacion', { p_case: exp, p_numero: 'X', p_fecha: '2026-11-13' })).error).not.toBeNull()
      expect((await subdir.rpc('registrar_presentacion', { p_case: exp, p_numero: '', p_fecha: '2026-11-13' })).error?.message).toMatch(/número de expediente/)
      expect((await subdir.rpc('registrar_presentacion', { p_case: exp, p_numero: 'EXP-123/2026', p_fecha: '2026-11-13' })).error).toBeNull()
      const { data } = await consulta.from('case_files').select('estado, numero_expediente_catastro').eq('id', exp).single()
      expect(data).toEqual({ estado: 'presentado', numero_expediente_catastro: 'EXP-123/2026' })
    })

    it('la observación calcula el vencimiento en días hábiles y el reingreso la cierra', async () => {
      expect((await subdir.rpc('registrar_observacion', { p_case: exp, p_recibida: '2026-11-13', p_texto: 'Falta acta de nacimiento' })).error).toBeNull()
      const { data: obs } = await consulta.from('catastro_observations').select('vence_el, estado').eq('case_file_id', exp).single()
      expect(obs).toEqual({ vence_el: '2026-11-30', estado: 'abierta' }) // 23/11 es feriado
      expect((await subdir.rpc('registrar_prorroga', { p_case: exp, p_hasta: null })).error).toBeNull()
      expect((await subdir.rpc('registrar_reingreso', { p_case: exp, p_fecha: '2026-11-13' })).error).toBeNull()
      const { data: despues } = await consulta.from('catastro_observations').select('estado').eq('case_file_id', exp).single()
      expect(despues!.estado).toBe('respondida')
      const { data: e } = await consulta.from('case_files').select('estado').eq('id', exp).single()
      expect(e!.estado).toBe('reingresado')
    })

    it('nadie escribe observaciones directo en la tabla', async () => {
      const { error } = await direccion.from('catastro_observations').insert({
        case_file_id: exp, municipality_id: brsId, recibida_el: '2026-11-13', texto: 'x', plazo_dias: 10, plazo_tipo: 'corridos', vence_el: '2026-11-23',
      })
      expect(error).not.toBeNull()
    })

    it('otro municipio no ve las observaciones', async () => {
      const { data } = await comuna.from('catastro_observations').select('id').eq('case_file_id', exp)
      expect(data).toEqual([])
    })
  })

  describe('Constancias de tenencia precaria', () => {
    let constanciaId: string
    it('se numeran solas por municipio y año', async () => {
      const { data, error } = await armado.from('tenure_certificates').insert({ municipality_id: brsId, vecino_nombre: 'Pérez Ana', dni: '30111222' }).select('id, numero').single()
      expect(error).toBeNull()
      expect(data!.numero).toMatch(/^CR-\d{4}-\d{4}$/)
      constanciaId = data!.id
    })
    it('otro municipio no la ve ni la toca', async () => {
      expect((await comuna.from('tenure_certificates').select('id').eq('id', constanciaId)).data).toEqual([])
      expect((await comuna.from('tenure_certificates').update({ estado: 'listo' }).eq('id', constanciaId).select('id')).data ?? []).toEqual([])
    })
    it('consulta la ve pero no la cambia; armado no la borra', async () => {
      expect((await consulta.from('tenure_certificates').update({ estado: 'listo' }).eq('id', constanciaId).select('id')).data ?? []).toEqual([])
      await armado.from('tenure_certificates').delete().eq('id', constanciaId)
      expect((await consulta.from('tenure_certificates').select('id').eq('id', constanciaId)).data).toHaveLength(1)
    })
    it('el número no se puede cambiar', async () => {
      const { error } = await armado.from('tenure_certificates').update({ numero: 'CR-1999-0001' }).eq('id', constanciaId)
      expect(error).not.toBeNull()
    })
    it('los archivos de la constancia son privados del municipio', async () => {
      const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
      const ruta = `${brsId}/${constanciaId}/archivo.pdf`
      expect((await armado.storage.from('constancias').upload(ruta, pdf, { contentType: 'application/pdf' })).error).toBeNull()
      expect((await comuna.storage.from('constancias').download(ruta)).data).toBeNull()
      expect((await anonimo.storage.from('constancias').download(ruta)).data).toBeNull()
    })
  })

  describe('Endurecimiento antes del lanzamiento', () => {
    it('nadie se puede registrar solo', async () => {
      const { error } = await anonimo.auth.signUp({ email: `intruso-${Date.now()}@prueba.local`, password: 'Intruso12345' })
      expect(error).not.toBeNull()
    })
    it('un visitante sin sesión no puede llamar funciones internas', async () => {
      expect((await anonimo.rpc('es_miembro', { p_municipality: brsId })).error).not.toBeNull()
      expect((await anonimo.rpc('sumar_dias', { p_desde: '2026-11-13', p_dias: 1, p_tipo: 'corridos' })).error).not.toBeNull()
    })
    it('un documento cargado no se modifica', async () => {
      const { data: doc } = await armado.from('case_documents').select('id').eq('firmado', false).limit(1).maybeSingle()
      if (!doc) return
      const { data } = await direccion.from('case_documents').update({ firmado: true }).eq('id', doc.id).select('id')
      expect(data ?? []).toEqual([])
      const { data: igual } = await consulta.from('case_documents').select('firmado').eq('id', doc.id).single()
      expect(igual!.firmado).toBe(false)
    })
  })

  it('el personal de armado no ve la auditoría', async () => {
    const { data } = await armado.from('audit_log').select('id')
    expect(data).toEqual([])
  })
})

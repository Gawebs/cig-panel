export type EstadoExpediente =
  | 'en_armado' | 'listo_para_revisar' | 'devuelto' | 'aprobado' | 'firmado'
  | 'presentado' | 'observado' | 'reingresado' | 'prorroga_pedida' | 'aceptado'
  | 'desistido' | 'archivado'

export type RolUsuario = 'direccion' | 'subdireccion' | 'armado' | 'relevamiento' | 'consulta'

type Tono = 'tramite' | 'atencion' | 'ok' | 'alerta' | 'neutro'

export const ESTADOS: Record<EstadoExpediente, { texto: string; tono: Tono }> = {
  en_armado: { texto: 'En armado', tono: 'tramite' },
  listo_para_revisar: { texto: 'Listo para revisar', tono: 'atencion' },
  devuelto: { texto: 'Devuelto para corregir', tono: 'alerta' },
  aprobado: { texto: 'Aprobado, falta firma', tono: 'atencion' },
  firmado: { texto: 'Firmado, listo para Catastro', tono: 'ok' },
  presentado: { texto: 'Presentado en Catastro', tono: 'tramite' },
  observado: { texto: 'Observado por Catastro', tono: 'alerta' },
  reingresado: { texto: 'Reingresado', tono: 'tramite' },
  prorroga_pedida: { texto: 'Prórroga pedida', tono: 'atencion' },
  aceptado: { texto: 'Aceptado por Catastro', tono: 'ok' },
  desistido: { texto: 'Desistido', tono: 'neutro' },
  archivado: { texto: 'Archivado', tono: 'neutro' },
}

export const TONOS: Record<Tono, string> = {
  tramite: 'bg-azul-suave text-azul',
  atencion: 'bg-aviso-suave text-aviso',
  ok: 'bg-ok-suave text-ok',
  alerta: 'bg-error-suave text-error',
  neutro: 'bg-linea text-tenue',
}

export const ROLES: Record<RolUsuario, string> = {
  direccion: 'Dirección',
  subdireccion: 'Subdirección',
  armado: 'Atención y armado',
  relevamiento: 'Relevamiento',
  consulta: 'Consulta',
}

export const ESTADOS_CIVILES = [
  { valor: 'soltero', texto: 'Soltero/a' },
  { valor: 'casado', texto: 'Casado/a' },
  { valor: 'conviviente', texto: 'Unión convivencial' },
  { valor: 'divorciado', texto: 'Divorciado/a' },
  { valor: 'viudo', texto: 'Viudo/a' },
] as const

export const ROLES_PERSONA = {
  solicitante: 'Solicitante',
  conyuge: 'Cónyuge o conviviente',
  grupo_familiar: 'Grupo familiar',
} as const

/**
 * Acciones de cambio de estado que ofrece la pantalla.
 * La base vuelve a validar transición y rol (función cambiar_estado).
 */
export const ACCIONES: {
  desde: EstadoExpediente[]
  hacia: EstadoExpediente
  texto: string
  roles: RolUsuario[]
  pideNota?: boolean
  /** Pregunta que se muestra arriba de la nota. */
  preguntaNota?: string
  principal?: boolean
}[] = [
  { desde: ['en_armado', 'devuelto'], hacia: 'listo_para_revisar', texto: 'Enviar a revisión', roles: ['armado', 'subdireccion', 'direccion'], principal: true },
  { desde: ['listo_para_revisar'], hacia: 'aprobado', texto: 'Aprobar', roles: ['subdireccion', 'direccion'], principal: true },
  { desde: ['listo_para_revisar', 'aprobado'], hacia: 'devuelto', texto: 'Devolver con nota', roles: ['subdireccion', 'direccion'], pideNota: true, preguntaNota: '¿Qué hay que corregir en el expediente?' },
  { desde: ['aprobado'], hacia: 'firmado', texto: 'Marcar como firmado', roles: ['direccion'], principal: true },
  // Presentación, observación, prórroga y reingreso se registran en la sección "Firma y presentación en Catastro" de la ficha.
  { desde: ['presentado', 'reingresado', 'prorroga_pedida'], hacia: 'aceptado', texto: 'Catastro lo aceptó', roles: ['subdireccion', 'direccion'] },
  { desde: ['en_armado', 'devuelto', 'listo_para_revisar', 'aprobado', 'firmado', 'presentado', 'observado', 'reingresado', 'prorroga_pedida'], hacia: 'desistido', texto: 'El vecino desistió', roles: ['subdireccion', 'direccion'], pideNota: true, preguntaNota: '¿Por qué desistió el vecino?' },
]

/** Estados de las constancias de tenencia precaria (los mismos del panel anterior). */
export const ESTADOS_CONSTANCIA = {
  pendiente: { texto: 'Pendiente', tono: 'atencion' },
  notificado: { texto: 'Notificado', tono: 'tramite' },
  visitado: { texto: 'Visitado', tono: 'tramite' },
  listo: { texto: 'Listo para imprimir', tono: 'ok' },
  entregado: { texto: 'Entregado', tono: 'neutro' },
} as const satisfies Record<string, { texto: string; tono: Tono }>

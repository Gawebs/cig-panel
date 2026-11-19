/**
 * Leyes que son de un solo barrio: el barrio (y con él la localidad) se pone solo.
 * Se puede cambiar a mano en Inmueble; solo se completa cuando está vacío.
 */
const BARRIO_DE_LA_LEY: Record<string, string> = {
  ley_5670: 'La Milagrosa',
  ley_8162: 'Presidente Menem',
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Busca en los barrios del municipio el que corresponde a la ley. Puro. */
export function barrioDeLaLey<T extends { nombre: string }>(frameworkId: string, barrios: T[]): T | undefined {
  const nombre = BARRIO_DE_LA_LEY[frameworkId]
  if (!nombre) return undefined
  return barrios.find((b) => normal(b.nombre) === normal(nombre))
}

type Cliente = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Si el expediente no tiene barrio y la ley es de un solo barrio, lo guarda junto con su localidad.
 * Devuelve lo que guardó (o null). Se usa eso y no una segunda lectura: Next.js repite la primera dentro de la misma carga. Si el expediente ya no se puede editar, la base no deja y no pasa nada.
 */
export async function completarBarrioDeLaLey(
  supabase: Cliente,
  exp: { id: string; framework_id: string; municipality_id: string; neighborhood_id: string | null; locality_id: string | null },
): Promise<{ neighborhood_id: string; locality_id: string | null } | null> {
  if (exp.neighborhood_id || !BARRIO_DE_LA_LEY[exp.framework_id]) return null
  const { data: barrios } = await supabase.from('neighborhoods').select('id, nombre, locality_id').eq('municipality_id', exp.municipality_id)
  const barrio = barrioDeLaLey(exp.framework_id, (barrios ?? []) as { id: string; nombre: string; locality_id: string | null }[])
  if (!barrio) return null
  const cambios = { neighborhood_id: barrio.id, locality_id: exp.locality_id ?? barrio.locality_id }
  const { data } = await supabase
    .from('case_files')
    .update(cambios)
    .eq('id', exp.id)
    .is('neighborhood_id', null)
    .select('id')
  return data?.length ? cambios : null
}

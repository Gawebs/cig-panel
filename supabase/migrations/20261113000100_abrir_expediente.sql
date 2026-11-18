-- Abrir un expediente con su titular en un solo paso (transacción).
-- security invoker: corre con la sesión del usuario, así que las reglas de acceso aplican igual.
create or replace function public.abrir_expediente(
  p_municipality uuid,
  p_framework text,
  p_padron text,
  p_titular jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_titular ->> 'apellido'), '') = '' then
    raise exception 'Falta el apellido del titular';
  end if;

  insert into public.case_files (municipality_id, framework_id, padron, created_by)
    values (p_municipality, p_framework, nullif(btrim(p_padron), ''), auth.uid())
    returning id into v_id;

  insert into public.case_people (case_file_id, rol, solicitante_numero, orden, apellido, nombre, dni, estado_civil)
    values (
      v_id, 'solicitante', 1, 1,
      btrim(p_titular ->> 'apellido'),
      coalesce(btrim(p_titular ->> 'nombre'), ''),
      nullif(btrim(p_titular ->> 'dni'), ''),
      nullif(p_titular ->> 'estado_civil', '')
    );

  return v_id;
end $$;

revoke all on function public.abrir_expediente(uuid, text, text, jsonb) from public, anon;
grant execute on function public.abrir_expediente(uuid, text, text, jsonb) to authenticated;

-- Aviso de duplicados: otros expedientes del mismo municipio con el mismo padrón o DNI.
create or replace function public.buscar_duplicados(p_municipality uuid, p_padron text, p_dni text, p_excluir uuid default null)
returns table (case_file_id uuid, numero_interno text, motivo text)
language sql stable security invoker set search_path = public as $$
  select c.id, c.numero_interno, 'padrón' from public.case_files c
   where c.municipality_id = p_municipality and nullif(btrim(p_padron), '') is not null
     and c.padron = btrim(p_padron) and c.id is distinct from p_excluir
     and c.estado not in ('desistido', 'archivado')
  union
  select c.id, c.numero_interno, 'DNI' from public.case_files c
   join public.case_people p on p.case_file_id = c.id
   where c.municipality_id = p_municipality and nullif(btrim(p_dni), '') is not null
     and p.dni = btrim(p_dni) and c.id is distinct from p_excluir
     and c.estado not in ('desistido', 'archivado');
$$;

grant execute on function public.buscar_duplicados(uuid, text, text, uuid) to authenticated;

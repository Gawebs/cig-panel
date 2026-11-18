-- Abrir expediente: el titular puede venir con todos los datos leídos del DNI.
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

  insert into public.case_people (
    case_file_id, rol, solicitante_numero, orden, apellido, nombre, dni, cuil, sexo,
    fecha_nacimiento, domicilio, estado_civil, origen_datos
  ) values (
    v_id, 'solicitante', 1, 1,
    btrim(p_titular ->> 'apellido'),
    coalesce(btrim(p_titular ->> 'nombre'), ''),
    nullif(btrim(p_titular ->> 'dni'), ''),
    nullif(btrim(p_titular ->> 'cuil'), ''),
    nullif(p_titular ->> 'sexo', ''),
    nullif(p_titular ->> 'fecha_nacimiento', '')::date,
    nullif(btrim(p_titular ->> 'domicilio'), ''),
    nullif(p_titular ->> 'estado_civil', ''),
    coalesce(p_titular -> 'origen_datos', '{}'::jsonb)
  );

  return v_id;
end $$;

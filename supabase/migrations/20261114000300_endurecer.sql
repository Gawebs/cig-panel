-- Revisión de seguridad antes del lanzamiento.

-- 1. Las funciones internas no se pueden llamar sin sesión (los visitantes anónimos no las necesitan).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
-- Las que se creen más adelante tampoco quedan abiertas.
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. El relevamiento queda a nombre de quien lo hizo y en su expediente: no se pueden cambiar después.
create or replace function public.proteger_relevamiento()
returns trigger language plpgsql as $$
begin
  if new.relevador <> old.relevador or new.case_file_id <> old.case_file_id then
    raise exception 'El relevador y el expediente de un relevamiento no se pueden cambiar';
  end if;
  return new;
end $$;
create trigger proteger_field_surveys before update on public.field_surveys
  for each row execute function public.proteger_relevamiento();

-- 3. Un documento firmado no se modifica (tampoco por la Dirección): se reemplaza subiendo otro.
create or replace function public.proteger_documento()
returns trigger language plpgsql as $$
begin
  raise exception 'Los documentos no se modifican: se quitan y se vuelven a cargar';
end $$;
create trigger proteger_case_documents before update on public.case_documents
  for each row execute function public.proteger_documento();

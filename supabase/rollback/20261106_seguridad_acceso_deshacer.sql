-- Deshace 20261106010000_seguridad_acceso.sql y vuelve a dejar la base como estaba antes del 06-nov-2026
-- (abierta al público). Usar solo si el panel nuevo falla y hay que volver a la versión anterior del panel.
-- No borra la columna password_pbkdf2 ni la tabla de intentos, porque no molestan.

begin;

do $$
declare t text;
begin
  foreach t in array array['expedientes','expediente_planos','certificados_residencia','certificado_residencia_archivos','panel_accesos','usuarios'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sesion', t);
  end loop;
end $$;

alter table public.certificados_residencia disable row level security;
alter table public.certificado_residencia_archivos disable row level security;
alter table public.panel_accesos disable row level security;
alter table public.usuarios disable row level security;

create policy expedientes_select_public on public.expedientes for select using (true);
create policy expedientes_insert_public on public.expedientes for insert with check (true);
create policy expedientes_update_public on public.expedientes for update using (true);
create policy expedientes_delete_public on public.expedientes for delete using (true);
create policy expediente_planos_select_public on public.expediente_planos for select using (true);
create policy expediente_planos_insert_public on public.expediente_planos for insert with check (true);
create policy expediente_planos_update_public on public.expediente_planos for update using (true);
create policy expediente_planos_delete_public on public.expediente_planos for delete using (true);
create policy "Enable read access for all users" on public.panel_usuarios for select using (true);
create policy panel_usuarios_select_authenticated on public.panel_usuarios for select to authenticated using (activo = true);

update storage.buckets set public = true where id = 'planos-expedientes';
drop policy if exists planos_sesion_select on storage.objects;
drop policy if exists planos_sesion_insert on storage.objects;
drop policy if exists planos_sesion_update on storage.objects;
drop policy if exists planos_sesion_delete on storage.objects;
create policy "allow read planos" on storage.objects for select using (bucket_id = 'planos-expedientes');
create policy "allow upload planos" on storage.objects for insert with check (bucket_id = 'planos-expedientes');
create policy "allow delete planos" on storage.objects for delete using (bucket_id = 'planos-expedientes');

commit;

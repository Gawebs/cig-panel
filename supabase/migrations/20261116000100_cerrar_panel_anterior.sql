-- Reemplazo del panel anterior de Banda del Río Salí (cig-panel).
-- Sus tablas y archivos quedan guardados en la base, sin borrar nada, pero dejan de estar abiertos a
-- cualquier sesión: solo soporte puede verlos. Así ningún usuario del sistema nuevo (de este u otro
-- municipio) puede leer, cambiar ni borrar esos datos.
-- En una base que no tiene el panel anterior, esta migración no hace nada.
--
-- Para volver atrás (reabrir el panel anterior), recrear las políticas originales:
--   create policy <tabla>_sesion on public.<tabla> for all to authenticated using (true) with check (true);
--   y las de storage planos_sesion_select/insert/update/delete para el bucket planos-expedientes.

do $$
declare
  v_tabla text;
  v_politica record;
begin
  foreach v_tabla in array array[
    'expedientes', 'expediente_planos', 'certificados_residencia', 'certificado_residencia_archivos',
    'usuarios', 'panel_accesos', 'panel_auditoria'
  ] loop
    if to_regclass('public.' || v_tabla) is null then continue; end if;
    for v_politica in select policyname from pg_policies where schemaname = 'public' and tablename = v_tabla loop
      execute format('drop policy %I on public.%I', v_politica.policyname, v_tabla);
    end loop;
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format(
      'create policy "solo soporte (panel anterior)" on public.%I for all to authenticated using (public.es_admin_plataforma()) with check (public.es_admin_plataforma())',
      v_tabla
    );
  end loop;

  if exists (select 1 from storage.buckets where id = 'planos-expedientes') then
    drop policy if exists planos_sesion_select on storage.objects;
    drop policy if exists planos_sesion_insert on storage.objects;
    drop policy if exists planos_sesion_update on storage.objects;
    drop policy if exists planos_sesion_delete on storage.objects;
    create policy "panel anterior: solo soporte" on storage.objects for all to authenticated
      using (bucket_id = 'planos-expedientes' and public.es_admin_plataforma())
      with check (bucket_id = 'planos-expedientes' and public.es_admin_plataforma());
  end if;
end $$;

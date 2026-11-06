-- Seguridad de acceso del CIG (06-nov-2026).
-- Antes: cualquiera con la clave pública de la página podía leer, modificar y borrar
-- expedientes, constancias y archivos, y leer los códigos de las contraseñas.
-- Ahora: solo una sesión iniciada con la función `panel-login` accede a los datos.
-- Para deshacer: supabase/rollback/20261106_seguridad_acceso_deshacer.sql

begin;

-- 1. Contraseñas: columna nueva con PBKDF2 (la vieja `password_hash` queda sin uso)
alter table public.panel_usuarios add column if not exists password_pbkdf2 text;

-- 2. Registro de intentos de ingreso (para frenar intentos repetidos)
create table if not exists public.panel_login_intentos (
  id bigint generated always as identity primary key,
  usuario_clave text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists panel_login_intentos_clave_fecha on public.panel_login_intentos (usuario_clave, created_at desc);
alter table public.panel_login_intentos enable row level security;

-- 3. Sacar todas las reglas abiertas al público
drop policy if exists expedientes_select_public on public.expedientes;
drop policy if exists expedientes_insert_public on public.expedientes;
drop policy if exists expedientes_update_public on public.expedientes;
drop policy if exists expedientes_delete_public on public.expedientes;
drop policy if exists expediente_planos_select_public on public.expediente_planos;
drop policy if exists expediente_planos_insert_public on public.expediente_planos;
drop policy if exists expediente_planos_update_public on public.expediente_planos;
drop policy if exists expediente_planos_delete_public on public.expediente_planos;
drop policy if exists "Enable read access for all users" on public.panel_usuarios;
drop policy if exists panel_usuarios_select_authenticated on public.panel_usuarios;

-- 4. Función vieja de ingreso: la podía ejecutar cualquiera y registrar contraseñas
drop function if exists public.panel_login_password(text, text);

-- 5. Todas las tablas con reglas activas; las de trabajo, solo para sesiones iniciadas
alter table public.expedientes enable row level security;
alter table public.expediente_planos enable row level security;
alter table public.certificados_residencia enable row level security;
alter table public.certificado_residencia_archivos enable row level security;
alter table public.panel_accesos enable row level security;
alter table public.usuarios enable row level security;
alter table public.panel_usuarios enable row level security;

do $$
declare t text;
begin
  foreach t in array array['expedientes','expediente_planos','certificados_residencia','certificado_residencia_archivos','panel_accesos','usuarios'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sesion', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_sesion', t);
  end loop;
end $$;
-- panel_usuarios y panel_login_intentos: sin reglas para la página; solo la función del servidor las usa.

-- 6. Archivos: carpeta privada, solo sesiones iniciadas
update storage.buckets set public = false where id = 'planos-expedientes';
drop policy if exists "allow read planos" on storage.objects;
drop policy if exists "allow upload planos" on storage.objects;
drop policy if exists "allow delete planos" on storage.objects;
drop policy if exists "planos-expedientes 23u1sc_0" on storage.objects;
drop policy if exists "planos-expedientes 23u1sc_1" on storage.objects;
drop policy if exists "Allow insert planos 23u1sc_0" on storage.objects;
drop policy if exists "Allow read planos 23u1sc_0" on storage.objects;
drop policy if exists planos_sesion_select on storage.objects;
drop policy if exists planos_sesion_insert on storage.objects;
drop policy if exists planos_sesion_update on storage.objects;
drop policy if exists planos_sesion_delete on storage.objects;
create policy planos_sesion_select on storage.objects for select to authenticated using (bucket_id = 'planos-expedientes');
create policy planos_sesion_insert on storage.objects for insert to authenticated with check (bucket_id = 'planos-expedientes');
create policy planos_sesion_update on storage.objects for update to authenticated using (bucket_id = 'planos-expedientes');
create policy planos_sesion_delete on storage.objects for delete to authenticated using (bucket_id = 'planos-expedientes');

commit;

-- Réplica de la estructura actual de producción (06-nov-2026), solo para el entorno local de prueba.
-- NO se aplica en producción: allá estas tablas ya existen.

create table public.usuarios (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  rol text,
  email text,
  created_at timestamptz default now()
);
create table public.panel_usuarios (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid,
  nombre text not null,
  email text,
  rol text default 'Operador'::text not null,
  area text,
  can_edit boolean default false not null,
  activo boolean default true not null,
  tecnico boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  usuario_clave text,
  password_hash text,
  password_set_at timestamptz
);
create table public.panel_accesos (
  id uuid default gen_random_uuid() not null,
  nombre text,
  rol text,
  fecha timestamp default now(),
  fecha_ingreso timestamp default now()
);
create table public.panel_auditoria (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  user_email text,
  accion text not null,
  tabla text,
  registro_id text,
  detalle jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);
create table public.expedientes (
  id bigint not null,
  numero_expediente text not null,
  titular text not null,
  dni text not null,
  barrio text,
  estado text default 'revision_inicial'::text not null,
  subestado text,
  area_actual text,
  responsable_id text,
  documentacion text default 'incompleta'::text,
  dias_sin_avance integer default 0,
  prioridad text default 'baja'::text,
  updated_at date default CURRENT_DATE,
  created_at timestamptz default now(),
  observaciones text,
  proxima_accion text,
  ultima_actualizacion timestamp,
  origen_carga text default 'manual'::text,
  editable_tecnico boolean default true,
  estado_civil text,
  padron_numero text,
  plano_url text,
  notas text,
  telefono text,
  plano_path text,
  direccion text
);
create table public.expediente_planos (
  id uuid default gen_random_uuid() not null,
  expediente_id bigint not null,
  archivo_path text not null,
  nombre_original text,
  tipo_mime text,
  tamano_bytes bigint,
  created_at timestamptz default now(),
  uploaded_by text
);
create table public.certificados_residencia (
  id uuid default gen_random_uuid() not null,
  numero text,
  vecino_nombre text,
  dni text,
  domicilio text,
  barrio text,
  telefono text,
  motivo text,
  estado text default 'pendiente'::text,
  fecha_visita date,
  observaciones text,
  agente_nombre text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  presentado_ante text,
  padron_catastral text,
  matricula_catastral text,
  propietario_legal text
);
create table public.certificado_residencia_archivos (
  id uuid default gen_random_uuid() not null,
  certificado_id uuid,
  archivo_path text not null,
  nombre_original text,
  tipo_mime text,
  tamano_bytes bigint,
  uploaded_by text,
  created_at timestamptz default now()
);
alter table certificado_residencia_archivos add constraint certificado_residencia_archivos_pkey PRIMARY KEY (id);
alter table certificados_residencia add constraint certificados_residencia_pkey PRIMARY KEY (id);
alter table expediente_planos add constraint expediente_planos_pkey PRIMARY KEY (id);
alter table expedientes add constraint expedientes_pkey PRIMARY KEY (id);
alter table panel_accesos add constraint panel_accesos_pkey PRIMARY KEY (id);
alter table panel_auditoria add constraint panel_auditoria_pkey PRIMARY KEY (id);
alter table panel_usuarios add constraint panel_usuarios_pkey PRIMARY KEY (id);
alter table usuarios add constraint usuarios_pkey PRIMARY KEY (id);
alter table certificado_residencia_archivos add constraint certificado_residencia_archivos_certificado_id_fkey FOREIGN KEY (certificado_id) REFERENCES certificados_residencia(id) ON DELETE CASCADE;
alter table expediente_planos add constraint expediente_planos_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE;
alter table expedientes add constraint expedientes_numero_expediente_key UNIQUE (numero_expediente);
alter table panel_auditoria add constraint panel_auditoria_user_id_fkey FOREIGN KEY (user_id) REFERENCES panel_usuarios(id) ON DELETE SET NULL;
alter table panel_usuarios add constraint panel_usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table panel_usuarios add constraint panel_usuarios_auth_user_id_key UNIQUE (auth_user_id);
alter table panel_usuarios add constraint panel_usuarios_email_key UNIQUE (email);
alter table usuarios add constraint usuarios_email_key UNIQUE (email);
CREATE UNIQUE INDEX panel_usuarios_usuario_clave_uidx ON public.panel_usuarios USING btree (usuario_clave);
CREATE OR REPLACE FUNCTION public.panel_login_password(p_usuario_clave text, p_password_hash text)
 RETURNS TABLE(ok boolean, message text, nombre text, rol text, area text, can_edit boolean, tecnico boolean, password_initialized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user public.panel_usuarios%rowtype;
  v_initialized boolean := false;
begin
  select *
  into v_user
  from public.panel_usuarios
  where usuario_clave = p_usuario_clave
    and activo = true
  limit 1;

  if not found then
    return query
    select false, 'Usuario no habilitado.', ''::text, ''::text, ''::text, false, false, false;
    return;
  end if;

  if coalesce(trim(p_password_hash), '') = '' then
    return query
    select false, 'IngresÃ¡ la contraseÃ±a.', v_user.nombre, v_user.rol, v_user.area, coalesce(v_user.can_edit, false), coalesce(v_user.tecnico, false), false;
    return;
  end if;

  if v_user.password_hash is null or v_user.password_hash = '' then
    update public.panel_usuarios
    set
      password_hash = p_password_hash,
      password_set_at = now(),
      updated_at = now()
    where id = v_user.id;

    v_initialized := true;

    select *
    into v_user
    from public.panel_usuarios
    where id = v_user.id;
  elsif v_user.password_hash <> p_password_hash then
    return query
    select false, 'La contraseÃ±a no es correcta.', v_user.nombre, v_user.rol, v_user.area, coalesce(v_user.can_edit, false), coalesce(v_user.tecnico, false), false;
    return;
  end if;

  return query
  select true, 'OK', v_user.nombre, v_user.rol, v_user.area, coalesce(v_user.can_edit, false), coalesce(v_user.tecnico, false), v_initialized;
end;
$function$;

alter table public.expedientes enable row level security;
alter table public.expediente_planos enable row level security;
alter table public.panel_auditoria enable row level security;
alter table public.panel_usuarios enable row level security;
create policy expedientes_select_public on public.expedientes for select using (true);
create policy expedientes_insert_public on public.expedientes for insert with check (true);
create policy expedientes_update_public on public.expedientes for update using (true);
create policy expedientes_delete_public on public.expedientes for delete using (true);
create policy expediente_planos_select_public on public.expediente_planos for select using (true);
create policy expediente_planos_insert_public on public.expediente_planos for insert with check (true);
create policy expediente_planos_update_public on public.expediente_planos for update using (true);
create policy expediente_planos_delete_public on public.expediente_planos for delete using (true);
create policy panel_auditoria_insert_authenticated on public.panel_auditoria for insert to authenticated with check (true);
create policy panel_auditoria_select_authenticated on public.panel_auditoria for select to authenticated using (true);
create policy "Enable read access for all users" on public.panel_usuarios for select using (true);
create policy panel_usuarios_select_authenticated on public.panel_usuarios for select to authenticated using (activo = true);
grant all on all tables in schema public to anon, authenticated, service_role;
insert into storage.buckets (id, name, public) values ('planos-expedientes', 'planos-expedientes', true);
create policy "allow read planos" on storage.objects for select using (bucket_id = 'planos-expedientes');
create policy "allow upload planos" on storage.objects for insert with check (bucket_id = 'planos-expedientes');
create policy "allow delete planos" on storage.objects for delete using (bucket_id = 'planos-expedientes');


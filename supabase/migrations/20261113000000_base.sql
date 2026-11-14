-- CIG Regularización Dominial — base multi-municipio (etapa 1)
-- Tablas en inglés, columnas de negocio en español (convención Nexaia).
-- Toda tabla de negocio tiene RLS desde su creación.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Municipios y comunas (clientes)
-- ─────────────────────────────────────────────────────────────
create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  tipo text not null default 'municipio' check (tipo in ('municipio', 'comuna')),
  departamento text,
  sigla text not null check (sigla ~ '^[A-Z0-9]{2,6}$'),
  color_principal text check (color_principal ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  correo_catastro text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.localities (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  nombre text not null,
  unique (municipality_id, nombre)
);
create index on public.localities (municipality_id);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  locality_id uuid references public.localities(id) on delete set null,
  nombre text not null,
  unique (municipality_id, nombre)
);
create index on public.neighborhoods (municipality_id);

-- ─────────────────────────────────────────────────────────────
-- Usuarios, roles y soporte de plataforma
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un usuario puede tener varios roles en un municipio.
create table public.memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  roles text[] not null check (
    cardinality(roles) > 0
    and roles <@ array['direccion', 'subdireccion', 'armado', 'relevamiento', 'consulta']::text[]
  ),
  created_at timestamptz not null default now(),
  primary key (user_id, municipality_id)
);
create index on public.memberships (municipality_id);

-- Equipo de soporte (Nexaia). Configura municipios; todo lo que hace queda auditado.
create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Funciones de permisos (security definer para evitar recursión de RLS)
-- ─────────────────────────────────────────────────────────────
create or replace function public.es_admin_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.es_miembro(p_municipality uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.user_id and p.activo
    where m.user_id = auth.uid() and m.municipality_id = p_municipality
  );
$$;

create or replace function public.tiene_rol(p_municipality uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.user_id and p.activo
    where m.user_id = auth.uid() and m.municipality_id = p_municipality and m.roles && p_roles
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Marcos normativos (leyes). Catálogo global; cada municipio activa los suyos.
-- La configuración (pasos, requisitos, reglas de pruebas) vive en `config`
-- y se carga desde supabase/marcos/*.json.
-- ─────────────────────────────────────────────────────────────
create table public.legal_frameworks (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  nombre text not null,
  nombre_corto text not null,
  valor_catastro text not null,           -- valor del selector "Marco Normativo" del portal de Catastro
  alcance text not null check (alcance in ('provincial', 'barrio')),
  usa_nomina_padrones boolean not null default false,
  config jsonb not null,
  version integer not null default 1,
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.municipality_frameworks (
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  framework_id text not null references public.legal_frameworks(id),
  activo boolean not null default true,
  primary key (municipality_id, framework_id)
);

-- ─────────────────────────────────────────────────────────────
-- Expedientes
-- ─────────────────────────────────────────────────────────────
create table public.municipality_counters (
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  anio integer not null,
  ultimo integer not null default 0,
  primary key (municipality_id, anio)
);

create table public.case_files (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id),
  framework_id text not null references public.legal_frameworks(id),
  numero_interno text not null,
  estado text not null default 'en_armado' check (estado in (
    'en_armado', 'listo_para_revisar', 'devuelto', 'aprobado', 'firmado',
    'presentado', 'observado', 'reingresado', 'prorroga_pedida', 'aceptado',
    'desistido', 'archivado'
  )),
  fecha_apertura date not null default current_date,
  -- Inmueble
  padron text,
  padron_2 text,
  ubicacion text check (ubicacion in ('capital', 'interior')) default 'interior',
  domicilio_inmueble text,
  locality_id uuid references public.localities(id),
  neighborhood_id uuid references public.neighborhoods(id),
  departamento text,
  manzana text,
  lote text,
  numero_plano text,
  datos_catastrales jsonb not null default '{}'::jsonb, -- circ, secc, mzna, parcela, matricula, orden, antecedente_dominio
  coordenadas text check (coordenadas is null or coordenadas ~ '^-?\d{1,2}\.\d+,\s?-?\d{1,3}\.\d+$'),
  -- Posesión
  origen_posesion text check (origen_posesion in ('compra', 'otro')),
  origen_posesion_detalle text,
  fecha_inicio_posesion date,
  tiene_documentacion_ipvdu boolean,
  -- Catastro
  numero_expediente_catastro text,
  fecha_presentacion date,
  -- Gestión
  assigned_to uuid references public.profiles(id),
  notas text,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, numero_interno)
);
create index on public.case_files (municipality_id, estado);
create index on public.case_files (municipality_id, padron);
create index on public.case_files (assigned_to);

-- Personas del expediente: solicitantes, cónyuges/convivientes y grupo familiar.
create table public.case_people (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files(id) on delete cascade,
  rol text not null check (rol in ('solicitante', 'conyuge', 'grupo_familiar')),
  solicitante_numero integer not null default 1 check (solicitante_numero between 1 and 10),
  orden integer not null default 1,
  apellido text not null default '',
  nombre text not null default '',
  dni text check (dni is null or dni ~ '^\d{7,8}$'),
  cuil text check (cuil is null or cuil ~ '^\d{2}-\d{7,8}-\d$'),
  sexo text check (sexo in ('F', 'M', 'X')),
  fecha_nacimiento date,
  telefono text,
  domicilio text,
  ciudad text,
  estado_civil text check (estado_civil in ('soltero', 'casado', 'viudo', 'divorciado', 'conviviente')),
  vinculo text,
  ocupacion text,
  -- De dónde salió cada dato: {"dni":"dni_frente","domicilio":"dni_dorso","ocupacion":"voz",...}
  origen_datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.case_people (case_file_id);
create index on public.case_people (dni);

-- Documentos cargados contra un requisito del checklist.
create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files(id) on delete cascade,
  paso integer not null check (paso between 1 and 4),
  requisito text not null,
  person_id uuid references public.case_people(id) on delete set null,
  anio integer,
  storage_path text,
  nombre_archivo text,
  firmado boolean not null default false,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.case_documents (case_file_id);

-- Historial de estados y notas (inmutable).
create table public.case_events (
  id bigint generated always as identity primary key,
  case_file_id uuid not null references public.case_files(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id),
  tipo text not null check (tipo in ('creado', 'cambio_estado', 'nota')),
  de_estado text,
  a_estado text,
  nota text,
  actor uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.case_events (case_file_id, created_at);

-- Registro de auditoría (inmutable): quién cambió qué y cuándo.
create table public.audit_log (
  id bigint generated always as identity primary key,
  municipality_id uuid,
  tabla text not null,
  registro_id text not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  actor uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.audit_log (municipality_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger case_files_updated before update on public.case_files
  for each row execute function public.tocar_updated_at();
create trigger case_people_updated before update on public.case_people
  for each row execute function public.tocar_updated_at();

-- Número interno correlativo por municipio y año: SIGLA-AAAA-0001
create or replace function public.asignar_numero_interno()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_anio integer := extract(year from coalesce(new.fecha_apertura, current_date));
  v_sigla text;
  v_n integer;
begin
  select sigla into v_sigla from public.municipalities where id = new.municipality_id;
  insert into public.municipality_counters (municipality_id, anio, ultimo)
    values (new.municipality_id, v_anio, 1)
    on conflict (municipality_id, anio) do update set ultimo = municipality_counters.ultimo + 1
    returning ultimo into v_n;
  new.numero_interno := v_sigla || '-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  new.estado := 'en_armado';
  return new;
end $$;

create trigger case_files_numero before insert on public.case_files
  for each row execute function public.asignar_numero_interno();

-- El estado, el municipio y el número no se cambian con un update común:
-- el estado solo cambia por la función cambiar_estado().
create or replace function public.proteger_campos_expediente()
returns trigger language plpgsql as $$
begin
  if new.municipality_id <> old.municipality_id then
    raise exception 'No se puede mover un expediente a otro municipio';
  end if;
  if new.numero_interno <> old.numero_interno or new.framework_id <> old.framework_id then
    raise exception 'El número interno y la ley del expediente no se pueden cambiar';
  end if;
  if new.estado <> old.estado and coalesce(current_setting('cig.cambio_estado', true), '') <> 'on' then
    raise exception 'El estado solo se cambia con la acción correspondiente';
  end if;
  return new;
end $$;

create trigger case_files_proteger before update on public.case_files
  for each row execute function public.proteger_campos_expediente();

create or replace function public.registrar_creacion_expediente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.case_events (case_file_id, municipality_id, tipo, a_estado, actor)
    values (new.id, new.municipality_id, 'creado', new.estado, auth.uid());
  return new;
end $$;

create trigger case_files_evento_creado after insert on public.case_files
  for each row execute function public.registrar_creacion_expediente();

-- Auditoría genérica
create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_muni uuid;
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  v_muni := coalesce(
    (v_row ->> 'municipality_id')::uuid,
    (select municipality_id from public.case_files where id = (v_row ->> 'case_file_id')::uuid)
  );
  insert into public.audit_log (municipality_id, tabla, registro_id, accion, antes, despues, actor)
  values (
    v_muni, tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id', ''), tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

create trigger auditar_case_files after insert or update or delete on public.case_files
  for each row execute function public.auditar();
create trigger auditar_case_people after insert or update or delete on public.case_people
  for each row execute function public.auditar();
create trigger auditar_case_documents after insert or update or delete on public.case_documents
  for each row execute function public.auditar();
create trigger auditar_memberships after insert or update or delete on public.memberships
  for each row execute function public.auditar();
create trigger auditar_municipalities after insert or update or delete on public.municipalities
  for each row execute function public.auditar();

-- ─────────────────────────────────────────────────────────────
-- Cambio de estado: único camino, con control de rol y transición válida
-- ─────────────────────────────────────────────────────────────
create or replace function public.cambiar_estado(p_case uuid, p_estado text, p_nota text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_exp public.case_files%rowtype;
  v_permitido boolean := false;
begin
  select * into v_exp from public.case_files where id = p_case for update;
  if not found or not public.es_miembro(v_exp.municipality_id) then
    raise exception 'Expediente inexistente o sin acceso';
  end if;

  -- Transiciones válidas y quién puede hacerlas
  v_permitido := case
    when v_exp.estado in ('en_armado', 'devuelto') and p_estado = 'listo_para_revisar'
      then public.tiene_rol(v_exp.municipality_id, array['armado', 'subdireccion', 'direccion'])
    when v_exp.estado = 'listo_para_revisar' and p_estado in ('aprobado', 'devuelto')
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado = 'aprobado' and p_estado = 'firmado'
      then public.tiene_rol(v_exp.municipality_id, array['direccion'])
    when v_exp.estado = 'aprobado' and p_estado = 'devuelto'
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado in ('firmado', 'reingresado') and p_estado = 'presentado'
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado in ('presentado', 'reingresado', 'prorroga_pedida') and p_estado in ('observado', 'aceptado')
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado = 'observado' and p_estado in ('reingresado', 'prorroga_pedida')
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado not in ('aceptado', 'desistido', 'archivado') and p_estado in ('desistido', 'archivado')
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    else false
  end;

  if not v_permitido then
    raise exception 'No se puede pasar de "%" a "%" con tu rol', v_exp.estado, p_estado;
  end if;

  if p_estado = 'devuelto' and coalesce(btrim(p_nota), '') = '' then
    raise exception 'Para devolver un expediente hay que escribir qué corregir';
  end if;

  perform set_config('cig.cambio_estado', 'on', true);
  update public.case_files set estado = p_estado where id = p_case;
  perform set_config('cig.cambio_estado', 'off', true);

  insert into public.case_events (case_file_id, municipality_id, tipo, de_estado, a_estado, nota, actor)
    values (p_case, v_exp.municipality_id, 'cambio_estado', v_exp.estado, p_estado, nullif(btrim(p_nota), ''), auth.uid());

  return p_estado;
end $$;

revoke all on function public.cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.municipalities enable row level security;
alter table public.localities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.legal_frameworks enable row level security;
alter table public.municipality_frameworks enable row level security;
alter table public.municipality_counters enable row level security; -- sin políticas: solo el trigger
alter table public.case_files enable row level security;
alter table public.case_people enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_events enable row level security;
alter table public.audit_log enable row level security;

-- Municipios
create policy "ver municipio propio" on public.municipalities for select to authenticated
  using (public.es_miembro(id) or public.es_admin_plataforma());
create policy "soporte administra municipios" on public.municipalities for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

create policy "ver localidades" on public.localities for select to authenticated
  using (public.es_miembro(municipality_id) or public.es_admin_plataforma());
create policy "soporte administra localidades" on public.localities for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

create policy "ver barrios" on public.neighborhoods for select to authenticated
  using (public.es_miembro(municipality_id) or public.es_admin_plataforma());
create policy "soporte administra barrios" on public.neighborhoods for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

-- Perfiles: uno mismo y los compañeros del mismo municipio
create policy "ver perfiles" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.es_admin_plataforma()
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id and public.es_miembro(m.municipality_id)
    )
  );
create policy "editar mi nombre" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "soporte administra perfiles" on public.profiles for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

-- Membresías
create policy "ver membresias del municipio" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.es_miembro(municipality_id) or public.es_admin_plataforma());
create policy "soporte administra membresias" on public.memberships for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

create policy "ver soporte propio" on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- Leyes
create policy "ver leyes" on public.legal_frameworks for select to authenticated using (true);
create policy "soporte administra leyes" on public.legal_frameworks for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

create policy "ver leyes del municipio" on public.municipality_frameworks for select to authenticated
  using (public.es_miembro(municipality_id) or public.es_admin_plataforma());
create policy "soporte activa leyes" on public.municipality_frameworks for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

-- Expedientes
create policy "ver expedientes del municipio" on public.case_files for select to authenticated
  using (public.es_miembro(municipality_id));
create policy "abrir expedientes" on public.case_files for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.tiene_rol(municipality_id, array['armado', 'subdireccion', 'direccion'])
    and exists (
      select 1 from public.municipality_frameworks mf
      where mf.municipality_id = case_files.municipality_id
        and mf.framework_id = case_files.framework_id and mf.activo
    )
  );
create policy "editar expedientes" on public.case_files for update to authenticated
  using (
    public.tiene_rol(municipality_id, array['armado', 'subdireccion', 'direccion', 'relevamiento'])
    and estado in ('en_armado', 'devuelto', 'listo_para_revisar', 'observado')
  )
  with check (public.tiene_rol(municipality_id, array['armado', 'subdireccion', 'direccion', 'relevamiento']));
-- Sin política de delete: los expedientes no se borran, se archivan.

-- Tablas hijas: el municipio se resuelve por el expediente padre.
create or replace function public.puede_ver_expediente(p_case uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.case_files c where c.id = p_case and public.es_miembro(c.municipality_id));
$$;

create or replace function public.puede_editar_expediente(p_case uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.case_files c
    where c.id = p_case
      and c.estado in ('en_armado', 'devuelto', 'listo_para_revisar', 'observado')
      and public.tiene_rol(c.municipality_id, array['armado', 'subdireccion', 'direccion', 'relevamiento'])
  );
$$;

create policy "ver personas" on public.case_people for select to authenticated
  using (public.puede_ver_expediente(case_file_id));
create policy "cargar personas" on public.case_people for insert to authenticated
  with check (public.puede_editar_expediente(case_file_id));
create policy "editar personas" on public.case_people for update to authenticated
  using (public.puede_editar_expediente(case_file_id)) with check (public.puede_editar_expediente(case_file_id));
create policy "quitar personas" on public.case_people for delete to authenticated
  using (public.puede_editar_expediente(case_file_id));

create policy "ver documentos" on public.case_documents for select to authenticated
  using (public.puede_ver_expediente(case_file_id));
create policy "cargar documentos" on public.case_documents for insert to authenticated
  with check (public.puede_editar_expediente(case_file_id));
create policy "quitar documentos" on public.case_documents for delete to authenticated
  using (public.puede_editar_expediente(case_file_id) and not firmado);

create policy "ver historial" on public.case_events for select to authenticated
  using (public.es_miembro(municipality_id));
create policy "agregar notas" on public.case_events for insert to authenticated
  with check (tipo = 'nota' and actor = auth.uid() and public.puede_ver_expediente(case_file_id)
              and municipality_id = (select municipality_id from public.case_files where id = case_file_id));

create policy "ver auditoria" on public.audit_log for select to authenticated
  using (public.es_admin_plataforma() or public.tiene_rol(municipality_id, array['direccion', 'subdireccion']));
-- Sin políticas de insert/update/delete: solo escriben los triggers.

-- Nadie, ni con su sesión, puede alterar el historial.
revoke update, delete on public.case_events from authenticated, anon;
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Etapa 5: firma de la Dirección, presentación en Catastro, observaciones con plazo,
-- y constancias de tenencia precaria.

-- ─────────────────────────────────────────────────────────────
-- Firma digital: la Dirección sube el PDF firmado de cada paso
-- ─────────────────────────────────────────────────────────────
alter table public.case_documents drop constraint case_documents_origen_check;
alter table public.case_documents add constraint case_documents_origen_check
  check (origen in ('archivo', 'escaneo', 'formulario', 'firmado'));

-- La Dirección firma cuando el expediente está aprobado, o cuando vuelve a firmar
-- lo corregido después de una observación de Catastro.
create or replace function public.puede_firmar_expediente(p_case uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.case_files c
    where c.id = p_case
      and c.estado in ('aprobado', 'observado', 'prorroga_pedida')
      and public.tiene_rol(c.municipality_id, array['direccion'])
  );
$$;

create policy "subir pdf firmado" on public.case_documents for insert to authenticated
  with check (requisito = 'pdf_firmado' and firmado and origen = 'firmado' and public.puede_firmar_expediente(case_file_id));
create policy "quitar pdf firmado" on public.case_documents for delete to authenticated
  using (requisito = 'pdf_firmado' and public.puede_firmar_expediente(case_file_id));

create policy "subir archivo firmado" on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and storage.filename(name) like 'firmado-%'
              and public.puede_firmar_expediente(public.ruta_de_expediente_valida(name)));
create policy "borrar archivo firmado" on storage.objects for delete to authenticated
  using (bucket_id = 'expedientes' and storage.filename(name) like 'firmado-%'
         and public.puede_firmar_expediente(public.ruta_de_expediente_valida(name)));

-- ─────────────────────────────────────────────────────────────
-- Plazos de Catastro: días hábiles o corridos (por municipio) y feriados
-- ─────────────────────────────────────────────────────────────
alter table public.municipalities
  add column plazo_catastro_dias integer not null default 10 check (plazo_catastro_dias between 1 and 90),
  add column plazo_catastro_tipo text not null default 'habiles' check (plazo_catastro_tipo in ('habiles', 'corridos')),
  -- Para las constancias y los encabezados
  add column area_nombre text not null default 'Dirección de Regularización Dominial y Hábitat',
  add column secretaria_nombre text not null default 'Secretaría de Gobierno';

create table public.feriados (
  fecha date primary key,
  nombre text not null,
  -- true: fecha cargada de antemano que hay que confirmar con el calendario oficial
  verificar boolean not null default false
);
alter table public.feriados enable row level security;
create policy "ver feriados" on public.feriados for select to authenticated using (true);
create policy "soporte administra feriados" on public.feriados for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

-- Feriados nacionales 2026 y el provincial de Tucumán (24 de septiembre).
-- Los trasladables se cargan en la fecha en que se celebran; confirmar con el decreto anual.
insert into public.feriados (fecha, nombre, verificar) values
  ('2026-01-01', 'Año Nuevo', false),
  ('2026-02-16', 'Carnaval', false),
  ('2026-02-17', 'Carnaval', false),
  ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', false),
  ('2026-04-02', 'Día del Veterano y de los Caídos en Malvinas', false),
  ('2026-04-03', 'Viernes Santo', false),
  ('2026-05-01', 'Día del Trabajador', false),
  ('2026-05-25', 'Revolución de Mayo', false),
  ('2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes (trasladado)', true),
  ('2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', false),
  ('2026-07-09', 'Día de la Independencia', false),
  ('2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín', true),
  ('2026-09-24', 'Batalla de Tucumán (provincial)', false),
  ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', true),
  ('2026-11-23', 'Día de la Soberanía Nacional (trasladado)', true),
  ('2026-12-08', 'Inmaculada Concepción de María', false),
  ('2026-12-25', 'Navidad', false)
on conflict (fecha) do nothing;

-- Suma días a una fecha: corridos, o hábiles (sin sábados, domingos ni feriados).
create or replace function public.sumar_dias(p_desde date, p_dias integer, p_tipo text)
returns date language plpgsql stable set search_path = public as $$
declare
  v_fecha date := p_desde;
  v_contados integer := 0;
begin
  if p_tipo = 'corridos' then return p_desde + p_dias; end if;
  while v_contados < p_dias loop
    v_fecha := v_fecha + 1;
    if extract(isodow from v_fecha) < 6 and not exists (select 1 from public.feriados f where f.fecha = v_fecha) then
      v_contados := v_contados + 1;
    end if;
  end loop;
  return v_fecha;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Observaciones de Catastro
-- ─────────────────────────────────────────────────────────────
create table public.catastro_observations (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id),
  recibida_el date not null,
  texto text not null,
  plazo_dias integer not null,
  plazo_tipo text not null check (plazo_tipo in ('habiles', 'corridos')),
  vence_el date not null,
  prorroga_hasta date,
  estado text not null default 'abierta' check (estado in ('abierta', 'prorroga', 'respondida')),
  respondida_el date,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.catastro_observations (case_file_id);
create index on public.catastro_observations (municipality_id, estado);

alter table public.catastro_observations enable row level security;
create policy "ver observaciones" on public.catastro_observations for select to authenticated
  using (public.es_miembro(municipality_id));
-- Se escriben solo con las funciones de abajo (que además cambian el estado del expediente).

create trigger auditar_catastro_observations after insert or update or delete on public.catastro_observations
  for each row execute function public.auditar();

-- ─────────────────────────────────────────────────────────────
-- Cambio de estado: se suman el control de los PDF firmados y el reingreso después de una prórroga
-- ─────────────────────────────────────────────────────────────
create or replace function public.cambiar_estado(p_case uuid, p_estado text, p_nota text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_exp public.case_files%rowtype;
  v_permitido boolean := false;
  v_faltan text;
begin
  select * into v_exp from public.case_files where id = p_case for update;
  if not found or not public.es_miembro(v_exp.municipality_id) then
    raise exception 'Expediente inexistente o sin acceso';
  end if;

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
    when v_exp.estado in ('observado', 'prorroga_pedida') and p_estado = 'reingresado'
      then public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion'])
    when v_exp.estado = 'observado' and p_estado = 'prorroga_pedida'
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

  -- Firmado: tiene que estar el PDF firmado de cada uno de los 4 pasos.
  if p_estado = 'firmado' then
    select string_agg(p::text, ', ' order by p) into v_faltan
    from generate_series(1, 4) p
    where not exists (
      select 1 from public.case_documents d
      where d.case_file_id = p_case and d.requisito = 'pdf_firmado' and d.paso = p and d.firmado
    );
    if v_faltan is not null then
      raise exception 'Falta el PDF firmado de los pasos: %', v_faltan;
    end if;
  end if;

  perform set_config('cig.cambio_estado', 'on', true);
  update public.case_files set estado = p_estado where id = p_case;
  perform set_config('cig.cambio_estado', 'off', true);

  insert into public.case_events (case_file_id, municipality_id, tipo, de_estado, a_estado, nota, actor)
    values (p_case, v_exp.municipality_id, 'cambio_estado', v_exp.estado, p_estado, nullif(btrim(p_nota), ''), auth.uid());

  return p_estado;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Presentación, observación, prórroga y reingreso (cada una cambia el estado y guarda sus datos juntos)
-- ─────────────────────────────────────────────────────────────
create or replace function public.registrar_presentacion(p_case uuid, p_numero text, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_exp public.case_files%rowtype;
begin
  select * into v_exp from public.case_files where id = p_case for update;
  if not found or not public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion']) then
    raise exception 'Expediente inexistente o sin permiso para presentarlo';
  end if;
  if v_exp.estado = 'firmado' and coalesce(btrim(p_numero), '') = '' and v_exp.numero_expediente_catastro is null then
    raise exception 'Falta el número de expediente que dio el portal de Catastro';
  end if;
  if p_fecha is null or p_fecha > current_date then
    raise exception 'La fecha de presentación no es válida';
  end if;
  update public.case_files
     set numero_expediente_catastro = coalesce(nullif(btrim(p_numero), ''), numero_expediente_catastro),
         fecha_presentacion = coalesce(fecha_presentacion, p_fecha)
   where id = p_case;
  perform public.cambiar_estado(p_case, 'presentado',
    case when v_exp.estado = 'reingresado' then 'Vuelto a presentar en Catastro' else 'Presentado en Catastro, expediente ' || coalesce(nullif(btrim(p_numero), ''), v_exp.numero_expediente_catastro) end);
end $$;

create or replace function public.registrar_observacion(p_case uuid, p_recibida date, p_texto text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_exp public.case_files%rowtype;
  v_muni public.municipalities%rowtype;
  v_id uuid;
begin
  select * into v_exp from public.case_files where id = p_case for update;
  if not found or not public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion']) then
    raise exception 'Expediente inexistente o sin permiso';
  end if;
  if coalesce(btrim(p_texto), '') = '' then raise exception 'Escribí qué observó Catastro'; end if;
  if p_recibida is null or p_recibida > current_date then raise exception 'La fecha de la observación no es válida'; end if;
  select * into v_muni from public.municipalities where id = v_exp.municipality_id;
  -- Si había otra observación abierta, queda reemplazada por esta.
  update public.catastro_observations set estado = 'respondida', respondida_el = p_recibida
   where case_file_id = p_case and estado <> 'respondida';
  insert into public.catastro_observations (case_file_id, municipality_id, recibida_el, texto, plazo_dias, plazo_tipo, vence_el)
  values (p_case, v_exp.municipality_id, p_recibida, btrim(p_texto), v_muni.plazo_catastro_dias, v_muni.plazo_catastro_tipo,
          public.sumar_dias(p_recibida, v_muni.plazo_catastro_dias, v_muni.plazo_catastro_tipo))
  returning id into v_id;
  perform public.cambiar_estado(p_case, 'observado', btrim(p_texto));
  return v_id;
end $$;

create or replace function public.registrar_prorroga(p_case uuid, p_hasta date, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_obs public.catastro_observations%rowtype;
begin
  select * into v_obs from public.catastro_observations
   where case_file_id = p_case and estado = 'abierta' order by recibida_el desc limit 1 for update;
  if not found then raise exception 'No hay una observación abierta para este expediente'; end if;
  if not public.tiene_rol(v_obs.municipality_id, array['subdireccion', 'direccion']) then raise exception 'Sin permiso'; end if;
  update public.catastro_observations
     set estado = 'prorroga',
         prorroga_hasta = coalesce(p_hasta, public.sumar_dias(v_obs.vence_el, v_obs.plazo_dias, v_obs.plazo_tipo))
   where id = v_obs.id;
  perform public.cambiar_estado(p_case, 'prorroga_pedida', coalesce(nullif(btrim(p_nota), ''), 'Prórroga pedida a Catastro'));
end $$;

create or replace function public.registrar_reingreso(p_case uuid, p_fecha date, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_exp public.case_files%rowtype;
begin
  select * into v_exp from public.case_files where id = p_case for update;
  if not found or not public.tiene_rol(v_exp.municipality_id, array['subdireccion', 'direccion']) then
    raise exception 'Expediente inexistente o sin permiso';
  end if;
  if p_fecha is null or p_fecha > current_date then raise exception 'La fecha de reingreso no es válida'; end if;
  update public.catastro_observations set estado = 'respondida', respondida_el = p_fecha
   where case_file_id = p_case and estado <> 'respondida';
  perform public.cambiar_estado(p_case, 'reingresado', coalesce(nullif(btrim(p_nota), ''), 'Corregido y reingresado en Catastro'));
end $$;

revoke all on function public.registrar_presentacion(uuid, text, date) from public, anon;
revoke all on function public.registrar_observacion(uuid, date, text) from public, anon;
revoke all on function public.registrar_prorroga(uuid, date, text) from public, anon;
revoke all on function public.registrar_reingreso(uuid, date, text) from public, anon;
grant execute on function public.registrar_presentacion(uuid, text, date) to authenticated;
grant execute on function public.registrar_observacion(uuid, date, text) to authenticated;
grant execute on function public.registrar_prorroga(uuid, date, text) to authenticated;
grant execute on function public.registrar_reingreso(uuid, date, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Constancias de tenencia precaria (igual que en el panel actual)
-- ─────────────────────────────────────────────────────────────
create table public.tenure_counters (
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  anio integer not null,
  ultimo integer not null default 0,
  primary key (municipality_id, anio)
);
alter table public.tenure_counters enable row level security; -- sin políticas: solo el trigger

create table public.tenure_certificates (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id),
  numero text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'notificado', 'visitado', 'listo', 'entregado')),
  vecino_nombre text not null check (btrim(vecino_nombre) <> ''),
  dni text check (dni is null or dni ~ '^\d{7,8}$'),
  domicilio text,
  neighborhood_id uuid references public.neighborhoods(id),
  barrio text,
  telefono text,
  fecha_visita date,
  observaciones text,
  presentado_ante text,
  padron_catastral text,
  matricula_catastral text,
  propietario_legal text,
  agente_nombre text,
  case_file_id uuid references public.case_files(id) on delete set null,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, numero)
);
create index on public.tenure_certificates (municipality_id, estado);

create or replace function public.numerar_constancia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_anio integer := extract(year from now())::integer;
  v_n integer;
begin
  insert into public.tenure_counters (municipality_id, anio, ultimo) values (new.municipality_id, v_anio, 1)
  on conflict (municipality_id, anio) do update set ultimo = public.tenure_counters.ultimo + 1
  returning ultimo into v_n;
  new.numero := 'CR-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  return new;
end $$;

create trigger numerar_tenure_certificates before insert on public.tenure_certificates
  for each row execute function public.numerar_constancia();
create trigger tocar_tenure_certificates before update on public.tenure_certificates
  for each row execute function public.tocar_updated_at();
create trigger auditar_tenure_certificates after insert or update or delete on public.tenure_certificates
  for each row execute function public.auditar();

create or replace function public.proteger_constancia()
returns trigger language plpgsql as $$
begin
  if new.municipality_id <> old.municipality_id or new.numero <> old.numero then
    raise exception 'El número y el municipio de la constancia no se pueden cambiar';
  end if;
  return new;
end $$;
create trigger proteger_tenure_certificates before update on public.tenure_certificates
  for each row execute function public.proteger_constancia();

alter table public.tenure_certificates enable row level security;
create policy "ver constancias" on public.tenure_certificates for select to authenticated
  using (public.es_miembro(municipality_id));
create policy "cargar constancias" on public.tenure_certificates for insert to authenticated
  with check (public.tiene_rol(municipality_id, array['armado', 'relevamiento', 'subdireccion', 'direccion']));
create policy "editar constancias" on public.tenure_certificates for update to authenticated
  using (public.tiene_rol(municipality_id, array['armado', 'relevamiento', 'subdireccion', 'direccion']))
  with check (public.tiene_rol(municipality_id, array['armado', 'relevamiento', 'subdireccion', 'direccion']));
create policy "borrar constancias" on public.tenure_certificates for delete to authenticated
  using (estado <> 'entregado' and public.tiene_rol(municipality_id, array['subdireccion', 'direccion']));

-- Archivos de cada constancia: bucket privado, ruta <municipality_id>/<certificado_id>/<archivo>.pdf
create table public.tenure_certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.tenure_certificates(id) on delete cascade,
  storage_path text not null,
  nombre_archivo text,
  tamano_bytes integer,
  paginas integer,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.tenure_certificate_files (certificate_id);

create or replace function public.constancia_de_ruta(p_name text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_partes text[] := storage.foldername(p_name);
  v_id uuid;
begin
  if array_length(v_partes, 1) <> 2 then return null; end if;
  begin
    select t.id into v_id from public.tenure_certificates t
     where t.id = v_partes[2]::uuid and t.municipality_id = v_partes[1]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
  return v_id;
end $$;

create or replace function public.puede_ver_constancia(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenure_certificates t where t.id = p_id and public.es_miembro(t.municipality_id));
$$;
create or replace function public.puede_editar_constancia(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenure_certificates t where t.id = p_id
                 and public.tiene_rol(t.municipality_id, array['armado', 'relevamiento', 'subdireccion', 'direccion']));
$$;

alter table public.tenure_certificate_files enable row level security;
create policy "ver archivos de constancia" on public.tenure_certificate_files for select to authenticated
  using (public.puede_ver_constancia(certificate_id));
create policy "cargar archivos de constancia" on public.tenure_certificate_files for insert to authenticated
  with check (public.puede_editar_constancia(certificate_id));
create policy "quitar archivos de constancia" on public.tenure_certificate_files for delete to authenticated
  using (public.puede_editar_constancia(certificate_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('constancias', 'constancias', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "ver archivos de constancias" on storage.objects for select to authenticated
  using (bucket_id = 'constancias' and public.puede_ver_constancia(public.constancia_de_ruta(name)));
create policy "subir archivos de constancias" on storage.objects for insert to authenticated
  with check (bucket_id = 'constancias' and public.puede_editar_constancia(public.constancia_de_ruta(name)));
create policy "borrar archivos de constancias" on storage.objects for delete to authenticated
  using (bucket_id = 'constancias' and public.puede_editar_constancia(public.constancia_de_ruta(name)));

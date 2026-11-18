-- Ingreso "eligiendo tu nombre y tu contraseña", igual que en el panel anterior de Banda del Río Salí.
-- La contraseña la sigue verificando la función `panel-login` (tabla panel_usuarios), así cada
-- persona entra con la misma de siempre. Acá se define quién aparece en la pantalla de ingreso de
-- cada municipio y con qué roles entra al panel nuevo.

create table public.login_profiles (
  usuario_clave text primary key check (usuario_clave ~ '^[a-z0-9-]+$'),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  nombre text not null,
  rol_texto text not null,
  roles text[] not null check (array_length(roles, 1) > 0
    and roles <@ array['direccion', 'subdireccion', 'armado', 'relevamiento', 'consulta']::text[]),
  orden integer not null default 0,
  activo boolean not null default true
);
create index on public.login_profiles (municipality_id);
alter table public.login_profiles enable row level security;
create policy "soporte administra perfiles de ingreso" on public.login_profiles for all to authenticated
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());
create trigger auditar_login_profiles after insert or update or delete on public.login_profiles
  for each row execute function public.auditar();

-- Lista de nombres para la pantalla de ingreso (sin datos sensibles: nombre y cargo).
create or replace function public.perfiles_de_ingreso(p_municipio text)
returns table (usuario_clave text, nombre text, rol_texto text)
language sql stable security definer set search_path = public as $$
  select lp.usuario_clave, lp.nombre, lp.rol_texto
  from public.login_profiles lp
  join public.municipalities m on m.id = lp.municipality_id
  where m.slug = p_municipio and m.activo and lp.activo
  order by lp.orden, lp.nombre;
$$;
revoke all on function public.perfiles_de_ingreso(text) from public;
grant execute on function public.perfiles_de_ingreso(text) to anon, authenticated;

-- Nombre, logo y color del municipio para la pantalla de ingreso.
create or replace function public.municipio_de_ingreso(p_municipio text)
returns table (nombre text, logo_path text, color_principal text)
language sql stable security definer set search_path = public as $$
  select m.nombre, m.logo_path, m.color_principal from public.municipalities m where m.slug = p_municipio and m.activo;
$$;
revoke all on function public.municipio_de_ingreso(text) from public;
grant execute on function public.municipio_de_ingreso(text) to anon, authenticated;

-- Después de ingresar: deja a la persona con su perfil y sus roles en el municipio.
-- El perfil sale del dato que puso la función de ingreso en la cuenta (app_metadata.perfil),
-- que el usuario no puede cambiar.
create or replace function public.vincular_perfil_de_ingreso()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clave text := auth.jwt() -> 'app_metadata' ->> 'perfil';
  v_perfil public.login_profiles%rowtype;
begin
  if auth.uid() is null or v_clave is null then return; end if;
  select * into v_perfil from public.login_profiles where usuario_clave = v_clave and activo;
  if not found then raise exception 'Este usuario no está habilitado en el panel'; end if;
  insert into public.profiles (id, nombre, email)
  values (auth.uid(), v_perfil.nombre, coalesce(auth.jwt() ->> 'email', v_clave || '@cig-brs.local'))
  on conflict (id) do update set nombre = excluded.nombre;
  insert into public.memberships (user_id, municipality_id, roles)
  values (auth.uid(), v_perfil.municipality_id, v_perfil.roles)
  on conflict (user_id, municipality_id) do update set roles = excluded.roles;
end $$;
revoke all on function public.vincular_perfil_de_ingreso() from public, anon;
grant execute on function public.vincular_perfil_de_ingreso() to authenticated;

-- Las constancias que vienen del panel anterior conservan su número (CR-AAAA-0001).
-- Solo la carga hecha por soporte (clave de servicio) puede traer número propio.
create or replace function public.numerar_constancia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_anio integer := extract(year from now())::integer;
  v_n integer;
begin
  if coalesce(auth.role(), '') = 'service_role' and new.numero ~ '^CR-\d{4}-\d{4}$' then
    v_anio := split_part(new.numero, '-', 2)::integer;
    v_n := split_part(new.numero, '-', 3)::integer;
    insert into public.tenure_counters (municipality_id, anio, ultimo) values (new.municipality_id, v_anio, v_n)
    on conflict (municipality_id, anio) do update set ultimo = greatest(public.tenure_counters.ultimo, excluded.ultimo);
    return new;
  end if;
  insert into public.tenure_counters (municipality_id, anio, ultimo) values (new.municipality_id, v_anio, 1)
  on conflict (municipality_id, anio) do update set ultimo = public.tenure_counters.ultimo + 1
  returning ultimo into v_n;
  new.numero := 'CR-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  return new;
end $$;

-- Para traer las constancias con su fecha original.
alter table public.tenure_certificates add column origen text not null default 'panel' check (origen in ('panel', 'panel_anterior'));
alter table public.tenure_certificates add column id_anterior uuid unique;

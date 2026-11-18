-- Etapa 3: relevamiento en el lugar (pasos 2 y 4 de Catastro).
-- El celular del relevador trabaja sin señal y sincroniza cuando vuelve la conexión.

-- Edad que declara el vecino cuando no hay fecha de nacimiento (grupo familiar del relevamiento social).
alter table public.case_people add column edad_declarada integer check (edad_declarada between 0 and 120);

-- Un relevamiento por expediente. El id lo genera el celular: si la sincronización se corta
-- y se repite, pisa el mismo registro en vez de duplicarlo.
create table public.field_surveys (
  id uuid primary key,
  case_file_id uuid not null unique references public.case_files(id) on delete cascade,
  relevador uuid not null references public.profiles(id) default auth.uid(),
  estado text not null default 'en_curso' check (estado in ('en_curso', 'completo', 'revisado')),
  fecha date not null default current_date,
  -- Ubicación tomada con el GPS del celular
  gps_lat double precision check (gps_lat between -90 and 90),
  gps_lng double precision check (gps_lng between -180 and 180),
  gps_precision_m double precision,
  gps_fecha timestamptz,
  -- Respuestas de la entrevista: { clave: { texto, origen: voz|mano, revisado, audio, transcrito_en } }
  respuestas jsonb not null default '{}'::jsonb,
  -- Lo que observa el relevador (casillas del formulario): { entorno: 'urbano', servicios: ['agua','luz'], ... }
  observaciones jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.field_surveys (relevador);

create trigger tocar_field_surveys before update on public.field_surveys
  for each row execute function public.tocar_updated_at();
create trigger auditar_field_surveys after insert or update or delete on public.field_surveys
  for each row execute function public.auditar();

alter table public.field_surveys enable row level security;

create policy "ver relevamientos" on public.field_surveys for select to authenticated
  using (public.puede_ver_expediente(case_file_id));
create policy "iniciar relevamiento" on public.field_surveys for insert to authenticated
  with check (relevador = auth.uid() and public.puede_editar_expediente(case_file_id));
create policy "editar relevamiento" on public.field_surveys for update to authenticated
  using (public.puede_editar_expediente(case_file_id))
  with check (public.puede_editar_expediente(case_file_id));
-- Sin delete: queda como constancia de la visita.

-- Audios de la entrevista: una grabación por pregunta. Privados, misma regla de ruta que los PDF:
-- <municipality_id>/<case_file_id>/<archivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "escuchar audios del expediente" on storage.objects for select to authenticated
  using (bucket_id = 'audios' and public.puede_ver_expediente(public.ruta_de_expediente_valida(name)));
create policy "subir audios al expediente" on storage.objects for insert to authenticated
  with check (bucket_id = 'audios' and public.puede_editar_expediente(public.ruta_de_expediente_valida(name)));
-- Sin update ni delete: la grabación es la constancia de lo que dijo el vecino.

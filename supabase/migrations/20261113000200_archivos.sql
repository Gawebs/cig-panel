-- Etapa 2: archivos privados de los expedientes y valores propios de los formularios.

-- Ruta de cada archivo: <municipality_id>/<case_file_id>/<nombre>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- El archivo pertenece al expediente de la ruta y a su municipio (los dos tienen que coincidir).
create or replace function public.ruta_de_expediente_valida(p_name text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_partes text[] := storage.foldername(p_name);
  v_case uuid;
begin
  if array_length(v_partes, 1) <> 2 then return null; end if;
  begin
    select c.id into v_case from public.case_files c
     where c.id = v_partes[2]::uuid and c.municipality_id = v_partes[1]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
  return v_case;
end $$;

create policy "ver archivos del expediente" on storage.objects for select to authenticated
  using (bucket_id = 'expedientes' and public.puede_ver_expediente(public.ruta_de_expediente_valida(name)));

create policy "subir archivos al expediente" on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and public.puede_editar_expediente(public.ruta_de_expediente_valida(name)));

create policy "borrar archivos del expediente" on storage.objects for delete to authenticated
  using (bucket_id = 'expedientes' and public.puede_editar_expediente(public.ruta_de_expediente_valida(name)));
-- Sin update: un archivo no se pisa, se reemplaza por otro.

alter table public.case_documents
  add column tipo_prueba text,
  add column tamano_bytes integer,
  add column paginas integer,
  add column origen text not null default 'archivo' check (origen in ('archivo', 'escaneo', 'formulario'));

-- Valores que existen solo en un formulario (por ejemplo, la fecha impresa).
-- Todo lo demás sale de la ficha del expediente.
alter table public.case_files
  add column valores_formularios jsonb not null default '{}'::jsonb;

-- Cuándo se imprimió cada formulario: si después cambia un dato, hay que reimprimir y volver a firmar.
alter table public.case_files
  add column formularios_impresos jsonb not null default '{}'::jsonb;

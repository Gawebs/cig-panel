-- Logos de cada municipio (encabezado del panel y constancias impresas). Son públicos:
-- se muestran en papeles que entrega el municipio. Solo soporte los sube (con el script de alta).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Correo de contacto de cada persona del expediente: el portal de Catastro lo pide y lo valida al presentar.
alter table public.case_people add column if not exists correo text;

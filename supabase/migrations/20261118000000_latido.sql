-- Latido diario: una escritura chica para que Supabase (plan gratuito) no pause la base por falta de uso.
-- La llama el cron de Vercel (/api/latido) una vez por día. Solo actualiza una fila con la fecha: no lee ni toca nada más.

create table if not exists public.latido (
  id smallint primary key default 1 check (id = 1),
  ultimo timestamptz not null default now(),
  veces bigint not null default 0
);

alter table public.latido enable row level security;
-- Sin políticas: nadie la lee ni la escribe directo; solo la función de abajo.

insert into public.latido (id) values (1) on conflict (id) do nothing;

create or replace function public.latido()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.latido set ultimo = now(), veces = veces + 1 where id = 1
  returning ultimo;
$$;

revoke execute on function public.latido() from public;
grant execute on function public.latido() to anon, authenticated;

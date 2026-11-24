-- Informe para el intendente (PDF imprimible con proyecciones, desde el Tablero).
-- Es opcional: cada municipio o comuna lo tiene solo si lo contrató o lo pidió.
alter table public.municipalities
  add column informe_intendente boolean not null default false;

-- Banda del Río Salí lo venía pidiendo.
update public.municipalities set informe_intendente = true where slug = 'brs';

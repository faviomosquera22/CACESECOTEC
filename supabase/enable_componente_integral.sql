-- Ejecutar en Supabase SQL Editor para habilitar el guardado del
-- Componente Integral en instalaciones existentes.

create table if not exists public.teacher_simulator_settings (
  career_slug text primary key check (career_slug in ('enfermeria', 'psicologia')),
  enabled_difficulties text[] not null default array['facil', 'media', 'dificil']::text[],
  enabled_categories text[] not null default array['procedimientos-clinicos']::text[],
  enabled_phases text[] not null default array['fase-1']::text[],
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.teacher_simulator_settings
add column if not exists enabled_phases text[] not null default array['fase-1']::text[];

alter table public.teacher_simulator_settings
drop constraint if exists teacher_simulator_settings_phases_not_empty,
drop constraint if exists teacher_simulator_settings_phases_valid;

alter table public.teacher_simulator_settings
add constraint teacher_simulator_settings_phases_not_empty
check (cardinality(enabled_phases) > 0),
add constraint teacher_simulator_settings_phases_valid
check (
  enabled_phases <@ array[
    'fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5', 'componente-integral'
  ]::text[]
);

insert into public.teacher_simulator_settings (
  career_slug, enabled_categories, enabled_phases
)
values (
  'enfermeria',
  array[
    'procedimientos-clinicos', 'mujer-recien-nacido', 'adulto-mayor',
    'comunitario', 'bases-profesionales'
  ]::text[],
  array['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5']::text[]
)
on conflict (career_slug) do nothing;

alter table public.teacher_simulator_settings enable row level security;
grant select on table public.teacher_simulator_settings to authenticated;
grant all on table public.teacher_simulator_settings to service_role;
revoke insert, update, delete on table public.teacher_simulator_settings
from anon, authenticated;

drop policy if exists "Career members can read simulator settings"
on public.teacher_simulator_settings;
create policy "Career members can read simulator settings"
on public.teacher_simulator_settings for select to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and (
        (teacher_simulator_settings.career_slug = 'enfermeria' and lower(trim(coalesce(profile.career, ''))) in ('enfermeria', 'enfermería'))
        or
        (teacher_simulator_settings.career_slug = 'psicologia' and lower(trim(coalesce(profile.career, ''))) in ('psicologia', 'psicología'))
      )
  )
);

notify pgrst, 'reload schema';

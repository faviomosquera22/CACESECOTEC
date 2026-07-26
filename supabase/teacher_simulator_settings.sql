-- Ejecutar una vez en Supabase SQL Editor después de
-- student_simulator_access.sql.
-- La configuración se comparte por carrera y solo puede modificarla un docente
-- de esa misma carrera a través del backend administrativo.

create table if not exists public.teacher_simulator_settings (
  career_slug text primary key
    check (career_slug in ('enfermeria', 'psicologia')),
  enabled_difficulties text[] not null
    default array['facil', 'media', 'dificil']::text[],
  enabled_categories text[] not null,
  enabled_phases text[] not null default array['fase-1']::text[],
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint teacher_simulator_settings_difficulties_not_empty
    check (cardinality(enabled_difficulties) > 0),
  constraint teacher_simulator_settings_difficulties_valid
    check (
      enabled_difficulties
      <@ array['facil', 'media', 'dificil']::text[]
    ),
  constraint teacher_simulator_settings_categories_not_empty
    check (cardinality(enabled_categories) > 0),
  constraint teacher_simulator_settings_phases_not_empty
    check (cardinality(enabled_phases) > 0),
  constraint teacher_simulator_settings_phases_valid
    check (
      enabled_phases
      <@ array['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5']::text[]
    )
);

-- Permite volver a ejecutar esta migración en instalaciones donde la tabla ya
-- existía antes de incorporar el filtro por fases.
alter table public.teacher_simulator_settings
add column if not exists enabled_phases text[] not null
default array['fase-1']::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_simulator_settings_phases_not_empty'
      and conrelid = 'public.teacher_simulator_settings'::regclass
  ) then
    alter table public.teacher_simulator_settings
    add constraint teacher_simulator_settings_phases_not_empty
    check (cardinality(enabled_phases) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'teacher_simulator_settings_phases_valid'
      and conrelid = 'public.teacher_simulator_settings'::regclass
  ) then
    alter table public.teacher_simulator_settings
    add constraint teacher_simulator_settings_phases_valid
    check (
      enabled_phases
      <@ array['fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5']::text[]
    );
  end if;
end;
$$;

insert into public.teacher_simulator_settings (
  career_slug,
  enabled_categories
)
values
  (
    'enfermeria',
    array[
      'procedimientos-clinicos',
      'mujer-recien-nacido',
      'adulto-mayor',
      'comunitario',
      'bases-profesionales'
    ]::text[]
  ),
  (
    'psicologia',
    array[
      'crisis',
      'grupal',
      'asesoramiento',
      'proceso',
      'encuadre',
      'psicoterapia'
    ]::text[]
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
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        (
          teacher_simulator_settings.career_slug = 'enfermeria'
          and lower(trim(coalesce(profile.career, ''))) in
            ('enfermeria', 'enfermería')
        )
        or
        (
          teacher_simulator_settings.career_slug = 'psicologia'
          and lower(trim(coalesce(profile.career, ''))) in
            ('psicologia', 'psicología')
        )
      )
  )
);

notify pgrst, 'reload schema';

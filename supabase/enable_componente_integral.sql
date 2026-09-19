-- Ejecutar en Supabase SQL Editor para habilitar el Componente Integral y
-- guardar una configuración independiente por docente.

create table if not exists public.teacher_simulator_settings (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  career_slug text not null check (career_slug in ('enfermeria', 'psicologia')),
  enabled_difficulties text[] not null default array['facil', 'media', 'dificil']::text[],
  enabled_categories text[] not null default array['procedimientos-clinicos']::text[],
  enabled_phases text[] not null default array['fase-1']::text[],
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (teacher_id, career_slug)
);

alter table public.teacher_simulator_settings
add column if not exists enabled_phases text[] not null default array['fase-1']::text[];

alter table public.teacher_simulator_settings
add column if not exists teacher_id uuid references public.profiles(id) on delete cascade;

update public.teacher_simulator_settings settings
set teacher_id = coalesce(
  settings.updated_by,
  (
    select teacher.id
    from public.profiles teacher
    where teacher.role = 'teacher'
      and (
        (settings.career_slug = 'enfermeria' and lower(trim(coalesce(teacher.career, ''))) in ('enfermeria', 'enfermería'))
        or
        (settings.career_slug = 'psicologia' and lower(trim(coalesce(teacher.career, ''))) in ('psicologia', 'psicología'))
      )
    order by teacher.created_at nulls last
    limit 1
  )
)
where settings.teacher_id is null;

delete from public.teacher_simulator_settings where teacher_id is null;

alter table public.teacher_simulator_settings
drop constraint if exists teacher_simulator_settings_pkey;

alter table public.teacher_simulator_settings
alter column teacher_id set not null,
add primary key (teacher_id, career_slug);

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
        teacher_simulator_settings.teacher_id = profile.id
        or (
          profile.role = 'student'
          and profile.created_by_teacher_id = teacher_simulator_settings.teacher_id
        )
      )
  )
);

notify pgrst, 'reload schema';

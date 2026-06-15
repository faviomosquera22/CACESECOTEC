-- Ejecutar en Supabase SQL Editor.
-- Permite que usuarios con profile.role = 'teacher' puedan leer perfiles de estudiantes
-- y asignar carrera a estudiantes sin abrir permisos generales de UPDATE.

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "Teachers can read profiles" on public.profiles;
create policy "Teachers can read profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.current_profile_role() = 'teacher'
);

create or replace function public.assign_student_career(
  target_student_id uuid,
  new_career text
)
returns table (
  id uuid,
  career text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  normalized_career text;
begin
  select profiles.role
  into caller_role
  from public.profiles
  where profiles.id = auth.uid();

  if caller_role is distinct from 'teacher' then
    raise exception 'Solo docentes pueden asignar carreras.'
      using errcode = '42501';
  end if;

  normalized_career := case
    when lower(trim(new_career)) in ('enfermeria', 'enfermería') then 'Enfermería'
    when lower(trim(new_career)) in ('psicologia', 'psicología') then 'Psicología'
    else null
  end;

  if normalized_career is null then
    raise exception 'Carrera no válida.'
      using errcode = '22023';
  end if;

  return query
  update public.profiles
  set career = normalized_career
  where profiles.id = target_student_id
    and profiles.role = 'student'
  returning profiles.id, profiles.career;

  if not found then
    raise exception 'No se encontró un estudiante para actualizar.'
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.assign_student_career(uuid, text) to authenticated;

-- Ejecutar después de las tablas y políticas base.
-- Restringe cada docente a una carrera según su correo institucional de prueba.

create or replace function public.current_teacher_career_scope()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(email, ''))
    when 'tester.teacher@caces.local' then 'enfermeria'
    when 'tester.psicologia@caces.local' then 'psicologia'
    else null
  end
  from public.profiles
  where id = auth.uid()
    and role = 'teacher'
$$;

create or replace function public.teacher_can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles student
    where student.id = target_student_id
      and student.role = 'student'
      and case public.current_teacher_career_scope()
        when 'enfermeria' then lower(coalesce(student.career, '')) in ('enfermeria', 'enfermería')
        when 'psicologia' then lower(coalesce(student.career, '')) in ('psicologia', 'psicología')
        else false
      end
  )
$$;

-- Asignación de alcance visible en el perfil de cada docente.
update public.profiles
set career = 'Enfermería'
where email = 'tester.teacher@caces.local'
  and role = 'teacher';

update public.profiles
set career = 'Psicología'
where email = 'tester.psicologia@caces.local'
  and role = 'teacher';

drop policy if exists "Teachers can read profiles" on public.profiles;
drop policy if exists "Teachers can read scoped student profiles" on public.profiles;
create policy "Teachers can read scoped student profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.teacher_can_access_student(id)
);

-- Algunos proyectos antiguos todavía no tienen las tablas de historial.
-- Estas políticas se crean únicamente cuando la tabla respectiva existe.
do $$
begin
  if to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Teachers can read simulations" on public.simulations';
    execute 'drop policy if exists "Teachers can read scoped simulations" on public.simulations';
    execute 'create policy "Teachers can read scoped simulations" on public.simulations for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;

  if to_regclass('public.simulation_answers') is not null
    and to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Teachers can read simulation answers" on public.simulation_answers';
    execute 'drop policy if exists "Teachers can read scoped simulation answers" on public.simulation_answers';
    execute 'create policy "Teachers can read scoped simulation answers" on public.simulation_answers for select to authenticated using (exists (select 1 from public.simulations where simulations.id = simulation_answers.simulation_id and public.teacher_can_access_student(simulations.student_id)))';
  end if;

  if to_regclass('public.simulation_attempts') is not null then
    execute 'drop policy if exists "Teachers can read simulation attempts" on public.simulation_attempts';
    execute 'drop policy if exists "Teachers can read scoped simulation attempts" on public.simulation_attempts';
    execute 'create policy "Teachers can read scoped simulation attempts" on public.simulation_attempts for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;
end;
$$;

-- La función usada por el panel también queda limitada al mismo alcance.
create or replace function public.assign_student_career(
  target_student_id uuid,
  new_career text
)
returns table (id uuid, career text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_scope text;
  normalized_career text;
begin
  caller_scope := public.current_teacher_career_scope();
  normalized_career := case
    when lower(trim(new_career)) in ('enfermeria', 'enfermería') then 'Enfermería'
    when lower(trim(new_career)) in ('psicologia', 'psicología') then 'Psicología'
    else null
  end;

  if caller_scope is null then
    raise exception 'Solo docentes con carrera asignada pueden asignar carreras.'
      using errcode = '42501';
  end if;

  if normalized_career is null then
    raise exception 'Carrera no válida.' using errcode = '22023';
  end if;

  if normalized_career <> case caller_scope
    when 'enfermeria' then 'Enfermería'
    when 'psicologia' then 'Psicología'
  end then
    raise exception 'No puedes asignar una carrera distinta a tu alcance.'
      using errcode = '42501';
  end if;

  if not public.teacher_can_access_student(target_student_id) then
    raise exception 'No puedes modificar estudiantes de otra carrera.'
      using errcode = '42501';
  end if;

  return query
  update public.profiles
  set career = normalized_career
  where profiles.id = target_student_id
    and profiles.role = 'student'
  returning profiles.id, profiles.career;
end;
$$;

grant execute on function public.assign_student_career(uuid, text) to authenticated;

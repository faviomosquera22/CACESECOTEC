-- Ejecutar una vez en Supabase SQL Editor en instalaciones existentes.
-- La autorización depende de profiles.career y no del correo del docente.

create or replace function public.current_teacher_career_scope()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(career, ''))) in ('enfermeria', 'enfermería')
      then 'enfermeria'
    when lower(trim(coalesce(career, ''))) in ('psicologia', 'psicología')
      then 'psicologia'
    else null
  end
  from public.profiles
  where id = auth.uid()
    and role = 'teacher'
$$;

create or replace function public.teacher_can_access_student(
  target_student_id uuid
)
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
        when 'enfermeria' then lower(trim(coalesce(student.career, ''))) in
          ('enfermeria', 'enfermería')
        when 'psicologia' then lower(trim(coalesce(student.career, ''))) in
          ('psicologia', 'psicología')
        else false
      end
  )
$$;

revoke all on function public.current_teacher_career_scope() from public;
grant execute on function public.current_teacher_career_scope()
to authenticated, service_role;

revoke all on function public.teacher_can_access_student(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid)
to authenticated, service_role;

drop policy if exists "Teachers can read profiles" on public.profiles;
drop policy if exists "Teachers can read scoped student profiles"
on public.profiles;
create policy "Teachers can read scoped student profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.teacher_can_access_student(id)
);

do $$
begin
  if to_regclass('public.student_simulator_access') is not null then
    execute 'drop policy if exists "Teachers can read scoped simulator access" on public.student_simulator_access';
    execute 'create policy "Teachers can read scoped simulator access" on public.student_simulator_access for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;
end;
$$;

notify pgrst, 'reload schema';

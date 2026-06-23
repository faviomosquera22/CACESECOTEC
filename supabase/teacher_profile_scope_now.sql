-- Ejecuta este archivo completo en Supabase SQL Editor.
-- Está diseñado para el proyecto actual, que aún no tiene tablas de historial.

update public.profiles
set career = 'Enfermería'
where email = 'tester.teacher@caces.local'
  and role = 'teacher';

update public.profiles
set career = 'Psicología'
where email = 'tester.psicologia@caces.local'
  and role = 'teacher';

create or replace function public.teacher_can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as 'select exists (
  select 1
  from public.profiles student
  where student.id = target_student_id
    and student.role = ''student''
    and exists (
      select 1
      from public.profiles teacher
      where teacher.id = auth.uid()
        and teacher.role = ''teacher''
        and (
          (lower(coalesce(teacher.email, '''')) = ''tester.teacher@caces.local'' and lower(coalesce(student.career, '''')) in (''enfermeria'', ''enfermería''))
          or
          (lower(coalesce(teacher.email, '''')) = ''tester.psicologia@caces.local'' and lower(coalesce(student.career, '''')) in (''psicologia'', ''psicología''))
        )
    )
)';

drop policy if exists "Teachers can read profiles" on public.profiles;
drop policy if exists "Teachers can read scoped student profiles" on public.profiles;

create policy "Teachers can read scoped student profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.teacher_can_access_student(id)
);

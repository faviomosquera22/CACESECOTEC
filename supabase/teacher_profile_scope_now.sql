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
as $$
  select exists (
    select 1
    from public.profiles student
    join public.profiles teacher on teacher.id = auth.uid()
    where student.id = target_student_id
      and student.role = 'student'
      and teacher.role = 'teacher'
      and case
        when lower(trim(coalesce(teacher.career, ''))) in
          ('enfermeria', 'enfermería')
          then lower(trim(coalesce(student.career, ''))) in
            ('enfermeria', 'enfermería')
        when lower(trim(coalesce(teacher.career, ''))) in
          ('psicologia', 'psicología')
          then lower(trim(coalesce(student.career, ''))) in
            ('psicologia', 'psicología')
        else false
      end
  )
$$;

drop policy if exists "Teachers can read profiles" on public.profiles;
drop policy if exists "Teachers can read scoped student profiles" on public.profiles;

create policy "Teachers can read scoped student profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.teacher_can_access_student(id)
);

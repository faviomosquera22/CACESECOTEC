-- Ejecuta este archivo completo en Supabase SQL Editor.
-- Cada estudiante queda asociado al docente que lo creó. Un docente solo puede
-- consultar los estudiantes de su propia lista y su respectivo historial.

alter table public.profiles
add column if not exists created_by_teacher_id uuid
references public.profiles(id) on delete set null;

create index if not exists profiles_created_by_teacher_id_idx
on public.profiles (created_by_teacher_id)
where role = 'student';

-- Asigna a Jetzabel los estudiantes que se registraron con su cuenta antes de
-- que existiera esta columna. No modifica estudiantes registrados previamente.
update public.profiles
set created_by_teacher_id = (
  select id from public.profiles
  where email = 'jetzabel.pendolema@tester' and role = 'teacher'
)
where email in (
  'mariatorres@est.ecotec.edu.ec',
  'jennavera@est.ecotec.edu.ec',
  'wprocel@est.ecotec.edu.ec',
  'xcruz@est.ecotec.edu.ec',
  'joshcoronel@est.ecotec.edu.ec',
  'allsanchez@est.ecotec.edu.ec',
  'keilrodriguez@est.edu.ec',
  'favio@tester.com'
)
and role = 'student';

-- Conserva la lista histórica del docente de pruebas. Solo completa registros
-- sin propietario para no modificar los estudiantes ya asignados a otro docente.
update public.profiles
set created_by_teacher_id = (
  select id from public.profiles
  where email = 'tester.teacher@caces.local' and role = 'teacher'
)
where role = 'student'
  and career = 'Enfermería'
  and created_by_teacher_id is null;

create or replace function public.teacher_can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles teacher
    join public.profiles student on student.id = target_student_id
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and student.role = 'student'
      and student.created_by_teacher_id = teacher.id
  )
$$;

revoke all on function public.teacher_can_access_student(uuid) from public;
grant execute on function public.teacher_can_access_student(uuid)
to authenticated, service_role;

drop policy if exists "Teachers can read profiles" on public.profiles;
drop policy if exists "Teachers can read scoped student profiles" on public.profiles;
drop policy if exists "Teachers can read owned student profiles" on public.profiles;
create policy "Teachers can read owned student profiles"
on public.profiles for select to authenticated
using (auth.uid() = id or public.teacher_can_access_student(id));

do $$
begin
  if to_regclass('public.student_simulator_access') is not null then
    execute 'drop policy if exists "Teachers can read scoped simulator access" on public.student_simulator_access';
    execute 'drop policy if exists "Teachers can read owned simulator access" on public.student_simulator_access';
    execute 'create policy "Teachers can read owned simulator access" on public.student_simulator_access for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;
  if to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Teachers can read simulations" on public.simulations';
    execute 'drop policy if exists "Teachers can read scoped simulations" on public.simulations';
    execute 'drop policy if exists "Teachers can read owned simulations" on public.simulations';
    execute 'create policy "Teachers can read owned simulations" on public.simulations for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;
  if to_regclass('public.simulation_answers') is not null and to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Teachers can read simulation answers" on public.simulation_answers';
    execute 'drop policy if exists "Teachers can read scoped simulation answers" on public.simulation_answers';
    execute 'drop policy if exists "Teachers can read owned simulation answers" on public.simulation_answers';
    execute 'create policy "Teachers can read owned simulation answers" on public.simulation_answers for select to authenticated using (exists (select 1 from public.simulations where simulations.id = simulation_answers.simulation_id and public.teacher_can_access_student(simulations.student_id)))';
  end if;
  if to_regclass('public.simulation_attempts') is not null then
    execute 'drop policy if exists "Teachers can read simulations attempts" on public.simulation_attempts';
    execute 'drop policy if exists "Teachers can read scoped simulation attempts" on public.simulation_attempts';
    execute 'drop policy if exists "Teachers can read owned simulation attempts" on public.simulation_attempts';
    execute 'create policy "Teachers can read owned simulation attempts" on public.simulation_attempts for select to authenticated using (public.teacher_can_access_student(student_id))';
  end if;
end;
$$;

notify pgrst, 'reload schema';

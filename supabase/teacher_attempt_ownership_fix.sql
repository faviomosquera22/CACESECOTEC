-- Repair the legacy permissive policy left by the misspelled policy name.
-- Apply after teacher_student_ownership.sql. Preserves attempts and access states.
begin;

drop policy if exists "Teachers can read simulation attempts" on public.simulation_attempts;
drop policy if exists "Teachers can read simulations attempts" on public.simulation_attempts;
drop policy if exists "Teachers can read scoped simulation attempts" on public.simulation_attempts;
drop policy if exists "Teachers can read owned simulation attempts" on public.simulation_attempts;
create policy "Teachers can read owned simulation attempts"
on public.simulation_attempts for select to authenticated
using (public.teacher_can_access_student(student_id));

commit;
notify pgrst, 'reload schema';

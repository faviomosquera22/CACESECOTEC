drop policy if exists "Students can update own simulations" on public.simulations;

create policy "Students can update own simulations"
on public.simulations for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

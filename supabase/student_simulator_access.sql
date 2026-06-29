-- Ejecutar una vez en Supabase, después de teacher_career_scopes.sql y de los
-- scripts de almacenamiento, antes de desplegar el código de esta función.
-- El estado inicial es bloqueado para todos los estudiantes existentes y nuevos.

create table if not exists public.student_simulator_access (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create index if not exists student_simulator_access_enabled_idx
on public.student_simulator_access (enabled);

insert into public.student_simulator_access (student_id, enabled)
select id, false
from public.profiles
where role = 'student'
on conflict (student_id) do nothing;

alter table public.student_simulator_access enable row level security;

grant select on table public.student_simulator_access to authenticated;
grant all on table public.student_simulator_access to service_role;
revoke insert, update, delete on table public.student_simulator_access
from anon, authenticated;

drop policy if exists "Students can read own simulator access"
on public.student_simulator_access;
create policy "Students can read own simulator access"
on public.student_simulator_access for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Teachers can read scoped simulator access"
on public.student_simulator_access;
create policy "Teachers can read scoped simulator access"
on public.student_simulator_access for select to authenticated
using (public.teacher_can_access_student(student_id));

create or replace function public.student_simulator_is_enabled(
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
    from public.student_simulator_access simulator_access
    where simulator_access.student_id = target_student_id
      and simulator_access.enabled = true
  )
$$;

revoke all on function public.student_simulator_is_enabled(uuid) from public;
grant execute on function public.student_simulator_is_enabled(uuid)
to authenticated, service_role;

-- Protección en la base de datos: un estudiante bloqueado tampoco puede
-- guardar intentos o borradores desde una pestaña que ya estaba abierta.
do $$
begin
  if to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Students can insert own simulations" on public.simulations';
    execute 'create policy "Students can insert own simulations" on public.simulations for insert to authenticated with check (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid()))';

    execute 'drop policy if exists "Students can update own simulations" on public.simulations';
    execute 'create policy "Students can update own simulations" on public.simulations for update to authenticated using (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid())) with check (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid()))';
  end if;

  if to_regclass('public.simulation_answers') is not null
    and to_regclass('public.simulations') is not null then
    execute 'drop policy if exists "Students can insert own simulation answers" on public.simulation_answers';
    execute 'create policy "Students can insert own simulation answers" on public.simulation_answers for insert to authenticated with check (public.student_simulator_is_enabled(auth.uid()) and exists (select 1 from public.simulations where simulations.id = simulation_answers.simulation_id and simulations.student_id = auth.uid()))';
  end if;

  if to_regclass('public.simulation_attempts') is not null then
    execute 'drop policy if exists "Students can insert own simulation attempts" on public.simulation_attempts';
    execute 'create policy "Students can insert own simulation attempts" on public.simulation_attempts for insert to authenticated with check (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid()))';
  end if;

  if to_regclass('public.simulation_drafts') is not null then
    execute 'drop policy if exists "Students can insert own simulation drafts" on public.simulation_drafts';
    execute 'create policy "Students can insert own simulation drafts" on public.simulation_drafts for insert to authenticated with check (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid()))';

    execute 'drop policy if exists "Students can update own simulation drafts" on public.simulation_drafts';
    execute 'create policy "Students can update own simulation drafts" on public.simulation_drafts for update to authenticated using (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid())) with check (student_id = auth.uid() and public.student_simulator_is_enabled(auth.uid()))';
  end if;
end;
$$;

notify pgrst, 'reload schema';

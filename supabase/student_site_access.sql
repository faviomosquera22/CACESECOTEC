-- Aplicar después de student_simulator_access.sql y de las tablas de contenido.
-- El interruptor existente pasa a controlar todo el sitio del estudiante.
-- No modifica estados de acceso ni elimina reportes o intentos.
begin;

create or replace function public.current_user_has_site_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'teacher'
        or (p.role = 'student' and public.student_simulator_is_enabled(p.id))
      )
  )
$$;

revoke all on function public.current_user_has_site_access() from public;
grant execute on function public.current_user_has_site_access()
to authenticated, service_role;

-- RESTRICTIVE combina este requisito con TODAS las políticas permisivas
-- existentes. Otra política de lectura no puede saltarse el bloqueo.
-- Los docentes conservan su alcance actual: esta política no concede acceso.
do $$
declare
  content_table text;
begin
  foreach content_table in array array[
    'questions', 'teacher_questions', 'teacher_simulator_settings',
    'simulations', 'simulation_answers', 'simulation_attempts', 'simulation_drafts'
  ] loop
    if to_regclass(format('public.%I', content_table)) is not null then
      execute format('alter table public.%I enable row level security', content_table);
      execute format('drop policy if exists "Require active student site access" on public.%I', content_table);
      execute format(
        'create policy "Require active student site access" on public.%I
         as restrictive for all to authenticated
         using ((select public.current_user_has_site_access()))
         with check ((select public.current_user_has_site_access()))',
        content_table
      );
    end if;
  end loop;
end;
$$;

-- La identidad y el estado de acceso siguen siendo legibles para mostrar
-- el motivo del bloqueo, cerrar sesión y reconocer una habilitación posterior.
-- Un estudiante bloqueado tampoco puede editar su perfil directamente.
drop policy if exists "Require site access for profile updates" on public.profiles;
create policy "Require site access for profile updates" on public.profiles
as restrictive for update to authenticated
using ((select public.current_user_has_site_access()))
with check ((select public.current_user_has_site_access()));

drop policy if exists "Require site access for profile inserts" on public.profiles;
create policy "Require site access for profile inserts" on public.profiles
as restrictive for insert to authenticated
with check ((select public.current_user_has_site_access()));

drop policy if exists "Require site access for profile deletes" on public.profiles;
create policy "Require site access for profile deletes" on public.profiles
as restrictive for delete to authenticated
using ((select public.current_user_has_site_access()));

commit;
notify pgrst, 'reload schema';

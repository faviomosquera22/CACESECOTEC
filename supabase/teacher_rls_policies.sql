-- Ejecutar en Supabase SQL Editor.
-- Permite que usuarios con profile.role = 'teacher' puedan leer perfiles de estudiantes.

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

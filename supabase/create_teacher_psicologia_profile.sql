-- 1. Crea primero el usuario en Supabase Auth con este correo:
--    tester.psicologia@caces.local
-- 2. Ejecuta este script en el SQL Editor para asignarle el perfil y alcance.

insert into public.profiles (id, full_name, email, role, career)
select
  id,
  'Docente Psicología',
  'tester.psicologia@caces.local',
  'teacher',
  'Psicología'
from auth.users
where lower(email) = 'tester.psicologia@caces.local'
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  career = excluded.career;

-- Ejecutar en Supabase SQL Editor para habilitar el usuario docente tester.
-- El usuario ya existe en Supabase Auth; esta fila crea su perfil de aplicación.

insert into public.profiles (id, full_name, email, role, career)
values (
  '57267f8f-89e2-42cc-82df-9850c0651b00',
  'Docente Tester',
  'tester.teacher@caces.local',
  'teacher',
  'Docente'
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  career = excluded.career;

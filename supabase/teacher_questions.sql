-- Banco manual por docente. Ejecutar antes de desplegar la interfaz.
begin;
create table if not exists public.teacher_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  career_slug text not null check (career_slug in ('enfermeria', 'psicologia')),
  question_text text not null check (length(trim(question_text)) between 1 and 12000),
  option_a text not null check (length(trim(option_a)) between 1 and 3000),
  option_b text not null check (length(trim(option_b)) between 1 and 3000),
  option_c text not null check (length(trim(option_c)) between 1 and 3000),
  option_d text not null check (length(trim(option_d)) between 1 and 3000),
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text not null check (length(trim(explanation)) between 1 and 12000),
  phase text not null,
  difficulty text not null check (difficulty in ('Fácil', 'Media', 'Difícil')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (career_slug = 'enfermeria' and phase in ('fase-1','fase-2','fase-3','fase-4','fase-5','componente-integral'))
    or (career_slug = 'psicologia' and phase in ('fase-1','fase-2'))
  )
);
create index if not exists teacher_questions_owner_idx
  on public.teacher_questions (teacher_id, career_slug, published, created_at);
alter table public.teacher_questions enable row level security;
revoke all on public.teacher_questions from anon, authenticated;
grant select, insert, update on public.teacher_questions to authenticated;
grant all on public.teacher_questions to service_role;

drop policy if exists "Teachers manage own questions" on public.teacher_questions;
create policy "Teachers manage own questions" on public.teacher_questions
for all to authenticated
using (
  teacher_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
      and translate(lower(trim(p.career)), 'íé', 'ie') = teacher_questions.career_slug
  )
)
with check (
  teacher_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
      and translate(lower(trim(p.career)), 'íé', 'ie') = teacher_questions.career_slug
  )
);
drop policy if exists "Students read own teachers published questions" on public.teacher_questions;
create policy "Students read own teachers published questions" on public.teacher_questions
for select to authenticated using (
  published and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student'
      and p.created_by_teacher_id = teacher_questions.teacher_id
      and translate(lower(trim(p.career)), 'íé', 'ie') = teacher_questions.career_slug
  )
);
commit;
notify pgrst, 'reload schema';

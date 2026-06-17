create extension if not exists pgcrypto;

create table if not exists public.simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_slug text not null,
  client_attempt_id text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  total_questions integer,
  correct_answers integer,
  incorrect_answers integer,
  score numeric,
  time_used_seconds integer,
  answers jsonb not null default '[]'::jsonb,
  comments jsonb not null default '{}'::jsonb,
  status text not null default 'finished',
  created_at timestamp with time zone default now(),
  unique (student_id, client_attempt_id)
);

create index if not exists simulation_attempts_student_created_idx
on public.simulation_attempts (student_id, created_at desc);

alter table public.simulation_attempts enable row level security;

drop policy if exists "Students can read own simulation attempts" on public.simulation_attempts;
create policy "Students can read own simulation attempts"
on public.simulation_attempts for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own simulation attempts" on public.simulation_attempts;
create policy "Students can insert own simulation attempts"
on public.simulation_attempts for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can read simulation attempts" on public.simulation_attempts;
create policy "Teachers can read simulation attempts"
on public.simulation_attempts for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

create table if not exists public.simulation_drafts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_slug text not null,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique (student_id, exam_slug)
);

create index if not exists simulation_drafts_student_exam_idx
on public.simulation_drafts (student_id, exam_slug);

alter table public.simulation_drafts enable row level security;

drop policy if exists "Students can read own simulation drafts" on public.simulation_drafts;
create policy "Students can read own simulation drafts"
on public.simulation_drafts for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own simulation drafts" on public.simulation_drafts;
create policy "Students can insert own simulation drafts"
on public.simulation_drafts for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Students can update own simulation drafts" on public.simulation_drafts;
create policy "Students can update own simulation drafts"
on public.simulation_drafts for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "Students can delete own simulation drafts" on public.simulation_drafts;
create policy "Students can delete own simulation drafts"
on public.simulation_drafts for delete to authenticated
using (student_id = auth.uid());

notify pgrst, 'reload schema';

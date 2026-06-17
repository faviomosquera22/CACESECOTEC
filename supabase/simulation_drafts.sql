create table if not exists public.simulation_drafts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_slug text not null,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique (student_id, exam_slug)
);

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

begin;
create table if not exists public.question_components (
  key text primary key default ('custom-' || gen_random_uuid()::text),
  career_slug text not null check (career_slug in ('enfermeria','psicologia')),
  label text not null check (length(trim(label)) between 3 and 120),
  description text not null default '' check (length(description) <= 500),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (key ~ '^custom-[0-9a-f-]{36}$')
);
create unique index if not exists question_components_name on public.question_components(career_slug, lower(trim(label)));
create table if not exists public.pdf_question_imports (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  career_slug text not null check (career_slug in ('enfermeria','psicologia')),
  filename text not null,
  file_hash text not null,
  preview jsonb not null,
  status text not null default 'preview' check (status in ('preview','completed')),
  result jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.imported_questions (
  id uuid primary key default gen_random_uuid(),
  career_slug text not null check (career_slug in ('enfermeria','psicologia')),
  phase text not null,
  question jsonb not null,
  fingerprint text not null,
  import_id uuid not null references public.pdf_question_imports(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(career_slug, fingerprint)
);
alter table public.question_components enable row level security;
alter table public.pdf_question_imports enable row level security;
alter table public.imported_questions enable row level security;
revoke all on public.question_components, public.pdf_question_imports, public.imported_questions from anon, authenticated;
grant all on public.question_components, public.pdf_question_imports, public.imported_questions to service_role;
create index if not exists imported_questions_career on public.imported_questions(career_slug, id);
create index if not exists pdf_question_imports_teacher on public.pdf_question_imports(teacher_id, created_at);

-- Una confirmación es atómica e idempotente; cargas concurrentes no duplican reactivos.
create or replace function public.complete_pdf_question_import(p_import_id uuid, p_teacher_id uuid, p_phase text, p_questions jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare batch public.pdf_question_imports%rowtype; inserted_count integer; candidate jsonb; result_value jsonb;
begin
  select * into batch from public.pdf_question_imports where id=p_import_id and teacher_id=p_teacher_id for update;
  if not found then raise exception 'Importación no encontrada'; end if;
  if not exists (select 1 from public.profiles where id=p_teacher_id and role='teacher' and translate(lower(trim(career)), 'íé', 'ie')=batch.career_slug) then raise exception 'Docente no autorizado'; end if;
  if batch.status='completed' then return batch.result; end if;
  if batch.created_at < now()-interval '24 hours' then raise exception 'Vista previa vencida'; end if;
  if not ((batch.career_slug='enfermeria' and p_phase in ('fase-1','fase-2','fase-3','fase-4','fase-5')) or (batch.career_slug='psicologia' and p_phase in ('fase-1','fase-2')) or exists (select 1 from public.question_components where key=p_phase and career_slug=batch.career_slug)) then raise exception 'Componente inválido'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions)>300 then raise exception 'Preguntas inválidas'; end if;
  insert into public.imported_questions(career_slug, phase, question, fingerprint, import_id, created_by)
  select batch.career_slug,p_phase,item->'question',item->>'fingerprint',batch.id,p_teacher_id from jsonb_array_elements(p_questions) item
  on conflict (career_slug, fingerprint) do nothing;
  get diagnostics inserted_count = row_count;
  result_value := jsonb_build_object('inserted',inserted_count,'duplicates',jsonb_array_length(p_questions)-inserted_count,'phase',p_phase);
  update public.pdf_question_imports set status='completed',result=result_value where id=batch.id;
  return result_value;
end;
$$;
revoke all on function public.complete_pdf_question_import(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_pdf_question_import(uuid,uuid,text,jsonb) to service_role;
-- Mantiene ajustes históricos y permite componentes nuevos de la misma carrera.
create or replace function public.simulator_phases_are_valid(p_career text, p_phases text[])
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from unnest(p_phases) phase
    where phase is null or not (
      phase in ('fase-1','fase-2','fase-3','fase-4','fase-5','componente-integral')
      or exists (select 1 from public.question_components c where c.key=phase and c.career_slug=p_career)
    )
  );
$$;
revoke all on function public.simulator_phases_are_valid(text,text[]) from public, anon, authenticated;
grant execute on function public.simulator_phases_are_valid(text,text[]) to service_role;
alter table public.teacher_simulator_settings drop constraint if exists teacher_simulator_settings_phases_valid;
alter table public.teacher_simulator_settings add constraint teacher_simulator_settings_phases_valid
check (public.simulator_phases_are_valid(career_slug, enabled_phases));
commit;
notify pgrst, 'reload schema';

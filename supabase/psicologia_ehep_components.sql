-- Enable all five psychology phases in manual and PDF imports.
begin;
create table public.psychology_ehep_questions (
  id text primary key,
  question jsonb not null,
  check (jsonb_typeof(question) = 'object' and question->>'id' is not distinct from id)
);
alter table public.psychology_ehep_questions enable row level security;
revoke all on public.psychology_ehep_questions from public, anon, authenticated;
grant select, insert, update on public.psychology_ehep_questions to service_role;

alter table public.teacher_questions
  drop constraint teacher_questions_check,
  add constraint teacher_questions_check check (
    (career_slug = 'enfermeria' and phase in ('fase-1','fase-2','fase-3','fase-4','fase-5','componente-integral'))
    or (career_slug = 'psicologia' and phase in ('fase-1','fase-2','fase-3','fase-4','fase-5'))
  );

create or replace function public.complete_pdf_question_import(p_import_id uuid, p_teacher_id uuid, p_phase text, p_questions jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare batch public.pdf_question_imports%rowtype; inserted_count integer; candidate jsonb; result_value jsonb;
begin
  select * into batch from public.pdf_question_imports where id=p_import_id and teacher_id=p_teacher_id for update;
  if not found then raise exception 'Importación no encontrada'; end if;
  if not exists (select 1 from public.profiles where id=p_teacher_id and role='teacher' and translate(lower(trim(career)), 'íé', 'ie')=batch.career_slug) then raise exception 'Docente no autorizado'; end if;
  if batch.status='completed' then return batch.result; end if;
  if batch.created_at < now()-interval '24 hours' then raise exception 'Vista previa vencida'; end if;
  if not ((batch.career_slug='enfermeria' and p_phase in ('fase-1','fase-2','fase-3','fase-4','fase-5')) or (batch.career_slug='psicologia' and p_phase in ('fase-1','fase-2','fase-3','fase-4','fase-5')) or exists (select 1 from public.question_components where key=p_phase and career_slug=batch.career_slug)) then raise exception 'Componente inválido'; end if;
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
commit;

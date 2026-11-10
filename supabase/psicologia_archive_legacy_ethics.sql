begin;
alter table public.question_components add column archived_at timestamptz;

update public.question_components
set archived_at = statement_timestamp()
where career_slug = 'psicologia'
  and lower(trim(label)) = lower('Componente 3: Ética, deontología y marco legal');
commit;

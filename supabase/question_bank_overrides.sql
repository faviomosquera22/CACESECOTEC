begin;
create table if not exists public.question_bank_overrides (
  question_id text primary key,
  career_slug text not null check (career_slug in ('enfermeria','psicologia')),
  question jsonb not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.question_bank_revision_history (
  id bigint generated always as identity primary key,
  question_id text not null,
  career_slug text not null,
  previous_question jsonb,
  question jsonb not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.question_bank_overrides enable row level security;
alter table public.question_bank_revision_history enable row level security;
revoke all on public.question_bank_overrides, public.question_bank_revision_history from anon, authenticated;
grant all on public.question_bank_overrides, public.question_bank_revision_history to service_role;
grant usage, select on sequence public.question_bank_revision_history_id_seq to service_role;
create or replace function public.audit_question_bank_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  insert into public.question_bank_revision_history(question_id,career_slug,previous_question,question,updated_by)
  values(new.question_id,new.career_slug,case when TG_OP = 'UPDATE' then old.question else null end,new.question,new.updated_by);
  return new;
end;
$$;
revoke all on function public.audit_question_bank_revision() from public, anon, authenticated;
create or replace trigger audit_question_bank_revision before insert or update on public.question_bank_overrides
for each row execute function public.audit_question_bank_revision();
commit;

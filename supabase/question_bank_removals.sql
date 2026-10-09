begin;
-- Retiro reversible: las fuentes y los intentos históricos permanecen intactos.
create table if not exists public.question_bank_removals (
  career_slug text not null check (career_slug in ('enfermeria','psicologia')),
  kind text not null check (kind in ('question','component')),
  target_id text not null check (length(target_id) between 1 and 200),
  label text not null,
  owner_id uuid references public.profiles(id),
  removed boolean not null default true,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (career_slug,kind,target_id)
);
create table if not exists public.question_bank_removal_history (
  id bigint generated always as identity primary key,
  career_slug text not null,
  kind text not null,
  target_id text not null,
  label text not null,
  owner_id uuid,
  removed boolean not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null
);
alter table public.question_bank_removals enable row level security;
alter table public.question_bank_removal_history enable row level security;
revoke all on public.question_bank_removals, public.question_bank_removal_history from anon, authenticated;
grant all on public.question_bank_removals, public.question_bank_removal_history to service_role;
grant usage, select on sequence public.question_bank_removal_history_id_seq to service_role;
create or replace function public.audit_bank_removal() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists (select 1 from public.profiles where id=new.updated_by and role='teacher'
    and translate(lower(trim(career)), 'íé', 'ie')=new.career_slug) then raise exception 'Docente no autorizado'; end if;
  if new.owner_id is not null and new.owner_id <> new.updated_by then raise exception 'Pregunta ajena'; end if;
  new.updated_at := clock_timestamp();
  insert into public.question_bank_removal_history(career_slug,kind,target_id,label,owner_id,removed,updated_by,updated_at)
  values(new.career_slug,new.kind,new.target_id,new.label,new.owner_id,new.removed,new.updated_by,new.updated_at);
  return new;
end $$;
revoke all on function public.audit_bank_removal() from public, anon, authenticated;
create or replace trigger audit_bank_removal before insert or update on public.question_bank_removals
for each row execute function public.audit_bank_removal();
commit;
notify pgrst, 'reload schema';

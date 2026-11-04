-- Apply after student_site_access.sql. The latest sign-in wins for students.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keep the winning ID after logout, so an older session cannot become active
-- again. Only the Auth INSERT trigger can change this registry.
create table if not exists private.latest_user_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null
);
alter table private.latest_user_sessions enable row level security;
revoke all on private.latest_user_sessions from public, anon, authenticated;

create or replace function private.track_latest_user_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.latest_user_sessions as current_session (user_id, session_id, created_at)
  values (new.user_id, new.id, coalesce(new.created_at, clock_timestamp()))
  on conflict (user_id) do update
    set session_id = excluded.session_id, created_at = excluded.created_at
    where (excluded.created_at, excluded.session_id) >
          (current_session.created_at, current_session.session_id);
  return new;
end;
$$;
revoke all on function private.track_latest_user_session() from public, anon, authenticated;

-- Lock out concurrent inserts until the trigger and initial registry agree.
lock table auth.sessions in share row exclusive mode;
drop trigger if exists track_latest_user_session on auth.sessions;
create trigger track_latest_user_session after insert on auth.sessions
for each row execute function private.track_latest_user_session();

insert into private.latest_user_sessions as current_session (user_id, session_id, created_at)
select distinct on (user_id) user_id, id, coalesce(created_at, '-infinity'::timestamptz)
from auth.sessions order by user_id, created_at desc nulls last, id desc
on conflict (user_id) do update
  set session_id = excluded.session_id, created_at = excluded.created_at
  where (excluded.created_at, excluded.session_id) >
        (current_session.created_at, current_session.session_id);

-- Private definer lookup avoids RLS recursion and never accepts a user-supplied
-- user/session ID. Identity comes exclusively from the signed request JWT.
create or replace function private.current_session_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and (p.role = 'teacher' or (p.role = 'student' and exists (
        select 1 from private.latest_user_sessions latest
        join auth.sessions s on s.id = latest.session_id and s.user_id = latest.user_id
        where latest.user_id = p.id
          and latest.session_id::text = auth.jwt()->>'session_id'
          and (s.not_after is null or s.not_after > now())
      )))
  );
$$;
revoke all on function private.current_session_is_active() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_session_is_active() to authenticated;

-- An invoker wrapper exposes only the caller's boolean status via RPC.
create or replace function public.current_session_is_active()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.current_session_is_active();
$$;
revoke all on function public.current_session_is_active() from public, anon;
grant execute on function public.current_session_is_active() to authenticated;

-- Restrictive policies preserve every existing ownership/career restriction.
do $$
declare content_table text;
begin
  for content_table in select tablename from pg_tables
    where schemaname = 'public' and rowsecurity and tablename <> 'profiles'
  loop
    execute format('drop policy if exists "Require current student session" on public.%I', content_table);
    execute format('create policy "Require current student session" on public.%I
      as restrictive for all to authenticated
      using ((select private.current_session_is_active()))
      with check ((select private.current_session_is_active()))', content_table);
  end loop;
end;
$$;

-- Identity remains readable to distinguish an ended session from a missing
-- profile. Profile writes, like all content operations, require the winner.
drop policy if exists "Require current session for profile updates" on public.profiles;
create policy "Require current session for profile updates" on public.profiles
as restrictive for update to authenticated
using ((select private.current_session_is_active()))
with check ((select private.current_session_is_active()));
drop policy if exists "Require current session for profile inserts" on public.profiles;
create policy "Require current session for profile inserts" on public.profiles
as restrictive for insert to authenticated
with check ((select private.current_session_is_active()));
drop policy if exists "Require current session for profile deletes" on public.profiles;
create policy "Require current session for profile deletes" on public.profiles
as restrictive for delete to authenticated
using ((select private.current_session_is_active()));

commit;
notify pgrst, 'reload schema';

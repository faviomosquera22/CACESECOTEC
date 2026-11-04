-- Run in the SQL editor after student_single_session.sql. All fixtures roll back.
begin;
do $$
declare
  student uuid := gen_random_uuid();
  teacher uuid := gen_random_uuid();
  old_session uuid := gen_random_uuid();
  new_session uuid := gen_random_uuid();
  teacher_session uuid := gen_random_uuid();
  teacher_session_two uuid := gen_random_uuid();
begin
  insert into auth.users (id) values (student), (teacher);
  insert into public.profiles (id, role, full_name)
    values (student, 'student', 'Single session test'), (teacher, 'teacher', 'Session test teacher');
  insert into public.student_simulator_access (student_id, enabled) values (student, true);
  insert into auth.sessions (id, user_id, created_at)
    values (old_session, student, now() - interval '2 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', student, 'role', 'authenticated', 'session_id', old_session)::text, true);
  set local role authenticated;
  if not public.current_session_is_active() then raise exception 'First student session denied'; end if;
  if (select count(*) from public.student_simulator_access where student_id = student) <> 1 then raise exception 'First session cannot read access'; end if;
  reset role;

  insert into auth.sessions (id, user_id, created_at)
    values (new_session, student, now() - interval '1 minute');
  set local role authenticated;
  if public.current_session_is_active() then raise exception 'Old student session still active'; end if;
  if exists (select 1 from public.student_simulator_access where student_id = student) then raise exception 'Old JWT bypassed RLS'; end if;
  if exists (select 1 from public.questions) then raise exception 'Old JWT can still read questions'; end if;
  begin
    insert into private.latest_user_sessions values (student, old_session, now());
    raise exception 'Student can overwrite session registry';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Refreshing an older session must never take ownership back.
  update auth.sessions set updated_at = now(), refreshed_at = now() where id = old_session;
  perform set_config('request.jwt.claims', json_build_object('sub', student, 'role', 'authenticated', 'session_id', new_session)::text, true);
  set local role authenticated;
  if not public.current_session_is_active() then raise exception 'Latest student session denied'; end if;
  if (select count(*) from public.student_simulator_access where student_id = student) <> 1 then raise exception 'Latest session cannot read access'; end if;
  reset role;

  -- Deleting the winner (logout) must not revive an old device.
  delete from auth.sessions where id = new_session;
  set local role authenticated;
  if public.current_session_is_active() then raise exception 'Deleted session still active'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', student, 'role', 'authenticated', 'session_id', old_session)::text, true);
  set local role authenticated;
  if public.current_session_is_active() then raise exception 'Older session revived after logout'; end if;
  reset role;

  insert into auth.sessions (id, user_id, created_at)
    values (teacher_session, teacher, now() - interval '2 minutes'), (teacher_session_two, teacher, now());
  perform set_config('request.jwt.claims', json_build_object('sub', teacher, 'role', 'authenticated', 'session_id', teacher_session)::text, true);
  set local role authenticated;
  if not public.current_session_is_active() then raise exception 'Teacher restricted to one session'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', teacher, 'role', 'authenticated', 'session_id', teacher_session_two)::text, true);
  set local role authenticated;
  if not public.current_session_is_active() then raise exception 'Second teacher session denied'; end if;
  reset role;

  -- Missing session claim fails closed for students.
  perform set_config('request.jwt.claims', json_build_object('sub', student, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.current_session_is_active() then raise exception 'Missing student session claim allowed'; end if;
  reset role;
end;
$$;
select 'PASS: new login wins; old JWT denied by RLS; registry protected; refresh cannot reclaim; logout cannot revive; teachers unaffected; missing claim denied' as result;
rollback;

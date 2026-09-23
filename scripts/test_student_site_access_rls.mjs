// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Uses an isolated in-memory PostgreSQL instance; never connects to production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to the installed PGlite dist/index.js path.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const studentId = '00000000-0000-4000-8000-000000000001';
const otherStudentId = '00000000-0000-4000-8000-000000000002';
const teacherId = '00000000-0000-4000-8000-000000000003';
const otherTeacherId = '00000000-0000-4000-8000-000000000004';
const missingAccessId = '00000000-0000-4000-8000-000000000005';
const tables = ['questions', 'teacher_questions', 'teacher_simulator_settings', 'simulations', 'simulation_answers', 'simulation_attempts', 'simulation_drafts'];
const migration = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/student_site_access.sql'), 'utf8');

try {
  await db.exec(`
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
    create table public.profiles (id uuid primary key, role text, full_name text);
    insert into profiles values
      ('${studentId}', 'student', 'Student'),
      ('${otherStudentId}', 'student', 'Other student'),
      ('${teacherId}', 'teacher', 'Teacher'),
      ('${otherTeacherId}', 'teacher', 'Other teacher'),
      ('${missingAccessId}', 'student', 'No access record');
    alter table profiles enable row level security;
    grant select, update on profiles to authenticated;
    create policy own_profile on profiles for select to authenticated using (id = auth.uid());
    create policy edit_profile on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
    create table student_simulator_access (student_id uuid primary key, enabled boolean);
    insert into student_simulator_access values ('${studentId}', true), ('${otherStudentId}', true);
    alter table student_simulator_access enable row level security;
    grant select on student_simulator_access to authenticated;
    create policy read_access on student_simulator_access for select to authenticated using (student_id = auth.uid());
    create function public.student_simulator_is_enabled(target_student_id uuid)
    returns boolean language sql stable security definer set search_path = public as $$
      select exists(select 1 from public.student_simulator_access where student_id = target_student_id and enabled = true)
    $$;
  `);
  for (const table of tables) {
    await db.exec(`
      create table public.${table} (id int primary key, student_id uuid, teacher_id uuid, payload text);
      insert into public.${table} values
        (1, '${studentId}', '${teacherId}', 'private report'),
        (2, '${otherStudentId}', '${otherTeacherId}', 'unrelated report');
      alter table public.${table} enable row level security;
      grant select, insert, update, delete on public.${table} to authenticated;
      create policy student_scope on public.${table} for all to authenticated
        using (student_id = auth.uid()) with check (student_id = auth.uid());
      create policy teacher_scope on public.${table} for select to authenticated using (teacher_id = auth.uid());
    `);
  }
  await db.exec(migration);
  await db.exec(migration); // Must be safe to apply again.
  const asUser = async id => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
  };
  await asUser(studentId);
  for (const table of tables) {
    assert.equal((await db.query(`select * from ${table}`)).rows.length, 1);
    assert.equal((await db.query(`update ${table} set payload = 'kept report' where id = 1 returning id`)).rows.length, 1);
  }
  assert.equal((await db.query("update profiles set full_name = 'Enabled' where id = auth.uid() returning id")).rows.length, 1);
  await db.exec(`reset role; update student_simulator_access set enabled = false where student_id = '${studentId}'`);
  await asUser(studentId);
  for (const table of tables) {
    assert.equal((await db.query(`select * from ${table}`)).rows.length, 0, 'blocked SELECT: ' + table);
    assert.equal((await db.query(`update ${table} set payload = 'forbidden' returning id`)).rows.length, 0, 'blocked UPDATE: ' + table);
    assert.equal((await db.query(`delete from ${table} returning id`)).rows.length, 0, 'blocked DELETE: ' + table);
    await assert.rejects(db.query(`insert into ${table} values (3, '${studentId}', '${teacherId}', 'forbidden')`), /row-level security/);
  }
  assert.equal((await db.query("update profiles set full_name = 'Forbidden' where id = auth.uid() returning id")).rows.length, 0);
  assert.equal((await db.query('select * from profiles')).rows.length, 1, 'identity remains available');
  assert.equal((await db.query('select enabled from student_simulator_access')).rows[0].enabled, false);

  await asUser(teacherId);
  for (const table of tables) {
    assert.deepEqual((await db.query(`select id from ${table}`)).rows, [{ id: 1 }], 'teacher still reads scoped blocked-student data: ' + table);
    assert.equal((await db.query(`update ${table} set payload = 'forbidden' returning id`)).rows.length, 0, 'no new teacher write permission');
  }
  await asUser(otherTeacherId);
  for (const table of tables) assert.deepEqual((await db.query(`select id from ${table}`)).rows, [{ id: 2 }]);
  await asUser(missingAccessId);
  assert.equal((await db.query('select current_user_has_site_access() as enabled')).rows[0].enabled, false);
  for (const table of tables) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);

  await db.exec(`reset role; update student_simulator_access set enabled = true where student_id = '${studentId}'`);
  await asUser(studentId);
  for (const table of tables) assert.deepEqual((await db.query(`select payload from ${table}`)).rows, [{ payload: 'kept report' }], 're-enabled data preserved');
  console.log('PASS: idempotent migration; 7 tables deny blocked reads/writes; profile editing denied; teacher scopes preserved; re-enabling restores preserved reports.');
} finally {
  await db.close();
}

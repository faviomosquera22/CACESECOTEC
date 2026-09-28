import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const compiled = { exports: {} }; cache.set(file, compiled.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const resolve = name => {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) { let full = path.join(root, 'src', name.slice(2)); if (!path.extname(full)) full += '.ts'; return load(full); }
      return require(name);
    };
    vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: file })(resolve, compiled, compiled.exports);
    return compiled.exports;
  }
  return relative => load(path.join(root, relative));
}
const teacher = { id: 'teacher-one', role: 'teacher', career: 'Enfermería' };
const own = { id: '00000000-0000-4000-8000-000000000001', role: 'student', career: 'Enfermería', created_by_teacher_id: teacher.id, email: 'own@example.test', full_name: 'Own student' };
const foreign = { ...own, id: '00000000-0000-4000-8000-000000000002', created_by_teacher_id: 'teacher-two', email: 'foreign@example.test' };
const unowned = { ...own, id: '00000000-0000-4000-8000-000000000003', created_by_teacher_id: null };
const otherCareer = { ...own, id: '00000000-0000-4000-8000-000000000004', career: 'Psicología' };
const basePath = 'src/app/api/teacher/students/';
const cases = [
  ['[studentId]/simulator-access/route.ts', 'PATCH', { enabled: false }],
  ['[studentId]/route.ts', 'PATCH', { email: 'changed@example.test' }],
  ['[studentId]/route.ts', 'DELETE', undefined],
  ['[studentId]/career/route.ts', 'PATCH', { careerSlug: 'enfermeria' }],
];
function harness(profile = teacher, rows = [own, foreign, unowned, otherCareer], failRead = false) {
  const mutations = [];
  const admin = {
    auth: { admin: {
      updateUserById: async (id, input) => { mutations.push({ action: 'authUpdate', id, input }); return { error: null }; },
      deleteUser: async id => { mutations.push({ action: 'authDelete', id }); return { error: null }; },
    } },
    from(table) {
      let filters = [], update = null;
      const result = (single = false) => {
        if (failRead) return { data: null, error: { message: 'database unavailable' } };
        const selected = rows.filter(row => filters.every(fn => fn(row)));
        if (update) for (const row of selected) mutations.push({ action: 'profileUpdate', id: row.id, input: update });
        const data = selected.map(row => ({ ...row, ...update }));
        return { data: single ? data[0] ?? null : data, error: null };
      };
      const query = {
        select: () => query,
        eq: (key, value) => { filters.push(row => row[key] === value); return query; },
        neq: (key, value) => { filters.push(row => row[key] !== value); return query; },
        update: input => { update = input; return query; },
        maybeSingle: async () => result(true), single: async () => result(true), returns: async () => result(),
        upsert: async input => { mutations.push({ action: table, input }); return { error: null }; },
      };
      return query;
    },
  };
  return { mutations, load: loader({
    '@/lib/auth': { getCurrentAuthContext: async () => profile ? { profile } : null },
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => admin },
  }) };
}
const request = (method, body) => new Request('https://example.test/api/teacher/students', { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const params = id => ({ params: Promise.resolve({ studentId: id }) });

test('individual actions reject other teachers, unowned students and other careers without mutation', async () => {
  for (const [file, method, body] of cases) for (const student of [foreign, unowned, otherCareer]) {
    const h = harness();
    const response = await h.load(basePath + file)[method](request(method, { ...body, teacher_id: 'teacher-two', created_by_teacher_id: 'teacher-two' }), params(student.id));
    assert.ok([403, 404].includes(response.status), file + ' must reject ' + student.id);
    assert.deepEqual(h.mutations, []);
  }
});

test('individual actions still work for the authenticated teacher own students', async () => {
  for (const [file, method, body] of cases) {
    const h = harness();
    assert.equal((await h.load(basePath + file)[method](request(method, body), params(own.id))).status, 200, file);
    assert.ok(h.mutations.length > 0);
    for (const mutation of h.mutations) assert.equal(mutation.id ?? mutation.input.student_id, own.id);
  }
});

test('bulk enable and disable only update own students and ignore client supplied teacher', async () => {
  for (const enabled of [true, false]) {
    const h = harness();
    const response = await h.load(basePath + 'simulator-access/route.ts').PATCH(request('PATCH', { enabled, teacher_id: 'teacher-two' }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).updatedCount, 1);
    assert.equal(h.mutations.length, 1);
    assert.deepEqual(h.mutations[0].input.map(row => [row.student_id, row.enabled, row.updated_by]), [[own.id, enabled, teacher.id]]);
  }
});

test('empty new teacher roster does not change other accounts', async () => {
  const h = harness({ ...teacher, id: 'new-teacher' });
  const response = await h.load(basePath + 'simulator-access/route.ts').PATCH(request('PATCH', { enabled: false }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).updatedCount, 0);
  assert.deepEqual(h.mutations, []);
});

test('all actions fail closed without authorization or when database lookup fails', async () => {
  for (const [file, method, body] of [...cases, ['simulator-access/route.ts', 'PATCH', { enabled: true }]]) {
    for (const [profile, failRead, expected] of [[null, false, 401], [{ ...teacher, role: 'student' }, false, 403], [teacher, true, 500]]) {
      const h = harness(profile, [own, foreign], failRead);
      assert.equal((await h.load(basePath + file)[method](request(method, body), params(own.id))).status, expected);
      assert.deepEqual(h.mutations, []);
    }
  }
});

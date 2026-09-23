-- Prueba de RLS sin conservar datos: toda escritura termina en ROLLBACK.
begin;
do $$
declare pair record;
begin
  select t.id teacher_id, s.id student_id,
    translate(lower(trim(t.career)), 'íé', 'ie') career
  into pair from public.profiles t join public.profiles s on s.created_by_teacher_id = t.id
  where t.role = 'teacher' and s.role = 'student'
    and translate(lower(trim(t.career)), 'íé', 'ie') in ('enfermeria','psicologia')
    and translate(lower(trim(s.career)), 'íé', 'ie') = translate(lower(trim(t.career)), 'íé', 'ie')
  limit 1;
  if not found then raise exception 'Se requiere un docente con estudiante asignado para verificar RLS'; end if;
  perform set_config('qa.teacher', pair.teacher_id::text, true);
  perform set_config('qa.student', pair.student_id::text, true);
  perform set_config('qa.career', pair.career, true);
  perform set_config('qa.question', gen_random_uuid()::text, true);
  perform set_config('qa.draft', gen_random_uuid()::text, true);
end $$;
set local role authenticated;
do $$
declare matches integer;
begin
  perform set_config('request.jwt.claim.sub', current_setting('qa.teacher'), true);
  insert into public.teacher_questions(id, teacher_id, career_slug, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, phase, difficulty, published)
  values(current_setting('qa.question')::uuid, auth.uid(), current_setting('qa.career'), 'Prueba transaccional', 'Uno', 'Dos', 'Tres', 'Cuatro', 'C', 'Prueba de clave C', 'fase-1', 'Media', true),
        (current_setting('qa.draft')::uuid, auth.uid(), current_setting('qa.career'), 'Borrador transaccional', 'Uno', 'Dos', 'Tres', 'Cuatro', 'B', 'Prueba de borrador', 'fase-1', 'Media', false);
  update public.teacher_questions set correct_option = 'D' where id = current_setting('qa.question')::uuid;
  select count(*) into matches from public.teacher_questions where id in (current_setting('qa.question')::uuid, current_setting('qa.draft')::uuid);
  if matches <> 2 then raise exception 'El docente no puede ver sus dos preguntas'; end if;
  if not exists(select 1 from public.teacher_questions where id = current_setting('qa.question')::uuid and correct_option = 'D') then raise exception 'El docente no puede editar'; end if;
  perform set_config('request.jwt.claim.sub', current_setting('qa.student'), true);
  select count(*) into matches from public.teacher_questions where id in (current_setting('qa.question')::uuid, current_setting('qa.draft')::uuid);
  if matches <> 1 then raise exception 'El estudiante debe ver solo la publicada'; end if;
  update public.teacher_questions set correct_option = 'A' where id = current_setting('qa.question')::uuid;
  get diagnostics matches = row_count;
  if matches <> 0 then raise exception 'El estudiante pudo editar'; end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  select count(*) into matches from public.teacher_questions where id in (current_setting('qa.question')::uuid, current_setting('qa.draft')::uuid);
  if matches <> 0 then raise exception 'Una identidad ajena pudo leer las preguntas'; end if;
end $$;
rollback;
select 'RLS correcto: creación, edición, borradores y aislamiento; sin datos de prueba guardados' as resultado;

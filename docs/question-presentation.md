# Presentación de enunciados

La revisión del 17 de octubre de 2026 cubrió 4.029 filas de los siete bancos locales y 754 filas de Supabase: 651 preguntas, 100 preguntas importadas y 3 correcciones. No había preguntas manuales. Los totales incluyen copias entre fuentes y bancos anteriores; no son un conteo de preguntas únicas o activas.

Se encontraron siete preguntas adicionales que aún se mostraban como un párrafo:

| Documento | Pregunta | Presentación |
| --- | --- | --- |
| CACES 18 | 41: técnicas didácticas | Dos columnas |
| CACES 18 | 61: zonas para medir la temperatura | Dos columnas |
| CACES 18 | 94: enfermedades prevenibles por vacuna | Lista numerada |
| CACES 19 | 1: objetivos y principios de salud reproductiva | Dos columnas |
| CACES 19 | 32: signos y síntomas del desprendimiento placentario | Lista con literales |
| CACES 19 | 68: herramientas metodológicas | Dos columnas |
| CACES 19 | 70: prácticas seguras y procedimientos | Dos columnas |

Junto con los casos que ya se reconocían, hay 31 preguntas con listas o relaciones: 25 listas y 6 vistas de dos columnas. No quedaron candidatos pendientes en esta revisión. Cinco coincidencias se revisaron como texto normal: puntuaciones clínicas, abreviaturas y usos de «se asocie» o «se relacione» que no introducen listas.

`getQuestionPresentation` separa listas completas y conserva las abreviaturas internas, por ejemplo «Hepatitis B.». Las tablas intercaladas de PDF usan una presentación revisada asociada al texto fuente completo. Si un docente modifica el texto, la reconstrucción anterior deja de aplicarse. Los enunciados almacenados, las alternativas y las claves no se modifican.

## Repetir la auditoría

```bash
node scripts/audit_question_presentation.mjs
node --test scripts/test_question_presentation.mjs
```

Para incluir la base de datos, preparar mediante consultas de solo lectura una instantánea JSON con las columnas `source`, `id` y `question_text` de `questions`, `imported_questions`, `question_bank_overrides` y `teacher_questions`. No incluir información de alumnos, cuentas ni credenciales. Las columnas de texto de las tablas JSONB se extraen de `question.question_text`.

```bash
node scripts/audit_question_presentation.mjs \
  --database /ruta/instantanea.json \
  --review-date AAAA-MM-DD \
  --output docs/question-presentation-audit.json
```

El programa termina con código 1 si encuentra candidatos sin revisar. La revisión de una nueva coincidencia debe comprobar el texto original antes de clasificarla como lista, tabla o texto normal. La instantánea de Supabase no se guarda en el repositorio; el informe conserva los conteos y los casos revisados. Las preguntas añadidas después de la fecha de la instantánea requieren una nueva auditoría.

# Correcciones del banco compartido

Aplicar `question_bank_overrides.sql` antes de desplegar la aplicación. Se ejecutó en CACESECOTEC el 01/10/2026.

`/teacher/questions` carga los bancos locales completos y todas las filas de `questions` de la carrera del docente, sin limitarse a la muestra del simulador. Las preguntas manuales conservan su editor y propietario.

La API `/api/teacher/question-bank` verifica sesión, rol docente, carrera, origen, pertenencia del identificador y revisión esperada. Solo después usa el cliente administrativo. Las tablas de correcciones e historial tienen RLS habilitado y no conceden acceso directo a `anon` ni `authenticated`. Un trigger registra las versiones guardadas. El control por `updated_at` y la clave primaria evita sobrescrituras concurrentes.

Las correcciones se aplican antes de seleccionar las preguntas del próximo intento, tanto al banco local como al banco Supabase. Se conserva el formato de una respuesta escrita y de 3–5 opciones. Los intentos existentes conservan su snapshot; no se recalifican automáticamente.

Las revisiones de espejos (C → B) y posición post mortem (B → A, incluyendo su copia en el banco general) están en `src/data/reviewedQuestionCorrections.json`. Este registro mantiene la clave fuente y la explicación, y se aplica después de importar los bancos: regenerarlos no restaura las claves erróneas. Las ediciones posteriores guardadas por docentes tienen prioridad.

Validación: `node --test scripts/test_question_bank.mjs scripts/test_manual_questions.mjs scripts/test_teacher_student_ownership.mjs` y `npm run build -- --webpack`.

## Retiro del Componente Integral (05/10/2026)

Se retiró del catálogo activo, contador, editor compartido, preguntas manuales y selección de nuevos intentos. Las configuraciones antiguas descartan esta fase; si no quedan fases válidas, se usan los cinco componentes habituales. Los documentos fuente, correcciones y snapshots históricos se conservan como archivo, sin incorporarse a nuevos intentos. No se requiere borrar datos de Supabase.

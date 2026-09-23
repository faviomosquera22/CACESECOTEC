# Simulador CACES Privado

Aplicación privada en Next.js, TypeScript, Tailwind CSS y Supabase para que estudiantes practiquen simulaciones tipo CACES y docentes revisen historial académico.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Completa las variables públicas de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Los usuarios deben crearse manualmente en Supabase Auth. Cada usuario necesita un registro en `profiles` con `role` igual a `student` o `teacher`.

## Rutas

- `/login`
- `/student/dashboard`
- `/student/simulator`
- `/student/results/[simulationId]`
- `/teacher/dashboard`
- `/teacher/students/[studentId]`

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Verificación

```bash
npm run lint
npm run build
```

## Tablas esperadas

La app consume las tablas `profiles`, `questions`, `simulations`,
`simulation_answers`, `simulation_attempts`, `simulation_drafts`,
`student_simulator_access` y `teacher_simulator_settings` en Supabase.

Para habilitar los controles docentes de dificultad y categoría en una
instalación existente, ejecuta
`supabase/teacher_simulator_settings.sql` en el SQL Editor después de
`supabase/student_simulator_access.sql`.

La misma migración es reutilizable: si la tabla ya existe, vuelve a ejecutarla
para incorporar el selector de fases. Todas las preguntas sin una fase
explícita se consideran parte de `fase-1`.

## Preguntas manuales del docente

En **Banco de preguntas**, cada docente puede crear y editar preguntas de su carrera:

- Enunciado, cuatro opciones distintas, clave explícita A–D y explicación obligatoria.
- Componente y dificultad; guardado en borrador o publicación para sus estudiantes.
- Para retirar una pregunta de próximos intentos, editarla y desmarcar «Publicar para mis estudiantes».
- Las preguntas publicadas participan solo si su componente está habilitado en el Dashboard. El Componente Integral incluye todo su banco en orden aleatorio; los otros componentes mantienen la muestra habitual.
- Los resultados terminados conservan su copia histórica de preguntas y respuestas.

La persistencia requiere ejecutar `supabase/teacher_questions.sql` antes del despliegue. RLS restringe la edición al docente propietario y la lectura estudiantil a preguntas publicadas de su docente y carrera. `supabase/verify_teacher_questions.sql` verifica estos permisos dentro de una transacción que se revierte; requiere un docente con estudiante asignado.

Pruebas del formulario, API y selección del banco: `node --test scripts/test_manual_questions.mjs`.

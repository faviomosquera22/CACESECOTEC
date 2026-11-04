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
- `/access-blocked`
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

El test dispone de 90 minutos. Al salir y regresar, recupera las respuestas y
el tiempo restante guardado; las horas fuera del test no se descuentan.
El navegador guarda el reloj cada segundo y la sincronización remota se actualiza
también cada 15 segundos. En el mismo navegador se recupera el borrador más
reciente. Un borrador vacío con tiempo agotado vuelve a iniciar con 90 minutos;
los intentos con respuestas conservan el tiempo consumido.

Pruebas del reloj, recuperación y finalización sin modificar datos reales:
`node --test scripts/test_simulator_timer.mjs`.

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

## Bloqueo completo del estudiante

El control **Acceso al sitio** del panel docente utiliza el estado existente
`student_simulator_access.enabled`. Si está deshabilitado o no existe, el
estudiante no puede entrar al dashboard, perfil, historial, simulador ni a los
reportes (incluidos los guardados localmente). Solo puede ver el aviso de bloqueo,
verificar si el docente habilitó su acceso o cerrar sesión. Las páginas abiertas
verifican el estado cada 15 segundos, al recuperar el foco y al navegar.

Antes de publicar esta versión, ejecutar `supabase/student_site_access.sql`
después de `supabase/student_simulator_access.sql` y las migraciones de contenido.
Sus políticas RLS restrictivas también deniegan lecturas y escrituras directas de
un estudiante bloqueado en Supabase. Conservan los permisos previos de los docentes
y los registros del estudiante. Si se añaden nuevas tablas de contenido, deben
incluir la misma restricción.

Pruebas de rutas, reportes, API y pestañas abiertas:
`node --test scripts/test_student_site_access.mjs`.

La prueba de RLS usa PostgreSQL en memoria con `@electric-sql/pglite`, sin tocar
producción. Con el paquete instalado en una carpeta temporal, ejecutar
`PGLITE_MODULE=/ruta/al/paquete/dist/index.js node scripts/test_student_site_access_rls.mjs`.

## Una sesión por estudiante

Aplicar `supabase/student_single_session.sql` después de `student_site_access.sql`
y antes de publicar el código. El último inicio de sesión de un estudiante
reemplaza al anterior, incluso cuando se inicia directamente mediante Supabase.
Los docentes mantienen sus sesiones simultáneas. Las pestañas del mismo navegador
comparten sesión; otro navegador o un perfil privado cuenta como otra sesión.

El registro privado se actualiza al crear una sesión de Auth, no al refrescar
tokens. RLS rechaza inmediatamente las operaciones nuevas de sesiones anteriores;
la pestaña abierta se retira en su próxima comprobación (cada 15 segundos o al
recuperar el foco). Cerrar la sesión ganadora no reactiva las anteriores. El cierre
de sesión de la aplicación usa alcance local para no revocar otros dispositivos.
El contenido ya enviado al navegador no puede retirarse retroactivamente.

El servidor verifica la sesión mediante `current_session_is_active()` antes de
consultar el perfil. Si la verificación falla, rechaza el acceso. La identidad
propia sigue siendo legible en la base para diferenciar una sesión terminada de
un perfil inexistente; las escrituras del perfil requieren la sesión vigente.
Las nuevas tablas públicas deben tener RLS y la política restrictiva de sesión
(volver a aplicar el script agrega la política a las tablas con RLS existentes).

Verificación de base de datos: ejecutar `scripts/test_student_single_session.sql`
después de la migración. Crea cuentas y sesiones de prueba dentro de una
transacción y revierte todos sus cambios al terminar. Las pruebas cubren cambio
de dispositivo, rechazo de JWT anterior por RLS, protección del registro privado,
refresco, cierre de sesión, sesiones docentes y ausencia de la identificación de
sesión. Pruebas de aplicación: `node --test scripts/test_student_site_access.mjs`.

## Traslado de estudiantes entre docentes

En la lista de estudiantes, **Trasladar estudiantes** permite buscar y seleccionar
hasta 100 estudiantes, elegir otro docente de la misma carrera y confirmar.
El docente emisor solo puede trasladar estudiantes propios. El traslado actualiza
`profiles.created_by_teacher_id`, conservando cuenta, carrera, historial y estado
de acceso al sitio. Desde entonces se aplica la configuración del simulador y el
banco de preguntas del docente receptor.

Usa la configuración existente `SUPABASE_SERVICE_ROLE_KEY` del servidor y la
columna de propiedad de `supabase/teacher_student_ownership.sql`; no requiere
nuevas tablas ni políticas. Las validaciones de sesión, carrera y propiedad se
ejecutan en la API y la actualización vuelve a comprobar el propietario actual.
Si una asignación cambia durante la operación, la respuesta identifica solo los
estudiantes efectivamente trasladados.

Pruebas de permisos, selección y concurrencia, sin modificar datos reales:
`node --test scripts/test_teacher_student_ownership.mjs`.

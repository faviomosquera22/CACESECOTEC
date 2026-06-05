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

La app consume las tablas `profiles`, `questions`, `simulations` y `simulation_answers` en Supabase.

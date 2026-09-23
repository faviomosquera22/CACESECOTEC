# Incorporación del PDF CACES OCTUBRE

Fuente: `CACES OCTUBRE..pdf`. SHA-256: `77b05637fc44dd8e1ca2b2e235391b6efea02b8663664e86af6eefe93f0f26ab`.

Se revisaron 39 reactivos: 30 incorporados y 9 pendientes de completar en el documento original.

Las claves se extraen del resaltado amarillo por la posición de los caracteres dentro de los rectángulos del PDF. Se conservan enunciados, opciones y letras de origen; solo se normalizan saltos de línea y espacios. Las explicaciones atribuyen la clave al PDF y no constituyen una validación clínica independiente.

Clasificación por el objetivo del reactivo: componente 1 para aislamiento, procedimiento respiratorio o perioperatorio, valoración inicial del trauma, administración o identificación de fármacos; componente 3 para patologías, atención geriátrica y cuidado del adulto. No hay reactivos completos de los componentes 2, 4 o 5.

El banco se agrega tanto a las cargas desde Supabase como a la carga local. Participa en los componentes normales habilitados; no se mezcla con el Componente Integral exclusivo.

| Reactivo | Página | Estado | Componente | Clave marcada | Motivo si queda pendiente |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | incorporada | fase-3 | D | — |
| 2 | 1 | pendiente | fase-3 | A | Una o más alternativas son notas de transcripción incompleta. |
| 3 | 1 | incorporada | fase-3 | B | — |
| 4 | 2 | pendiente | fase-3 | Sin letra marcada | Solo hay 0 opciones; se necesitan cuatro alternativas completas. |
| 5 | 2 | incorporada | fase-1 | B | — |
| 6 | 2 | incorporada | fase-3 | B | — |
| 7 | 3 | incorporada | fase-3 | A | — |
| 8 | 3 | incorporada | fase-3 | C | — |
| 9 | 3 | pendiente | fase-3 | A | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 10 | 4 | incorporada | fase-1 | B | — |
| 11 | 4 | incorporada | fase-1 | C | — |
| 12 | 4 | incorporada | fase-3 | B | — |
| 13 | 5 | incorporada | fase-3 | C | — |
| 14 | 5 | incorporada | fase-3 | C | — |
| 15 | 5 | incorporada | fase-3 | D | — |
| 16 | 6 | incorporada | fase-3 | B | — |
| 17 | 6 | incorporada | fase-3 | D | — |
| 18 | 6 | incorporada | fase-3 | C | — |
| 19 | 7 | incorporada | fase-1 | A | — |
| 20 | 7 | incorporada | fase-1 | A | — |
| 21 | 7 | incorporada | fase-3 | A | — |
| 22 | 7 | incorporada | fase-3 | A | — |
| 23 | 8 | incorporada | fase-1 | B | — |
| 24 | 8 | incorporada | fase-3 | B | — |
| 25 | 8 | incorporada | fase-3 | B | — |
| 26 | 9 | pendiente | fase-3 | B | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 27 | 9 | pendiente | fase-3 | B | Una o más alternativas son notas de transcripción incompleta. |
| 28 | 9 | incorporada | fase-3 | C | — |
| 29 | 10 | pendiente | fase-3 | Sin letra marcada | Solo hay 0 opciones; se necesitan cuatro alternativas completas. |
| 30 | 10 | incorporada | fase-3 | D | — |
| 31 | 10 | incorporada | fase-3 | C | — |
| 32 | 11 | incorporada | fase-1 | D | — |
| 33 | 11 | incorporada | fase-3 | B | — |
| 34 | 11 | pendiente | fase-1 | B | Una o más alternativas son notas de transcripción incompleta. |
| 35 | 12 | incorporada | fase-1 | C | — |
| 36 | 12 | incorporada | fase-3 | A | — |
| 37 | 12 | pendiente | fase-3 | C | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 38 | 12 | pendiente | fase-3 | C | Una o más alternativas son notas de transcripción incompleta. |
| 39 | 13 | incorporada | fase-3 | B | — |

Los pendientes conservan el texto completo disponible en `AUDITORIA.json`, incluida la respuesta abierta «Morfina» del reactivo 29. No se inventaron distractores para convertirlos en preguntas completas.

Reproducir con Python y pdfplumber: `python3 scripts/import_enfermeria_octubre_documento.py --check`.

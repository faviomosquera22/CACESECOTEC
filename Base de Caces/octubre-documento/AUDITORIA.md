# Incorporación del PDF CACES OCTUBRE

Fuente: `CACES OCTUBRE..pdf`. SHA-256: `77b05637fc44dd8e1ca2b2e235391b6efea02b8663664e86af6eefe93f0f26ab`.

Se revisaron 39 reactivos: 30 incorporados, 8 pendientes y 1 excluido por solicitud del usuario (reactivo 4).

Las claves se extraen del resaltado amarillo por la posición de los caracteres dentro de los rectángulos del PDF. Se conservan enunciados, opciones y letras de origen; solo se normalizan saltos de línea y espacios. Las explicaciones atribuyen la clave al PDF y no constituyen una validación clínica independiente.

Por solicitud del usuario, todo este banco pertenece al Componente Integral. La categoría temática conserva la clasificación clínica del reactivo.

El banco se agrega a la carga del Componente Integral, completo y en orden aleatorio por intento. Ya no participa en los componentes 1 ni 3.

| Reactivo | Página | Estado | Componente | Clave marcada | Motivo si queda pendiente |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | incorporada | componente-integral | D | — |
| 2 | 1 | pendiente | componente-integral | A | Una o más alternativas son notas de transcripción incompleta. |
| 3 | 1 | incorporada | componente-integral | B | — |
| 4 | 2 | excluida | componente-integral | Sin letra marcada | Excluida por solicitud expresa del usuario. |
| 5 | 2 | incorporada | componente-integral | B | — |
| 6 | 2 | incorporada | componente-integral | B | — |
| 7 | 3 | incorporada | componente-integral | A | — |
| 8 | 3 | incorporada | componente-integral | C | — |
| 9 | 3 | pendiente | componente-integral | A | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 10 | 4 | incorporada | componente-integral | B | — |
| 11 | 4 | incorporada | componente-integral | C | — |
| 12 | 4 | incorporada | componente-integral | B | — |
| 13 | 5 | incorporada | componente-integral | C | — |
| 14 | 5 | incorporada | componente-integral | C | — |
| 15 | 5 | incorporada | componente-integral | D | — |
| 16 | 6 | incorporada | componente-integral | B | — |
| 17 | 6 | incorporada | componente-integral | D | — |
| 18 | 6 | incorporada | componente-integral | C | — |
| 19 | 7 | incorporada | componente-integral | A | — |
| 20 | 7 | incorporada | componente-integral | A | — |
| 21 | 7 | incorporada | componente-integral | A | — |
| 22 | 7 | incorporada | componente-integral | A | — |
| 23 | 8 | incorporada | componente-integral | B | — |
| 24 | 8 | incorporada | componente-integral | B | — |
| 25 | 8 | incorporada | componente-integral | B | — |
| 26 | 9 | pendiente | componente-integral | B | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 27 | 9 | pendiente | componente-integral | B | Una o más alternativas son notas de transcripción incompleta. |
| 28 | 9 | incorporada | componente-integral | C | — |
| 29 | 10 | pendiente | componente-integral | Sin letra marcada | Solo hay 0 opciones; se necesitan cuatro alternativas completas. |
| 30 | 10 | incorporada | componente-integral | D | — |
| 31 | 10 | incorporada | componente-integral | C | — |
| 32 | 11 | incorporada | componente-integral | D | — |
| 33 | 11 | incorporada | componente-integral | B | — |
| 34 | 11 | pendiente | componente-integral | B | Una o más alternativas son notas de transcripción incompleta. |
| 35 | 12 | incorporada | componente-integral | C | — |
| 36 | 12 | incorporada | componente-integral | A | — |
| 37 | 12 | pendiente | componente-integral | C | Solo hay 3 opciones; se necesitan cuatro alternativas completas. |
| 38 | 12 | pendiente | componente-integral | C | Una o más alternativas son notas de transcripción incompleta. |
| 39 | 13 | incorporada | componente-integral | B | — |

Los pendientes conservan el texto completo disponible en `AUDITORIA.json`, incluida la respuesta abierta «Morfina» del reactivo 29. No se inventaron distractores para convertirlos en preguntas completas.

Reproducir con Python y pdfplumber: `python3 scripts/import_enfermeria_octubre_documento.py --check`.

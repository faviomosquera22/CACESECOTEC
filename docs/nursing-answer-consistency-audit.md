# Revisión de coherencia de preguntas de Enfermería

Fecha: 28 de octubre de 2026.

Se analizaron 4.926 registros de ocho bancos JSON de Enfermería, incluidos archivos históricos retirados. La búsqueda detecta opciones compartidas con enunciados de temas diferentes, respuestas discordantes en casos iguales o parecidos, claves vacías y formatos incompletos. Se revisaron en contexto los candidatos y se contrastaron los problemas confirmados con fuentes clínicas y educativas. No equivale a una validación clínica exhaustiva de cada respuesta. No se consultaron en esta revisión preguntas importadas exclusivamente en la base de datos ni correcciones privadas de docentes.

Las 12 correcciones están en `src/data/reviewedClinicalQuestionRepairs.json`, con identidad, enunciado original, motivo, cambio y fuente. Los archivos fuente originales permanecen intactos. La capa de corrección se aplica a nuevos intentos cuando coincide el enunciado y la identidad o la fuente/dificultad; también cubre copias de la base de datos con UUID diferente. Las revisiones docentes prevalecen. Los intentos guardados conservan sus snapshots y no se recalifican retroactivamente.

| Registros | Problema | Corrección |
| --- | --- | --- |
| 0916 y 1322 | Aldrete: opciones sobre integralidad en una copia; clave 9 y caso ambiguo en otra | Se reformula explícitamente el caso con variación de presión del 30 % y necesidad de oxígeno suplementario. Resultado: 1 + 2 + 1 + 2 + 1 = 7. Se reemplazan opciones por 7, 8, 9 y 10. Esto no afirma que el texto original tuviera un puntaje 7 inequívoco. |
| 0360 | Aldrete: presión basal y condición de oxigenación ausentes | Se especifica presión igual a la basal y SpO₂ 94 % al aire ambiente; resultado 9, con advertencia de que alcanzar el umbral no basta para autorizar el alta. |
| 1924, 2091 y CACES 19-047 | Obstrucción de vía aérea: alternativas sin maniobra de apertura y claves discordantes | Caso explícito de obstrucción por caída de lengua, sin trauma cervical; se prioriza apertura de vía aérea y comprobación de ventilación, con ayuda y soporte de oxigenación. |
| 1967 | Mismo caso de transfusión marcado como diurético en una copia y valoración previa en otra | Se corrige a valoración previa; premedicaciones según evaluación y prescripción individual. |
| 1999 y 2060 | Educación para la salud: objetivo poco específico y claves discordantes | Se explicitan preguntas abiertas y escucha activa; técnica de expresión en ambas versiones. |
| 0211 y 1178 | Vacunas: falta la característica a identificar | Se explicita vacuna bacteriana viva atenuada: BCG. Es una reformulación editorial, no una recuperación literal del PDF. |
| 1176 | Vacunas: falta la característica a identificar | Se explicita grupo viral vivo atenuado: SRP, varicela y fiebre amarilla. |

La búsqueda de opciones largas repetidas y enunciados poco similares generó 24 candidatos: la mezcla inequívoca fue la pregunta de Aldrete reportada. Compartir alternativas no implica un error: son normales las listas de trastornos ácido-base, patrones respiratorios y otros conjuntos usados en casos diferentes. La comparación de enunciados muy parecidos produjo 38 pares; muchos cambian un dato decisivo como flujo de oxígeno, minuto de vida, horas de sueño, PO₂/PCO₂, calor/frío o referencia/contrarreferencia. No se unificaron sus claves por similitud textual. Cinco grupos de enunciados normalizados iguales mostraban respuestas escritas de forma diferente: cuatro eran variantes ortográficas/de espaciado y uno era el conflicto de transfusión corregido.

No hubo claves inexistentes o que apuntasen a alternativas vacías en los 4.926 registros. Hay 15 formatos parciales o de respuesta escrita explícitamente documentados en bancos históricos; se conservaron y no se inventaron distractores.

## Fuentes

- [Society for Pediatric Anesthesia: Modified Aldrete Score, tabla 1](https://pedsanesthesia.org/wp-content/uploads/2024/05/Week-196-Modified-Aldrete-Score.pdf).
- [University of Toronto: Postoperative Complications — Respiratory](https://pie.med.utoronto.ca/anesthesiaqr/AnesthesiaQR_content/AnesthesiaQR_Postoperative_Complications_Respiratory.html).
- [Canadian Blood Services: Blood administration, Baseline Patient Assessment](https://profedu.blood.ca/en/transfusion/clinical-guide/blood-administration).
- [Gobierno de Navarra: Manual de Educación para la Salud, técnicas de expresión](https://www.navarra.es/NR/rdonlyres/A7EBFCE1-89F0-4406-81A7-7786919A25F7/490341/MANUALEpS2013_sincruces1.pdf).
- [CDC: Principles of Vaccination, vacunas vivas atenuadas](https://www2.cdc.gov/vaccines/ed/pinkbook/2024/PB1/PB1_POV.pdf).

Reproducir el inventario: `python3 scripts/audit_nursing_answer_consistency.py --check`. La auditoría JSON incluye hashes SHA-256 de los ocho bancos fuente, candidatos y motivos de corrección. Su clasificación documenta la revisión realizada; el script no decide automáticamente qué respuesta clínica es correcta.

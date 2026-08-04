-- Limpieza puntual de preguntas importadas con texto mezclado o truncado.
-- Ejecutar en Supabase SQL Editor si la tabla public.questions ya fue cargada.

begin;

update public.questions
set
  option_c = 'De las relaciones humanas.',
  explanation = 'La teoría científica, la clásica y la de las relaciones humanas forman parte de las teorías administrativas; socialista no corresponde como teoría administrativa clásica.'
where question_text = 'Las teorías sobre administración permiten identificar de donde provienen las ideas acerca de las organizaciones y la gente que las integra. De las siguientes opciones todas se refieren a teorías de la administración, EXCEPTO:'
  and option_c = 'De las';

update public.questions
set
  option_a = 'Mejorar las condiciones generales sin incorporar prácticas culturales.',
  explanation = 'El enfoque intercultural exige reconocer e incorporar conocimientos y prácticas de salud ancestrales dentro del plan operativo.'
where question_text = 'En un sector de una comunidad, por razones de trabajo minero existe una alta migración de un grupo étnico, usted debe atender a esa comunidad. Al realizar el plan operativo. ¿Cuál sería el objetivo prioritario del Plan, tomando en cuenta el enfoque intercultural?'
  and option_a = 'Mejorar las';

update public.questions
set
  option_a = 'Es aquel en que se debe mantener abstinencia sexual como método anticonceptivo.',
  explanation = 'El MELA se basa en lactancia materna exclusiva o casi exclusiva y ausencia de menstruación desde el parto; por eso corresponde la opción que integra ambas condiciones.'
where question_text = 'Seleccione el concepto del método anticonceptivo MELA:'
  and option_a = 'Es aquel en que se debe mantener una abstención de';

update public.questions
set
  question_text = 'La mecánica corporal estudia el funcionamiento correcto y armónico del aparato músculo-esquelético y le permite a la enfermera realizar movimientos correctos durante la movilización, traslado o transferencia de la persona o paciente. ¿De los siguientes principios básicos, cuál no debería aplicar en una correcta mecánica corporal?',
  option_c = 'Alinear las partes del cuerpo.',
  explanation = 'La mecánica corporal busca base de sustentación, alineación corporal y centro de gravedad bajo; las posturas con sobrecarga biomecánica no deben aplicarse.'
where question_text = 'La mecánica corporal estudia el funcionamiento correcto y armónico del aparato mÚsculo-esquelético y le permite a la enfermera realizar movimientos correctos durante la movilización, traslado o transferencia de la persona o paciente. ¿De los siguientes principios básicos, cuál no debería aplicar en una correcta mecánica corporal?'
  and option_c = 'Alinear las';

update public.questions
set
  question_text = '¿Qué condiciones debe reunir una paciente previo a la citología cervical?',
  option_d = 'Abstenerse de relaciones sexuales, duchas vaginales y uso de medicamentos vaginales antes del examen.',
  explanation = 'Antes de la citología cervical se evita menstruación, relaciones sexuales, duchas vaginales y medicamentos vaginales para no alterar la muestra.'
where question_text = '¿Que condiciones debe reunir una paciente previo a la citología cervical?'
  and option_d = 'Abstenerse de';

update public.questions
set
  option_a = 'Mascarilla con reservorio.',
  option_b = 'Cánula nasal.',
  option_c = 'Mascarilla Venturi.',
  option_d = 'Tubo endotraqueal.',
  explanation = 'La indicación de oxígeno a 3 litros por minuto corresponde a un sistema de bajo flujo; la cánula nasal administra oxígeno en ese rango.'
where question_text = 'Paciente de 68 años que padece de Enfermedad Pulmonar Obstructiva Crónica (EPOC), al chequear los signos vitales se constata una saturación de oxigeno de 84%, ante esta situación el médico ordena la administración de oxígeno a 3 litros por minuto. ¿Qué dispositivo para la administración de oxígeno se debe colocar al paciente?'
  and option_b = 'Diagnóstico de Enfermería.';

update public.questions
set
  question_text = '¿Qué detecta la maniobra de Ortolani en la valoración física del neonato?',
  option_a = 'Luxación congénita de cadera.',
  option_b = 'Polidactilia.',
  option_c = 'Síndrome de Down.',
  option_d = 'Cefalohematoma.',
  correct_option = 'A',
  explanation = 'La maniobra de Ortolani se utiliza para valorar luxación o displasia congénita de cadera en el neonato.'
where question_text like '¿Qué detecta la maniobra de Ortolani en la valoración física del neonato? Respuestas:%7-PAE-Paciente%';

update public.questions
set
  question_text = 'Al centro de salud acude una madre con su hija de 6 meses para el control de rutina de la niña (crecimiento y desarrollo), peso 7120 gramos y talla de 66 centímetros. El personal de enfermería solicita la libreta integral de salud para el registro de las curvas correspondientes de peso y talla, determinando que la paciente se encuentra en percentil cero (0). ¿Cómo se interpreta este percentil obtenido?',
  explanation = 'El percentil cero ubica las mediciones por debajo de lo esperado para la edad, por lo que se interpreta como peso y talla bajos para la edad.'
where question_text like 'R E C I É NR E C IÉ N R E C I É N Al centro de salud acude a una madre con su hija de 6 meses%';

update public.questions
set
  question_text = 'En relación al aislamiento de contacto, complete el siguiente enunciado: Las precauciones de contacto se aplican cuando se sospeche o se tenga constancia de exposición a patógenos que liberan esporas, en particular brotes de _______________. Como medida de protección se recomienda el uso de _______________ y la utilización de _______________.',
  option_a = 'Micoplasma - bata y mascarilla quirúrgica - material clínico de uso individual.',
  option_b = 'Micoplasma - guantes y mascarilla N95 - material clínico de uso individual.',
  option_c = 'C. difficile - guantes y mascarilla quirúrgica - material clínico de uso individual.',
  option_d = 'C. difficile - bata y guantes - material clínico de uso individual.',
  correct_option = 'D',
  explanation = 'C. difficile forma esporas y requiere precauciones de contacto; se usan bata, guantes y material clínico de uso individual.'
where question_text = 'En relación al aislamiento de contacto, complete el siguiente enunciado:'
  and option_a like 'Las precauciones de contacto se aplican cuando se sospeche%';

update public.questions
set
  option_d = 'Mejorar las condiciones generales sin incorporar prácticas culturales.',
  explanation = 'El enfoque intercultural prioriza reconocer e incorporar conocimientos y prácticas de salud ancestrales dentro del plan operativo.'
where question_text = 'En un sector de una comunidad, por razones de trabajo minero, existe alta migración de un grupo étnico y usted debe atender a esa comunidad. ¿Cuál sería el objetivo prioritario del plan operativo tomando en cuenta el enfoque intercultural?'
  and option_d = 'Mejorar las';

update public.questions
set
  question_text = 'Complete el siguiente enunciado: La vía ________ se utiliza para ________. La aguja entra en la piel con un ángulo de ________.',
  explanation = 'La vía intradérmica se usa para pruebas de alergia y se aplica con un ángulo bajo, aproximadamente entre 5° y 15°.'
where question_text = 'La víase utiliza para. La aguja entra en la piel con un ángulo de';

delete from public.questions
where question_text in (
  'Lograr el conocimiento sobre el procedimiento y desarrollar su memoria',
  'Orientar hacia la calidad de la atención y seguridad del paciente'
);

-- Preguntas cuyo enunciado perdió un gráfico o el contexto clínico durante
-- la extracción. Se reconstruyen únicamente cuando la fuente permite
-- conservar sin ambigüedad la respuesta original.
update public.questions
set question_text = 'En un familiograma se observa un hogar integrado por una pareja, sus hijos y otros parientes consanguíneos de generaciones anteriores. ¿Qué tipo de familia representa esta composición?'
where question_text = '¿Qué tipo de familia representa la gráfica?';

update public.questions
set question_text = 'Una pareja forma un nuevo hogar después de relaciones previas. Sus hijos de 20 y 17 años se encuentran próximos a abandonar el hogar y mantienen una relación conflictiva con su padre. Identifique el tipo de familia, el ciclo vital del desarrollo familiar y la relación de los hijos con su padre.'
where question_text = 'La representación gráfica del familiograma, pertenece a la familia N N. Identifique el tipo de familia, el ciclo vital del desarrollo familiar, y la relación de los hijos con su padre.';

update public.questions
set question_text = 'En el control de crecimiento, el indicador de peso para la edad de un niño se ubica dentro del rango esperado para su edad. Identifique el estado nutricional:'
where question_text = 'Observe la curva de peso para la edad e identifique el estado nutricional:';

update public.questions
set question_text = replace(
  question_text,
  '¿Cuál de las teorizantes se pone de manifiesto en el caso anterior?',
  '¿Cuál de las teorizantes se pone de manifiesto en el caso descrito?'
)
where question_text like 'Paciente que ingresa en el Servicio de Urgencias en contra de su voluntad,%'
  and question_text like '%¿Cuál de las teorizantes se pone de manifiesto en el caso anterior?';

update public.questions
set question_text = 'Puérpera de 28 años, en el día 20 posparto, presenta loquios prolongados, sangrado irregular y un útero más grande y blando de lo esperado, sin fiebre, compatible con subinvolución uterina. El manejo conservador descrito por los autores incluye:'
where question_text = 'En el caso anterior, el manejo conservador descrito por los autores del texto incluye:';

update public.questions
set question_text = 'Mujer en el día 10 posparto que amamanta presenta escalofríos, fiebre, taquicardia y una mama endurecida, enrojecida y dolorosa, compatible con mastitis puerperal. El tratamiento empírico inicial habitual y su duración recomendada son:'
where question_text = 'En el caso anterior, el tratamiento empírico inicial habitual y su duración recomendada son:';

update public.questions
set question_text = 'En un centro de salud, el profesional de enfermería encargado del programa de tuberculosis implementa medidas de control ambiental. ¿Cuál recomendación corresponde a esta actividad?'
where question_text = '¿Cuál recomendación, corresponde a esta actividad?';

update public.questions
set question_text = 'Un adulto con hipertrofia prostática presenta goteo continuo de orina, sensación de vejiga llena y vaciamiento incompleto. ¿A qué tipo de incontinencia se refiere?'
where question_text = '¿A qué tipo de incontinencia se refiere?';

update public.questions
set question_text = 'Una paciente con VIH se encuentra en el estadio clínico II. ¿Qué condición clínica corresponde a este estadio?'
where question_text = '¿Qué condiciones clínicas corresponde a este estadio?';

-- Si no existe información suficiente para reconstruir el caso, se elimina la
-- pregunta en vez de inferir datos clínicos que no aparecen en la fuente.
delete from public.questions
where lower(trim(question_text)) in (
  'pacientes de una tercera institución. ¿qué tipo de estudio se está utilizando para este caso?',
  'un electrocardiograma que reporta bloqueos cardíacos. ¿cuál es la alteración electrolítica que presenta el paciente?',
  'un electrocardiograma que reporta intervalo qt y segmento st prolongados. ¿cuál es la alteración electrolítica que presenta el paciente?',
  'una persona con discapacidad. excepto:',
  '¿a qué característica del proceso hace referencia el enunciado?',
  '¿cuál es la alteración que presenta el paciente?',
  '¿cuál es la escala que mide esas acciones?',
  '¿cuál es la etiqueta diagnóstica de enfermería a la que hace referencia el enunciado?',
  '¿cuál es la intervención de enfermería principal en este caso?',
  '¿cuál es la patología que presenta el rn?',
  '¿cuál es la teorizante que utilizaría en este caso?',
  '¿cuál es el diagnóstico de enfermería prioritario en este caso?',
  '¿cuál es el ruido que presenta el paciente?',
  '¿cuáles son las alteraciones que presenta el paciente?',
  '¿en qué etapa de la vida se encuentra el niño?',
  '¿qué alteración electrolítica presenta la paciente?',
  '¿qué diagnóstico considera para la planificación de cuidados de enfermería en la paciente?',
  '¿qué trastorno hipertensivo presenta la paciente?',
  '¿qué valor esencial se pone de manifiesto en esta situación?',
  '¿qué valores determinan esta alteración?'
);

-- Repara desplazamientos de columnas, alternativas concatenadas y fragmentos
-- heredados de preguntas contiguas en las importaciones de Enfermería.
create temporary table imported_question_repairs (
  difficulty text not null,
  old_text text not null,
  new_text text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  primary key (difficulty, old_text)
) on commit drop;

insert into imported_question_repairs (
  difficulty,
  old_text,
  new_text,
  option_a,
  option_b,
  option_c,
  option_d
) values
  ('CACES 2025/2026 Meducators', 'quirúrgica sodio) Paciente de 18 años ingresa al servicio de emergencias por trauma torácico penetrante a nivel de cuarto espacio intercostal derecho, hola inmediatamente se coloca un sistema drenaje torácico, se realiza una RX hoy de tórax evidenciando que el tubo se encuenta en el mediastino. Paciente con intenso dolor a nivel de tórax a la valoración de EVA se obtiene un puntaje de 9/10, además presenta: disnea, diaforesis, taquipnea, se evidencia que el sistema Pleurevac no presenta burbujeo ni fluctuaciones. ¿Qué cámara del sistema de drenaje torácico nos permite evidenciar esta complicación?', 'Paciente de 18 años ingresa al servicio de emergencias por un trauma torácico penetrante en el cuarto espacio intercostal derecho. Se coloca de inmediato un sistema de drenaje torácico y una radiografía evidencia que el tubo se encuentra en el mediastino. Presenta dolor torácico intenso (EVA 9/10), disnea, diaforesis y taquipnea; además, el sistema Pleurevac no muestra burbujeo ni fluctuaciones. ¿Qué cámara del sistema de drenaje torácico permite evidenciar esta complicación?', null, null, null, null),
  ('CACES 2025/2026 Meducators', 'pacientes de 59 años y a su familia para control de la diabetes mellitus tipo 2, quien vive en un entorno de riesgo. Al momento de la valoración paciente refiere que no sabe leer ni escribir, no trabaja desde hace 10 años, consume siempre infusiones ancestrales y no hace dieta, tampoco participa en terapias comunitarias. Al aplicar el proceso de atención de enfermería: hola conducta ineficaz para el mantenimiento de la salud, impotencia y deterioro de la interacción social. ¿Qué categorías tomaría en cuenta para la toma de decisiones de la práctica de atención individual y familiar?', 'El profesional de enfermería atiende a un paciente de 59 años con diabetes mellitus tipo 2 y a su familia, quienes viven en un entorno de riesgo. Durante la valoración, el paciente refiere que no sabe leer ni escribir, no trabaja desde hace 10 años, consume infusiones ancestrales, no sigue una dieta ni participa en terapias comunitarias. En el proceso de atención se identifican conducta ineficaz para el mantenimiento de la salud, impotencia y deterioro de la interacción social. ¿Qué categorías deben considerarse para tomar decisiones en la atención individual y familiar?', null, null, null, null),
  ('CACES 2025/2026 Meducators', 'en el llenado de la ficha familiar para actualización del ASIS, el profesional enfermero encuentra que el jefe de hogar es un hombre de 42 años, desempleado desde hace un año, por lo que se refugian en el alcohol desde hace 5 meses. Su esposa de 37 años manifiesta que ella sale a trabajar y deja a su esposo al cuidado de sus hijos de 8, 5 y 3 años; actualmente los niños están descuidados en su vestido, higiene, alimentación, generando problemas dentro del hogar. ¿Qué determinantes de la salud constituyen factores de riesgo en este caso?', 'Durante el llenado de la ficha familiar para actualizar el ASIS, el profesional de enfermería encuentra que el jefe del hogar es un hombre de 42 años, desempleado desde hace un año, que consume alcohol desde hace 5 meses. Su esposa de 37 años trabaja y deja a su esposo al cuidado de sus hijos de 8, 5 y 3 años; actualmente, los niños presentan descuido en su vestimenta, higiene y alimentación, lo que genera problemas en el hogar. ¿Qué determinantes de la salud constituyen factores de riesgo en este caso?', null, null, null, null),
  ('CACES 2025/2026 Meducators', 'una vigilancia epidemiológica por un incremento en la incidencia de enfermedades diarreicas agudas en niños menores de 5 años. Para abordar esta situación consulta en diversas fuentes de información disponibles en el centro de salud, incluyendo la proyección de mapas epidemiológicos, gráficas de tendencias y tablas de datos. De acuerdo con el Modelo de Atención Integral de Salud (MAIS). ¿Cuál es la principal herramienta que se utiliza en este caso?', 'El profesional de enfermería realiza vigilancia epidemiológica ante un incremento de enfermedades diarreicas agudas en niños menores de 5 años. Para abordar la situación, consulta diversas fuentes de información del centro de salud, incluidos mapas epidemiológicos, gráficas de tendencias y tablas de datos. De acuerdo con el Modelo de Atención Integral de Salud (MAIS), ¿cuál es la principal herramienta utilizada en este caso?', null, null, null, null),
  ('CACES Mayo 2026 intento 1', 'Refuerzos de bOPV, DPT, SRP2, FA. Al realizar la valoración a una paciente de 37 años, la misma refiere que hace un tiempo viene presentando nerviosismo, palpitaciones, que su piel se le enrojece y que siente que las manos le tiemblan, todo esto acompañado de pérdida de peso', 'Al valorar a una paciente de 37 años, esta refiere nerviosismo, palpitaciones, enrojecimiento de la piel, temblor en las manos y pérdida de peso. Ante estos signos y síntomas, ¿qué cuadro clínico presenta?', 'Hipotiroidismo.', null, null, 'Síndrome de Cushing.'),
  ('CACES Mayo 2026 intento 2', 'una valoración minuciosa, monitoreo fetal y tacto vaginal en donde el cérvix tiene un 40% de borramiento y 2 cm de dilatación, se decide retorno a su domicilio, con una próxima valoración. ¿Cuál de los siguientes criterios se toma en cuenta para el retorno de la paciente al domicilio?', 'Una gestante acude al servicio obstétrico por posible trabajo de parto. Tras una valoración minuciosa, monitoreo fetal y tacto vaginal, se determina que el cérvix presenta 40% de borramiento y 2 cm de dilatación, por lo que se decide su retorno al domicilio con una próxima valoración. ¿Cuál de los siguientes criterios permite el retorno de la paciente al domicilio?', null, null, null, null),
  ('CACES Mayo 2026 intento 2', 'una comunidad, está preocupado por adaptar su accionar a las directrices de la Atención Primaria de Salud Renovada. Actualmente, hay madres adolescentes embarazadas, niños menores de 5 años desnutridos, presencia de insectos y roedores en las viviendas. En post consulta ha realizado un diagnóstico situacional con un grupo focal y tiene un mapa parlante. ¿Cuál es el primer paso para poner en práctica la estrategia de Atención Primaria de Salud Renovada en esta unidad operativa?', 'El profesional de enfermería de una unidad operativa ubicada en una comunidad busca adaptar sus acciones a las directrices de la Atención Primaria de Salud Renovada. En la comunidad hay madres adolescentes embarazadas, niños menores de 5 años con desnutrición y presencia de insectos y roedores en las viviendas. En la posconsulta ha realizado un diagnóstico situacional con un grupo focal y dispone de un mapa parlante. ¿Cuál es el primer paso para poner en práctica la estrategia de Atención Primaria de Salud Renovada en esta unidad operativa?', null, null, null, null),
  ('CACES Mayo 2026 intento 4', '¿Con cuánta solución se debe programar la bomba de infusión?', 'El profesional de enfermería debe administrar 1 000 ml de NaCl al 0,9% por vía intravenosa durante 6 horas. ¿A qué velocidad debe programar la bomba de infusión?', null, null, null, null),
  ('CACES Mayo 2026 intento 6', 'en una situación en la que: la víctima no responde, tiene pulso, pero no respira. Con este antecedente, complete el siguiente enunciado', 'Con relación a la ventilación de rescate en adultos, cuando la víctima no responde, tiene pulso, pero no respira, complete el enunciado: Realice __________ cada __________. Cada ventilación debe durar aproximadamente 1 segundo y elevar visiblemente el tórax. Compruebe el pulso cada __________.', '2 ventilaciones - 7 a 8 segundos - minuto.', '1 ventilación - 3 a 5 segundos - 2 minutos.', null, null),
  ('CACES Mayo 2026 intento 7', 'Al realizar la valoración a una paciente de 37 años, la misma refiere que hace un tiempo viene presentando nerviosismo, palpitaciones, que su piel se le enrojece y que siente que las manos le tiemblan, todo esto acompañado de pérdida de peso', 'Al valorar a una paciente de 37 años, esta refiere nerviosismo, palpitaciones, enrojecimiento de la piel, temblor en las manos y pérdida de peso. Ante estos signos y síntomas, ¿qué cuadro clínico presenta?', 'Hipotiroidismo.', 'Síndrome de Cushing.', null, null),
  ('CACES Mayo 2026 intento 7', 'Educar fomentando una buena succión y lactancia materna exclusiva a libre demanda. Como profesional de enfermería de un servicio hospitalario, usted debe identificar los medicamentos considerados de alto riesgo para realizar prácticas asistenciales seguras, garantizar la seguridad del paciente y la calidad de la atención. ¿Cuál de los siguientes medicamentos pertenece a este grupo?', 'Como profesional de enfermería de un servicio hospitalario, usted debe identificar los medicamentos considerados de alto riesgo para realizar prácticas asistenciales seguras y garantizar la seguridad del paciente y la calidad de la atención. ¿Cuál de los siguientes medicamentos pertenece a este grupo?', null, null, null, null),
  ('CACES Mayo 2026 intento 7', 'Técnicas de estimulación prenatal. Entre las intervenciones de enfermería en pacientes con sonda vesical permanente, está la orientación sobre la ingestión de líquidos. ¿Qué cantidad de líquidos le recomienda beber al paciente?', 'Entre las intervenciones de enfermería en pacientes con sonda vesical permanente está la orientación sobre la ingestión de líquidos. ¿Qué cantidad de líquidos se recomienda beber al paciente?', null, null, null, null),
  ('CACES Mayo 2026 intento 7', 'Con relación a la Reanimación Cardiopulmonar (RCP) de alta calidad, complete el siguiente enunciado:', 'Con relación a la Reanimación Cardiopulmonar (RCP) de alta calidad, complete el siguiente enunciado: Al realizar las compresiones torácicas en adultos, comprima a una frecuencia de __________ cpm, con una profundidad mínima de __________, y permita que el tórax se expanda __________ después de cada compresión.', '60 a 80 - 5 cm - un tercio.', null, '70 a 90 - 4 cm - completamente.', null),
  ('CACES Mayo 2026 intento 7', 'Complete el siguiente enunciado con relación al volumen gástrico residual en la alimentación enteral:', 'Complete el siguiente enunciado con relación al volumen gástrico residual en la alimentación enteral: Los volúmenes gástricos residuales se miden antes de cada alimentación __________ y cada 4 a 8 horas durante la alimentación __________. Los volúmenes residuales mayores a __________ pueden vincularse con un riesgo aumentado de aspiración y neumonía asociada.', 'Intermitente – continua – 50 ml.', null, 'Continua – intermitente – 150 ml.', null),
  ('CACES Mayo 2026 intento 7', 'Proporcionar una capa adicional de ropa adecuada y evitar la exposición al frío. El diagnóstico de enfermería es el enunciado que explica y describe el estado de salud, problema real o potencial en los procesos vitales de una persona. ¿Cuál es la estructura secuencial de un diagnóstico real?', 'El diagnóstico de enfermería es el enunciado que explica y describe el estado de salud o un problema real o potencial en los procesos vitales de una persona. ¿Cuál es la estructura secuencial de un diagnóstico real?', null, null, null, null),
  ('CACES Mayo 2026 intento 7', 'Paciente de 65 años en el quinto día de hospitalización en neurología, con diagnóstico de ACV (ICTUS) isquémico. A la valoración TA= 140/80 mmHg, FC=90X’, FR= 20X’, SaO2= 92% al aire ambiente. Se encuentra alerta, con hemiplejia izquierda, con labilidad emocional, con sonda vesical permeable y gasto urinario adecuado. La familia está muy preocupada por el', 'Paciente de 65 años en el quinto día de hospitalización en neurología, con diagnóstico de ACV (ictus) isquémico. En la valoración presenta TA de 140/80 mmHg, FC de 90 lpm, FR de 20 rpm y saturación de O2 de 92% al aire ambiente. Se encuentra alerta, con hemiplejia izquierda, labilidad emocional, sonda vesical permeable y gasto urinario adecuado. La familia está muy preocupada por su estado. ¿Cuál es la intervención de enfermería prioritaria en este caso?', null, null, null, null),
  ('CACES Mayo 2026 intento 9', 'Complete el siguiente enunciado:', 'Complete el siguiente enunciado: Las infecciones asociadas con la atención de salud (IAAS) se definen como __________ localizados o __________ que se producen como __________ de la permanencia o __________ de un paciente en una institución de salud y que no estaban presentes a su __________.', 'Procesos, generalizados, concurrencia, consecuencia, ingreso.', 'Procesos, consecuencia, generalizados, concurrencia, ingreso.', null, null),
  ('CACES Mayo 2026 intento 9', 'Refuerzos de bOPV, DPT, SRP2, FA. Como profesional de enfermería del centro de salud, debe realizar visitas domiciliarias. La etapa de la visita que le ayuda para continuar o modificar la planificación de los cuidados, detectar las dificultades, revisar los objetivos, planificar otros nuevos, corresponde a:', 'Como profesional de enfermería del centro de salud, debe realizar visitas domiciliarias. La etapa de la visita que permite continuar o modificar la planificación de los cuidados, detectar dificultades, revisar los objetivos y planificar otros nuevos corresponde a:', null, null, null, null),
  ('CACES Mayo 2026 intento 9', 'Con relación a la osteoporosis, complete el siguiente enunciado:', 'Con relación a la osteoporosis, complete el siguiente enunciado: La osteoporosis primaria puede aparecer en la __________; la osteoporosis secundaria se asocia a factores como __________ y __________.', 'Senectud - uso de anticonvulsivos - aumento en la ingestión de calcio.', 'Pubertad - consumo de calcio - ejercicio de soporte de peso.', null, 'Senectud - edad del paciente - aumento en la ingestión de calcio.'),
  ('CACES Mayo 2026 intento 9', 'DT, influenza, IPV, tifoidea y rotavirus. La epidemiología descriptiva estudia, entre otras, las medidas de frecuencia de la enfermedad. ¿Qué indicador debe utilizar el profesional enfermero de un subcentro de salud en el que se presenta un brote de tifoidea para realizar la intervención correspondiente?', 'La epidemiología descriptiva estudia, entre otras, las medidas de frecuencia de la enfermedad. ¿Qué indicador debe utilizar el profesional de enfermería de un subcentro de salud en el que se presenta un brote de tifoidea para realizar la intervención correspondiente?', null, null, null, null),
  ('CACES Mayo 2026 intento 10', 'Valorar las vesículas que se formen. Identifique el efecto que produce la aplicación del frío', 'Identifique el efecto que produce la aplicación del frío:', null, null, null, null),
  ('Preguntas referenciales EHEP Mayo', 'paciente, ¿cuál constituye la intervención PRIORITARIA e inmediata?', 'Según las prácticas seguras administrativas y asistenciales promovidas por el MSP para la seguridad del paciente, ¿cuál constituye la intervención prioritaria e inmediata?', null, null, null, null);

update public.questions as question
set
  question_text = repair.new_text,
  option_a = coalesce(repair.option_a, question.option_a),
  option_b = coalesce(repair.option_b, question.option_b),
  option_c = coalesce(repair.option_c, question.option_c),
  option_d = coalesce(repair.option_d, question.option_d)
from imported_question_repairs as repair
where question.difficulty = repair.difficulty
  and question.question_text = repair.old_text;

commit;

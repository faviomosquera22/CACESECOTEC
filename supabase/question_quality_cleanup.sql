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

commit;

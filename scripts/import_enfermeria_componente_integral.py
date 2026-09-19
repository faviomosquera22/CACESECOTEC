"""Importa el banco exclusivo del Componente Integral de Enfermería."""

from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/Apple/Downloads")
OUTPUT = ROOT / "src/data/enfermeriaComponenteIntegralQuestions.json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def parse_docx(filename: str) -> list[tuple[str, list[str]]]:
    lines = [clean(paragraph.text) for paragraph in Document(DOWNLOADS / filename).paragraphs]
    if filename == "Bases Adm.docx":
        starts = [index for index, line in enumerate(lines) if re.match(r"^\d+\.\-", line)]
    else:
        starts = [
            index
            for index, line in enumerate(lines)
            if (index < 51 and ("?" in line or "P/A" in line))
            or (index >= 51 and re.match(r"^\d+\.\s", line))
        ]

    questions: list[tuple[str, list[str]]] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        prompt = re.sub(r"^\d+\.\-?\s*", "", lines[start])
        options = [
            line
            for line in lines[start + 1 : end]
            if line and not line.startswith("(") and "NO TENGO" not in line
        ][:4]
        questions.append((prompt, options))
    return questions


# Respuestas revisadas a partir del contenido académico de cada reactivo.
BASES_ADMINISTRATIVAS_KEYS = [
    "D", "A", "C", "B", "D", "D", "A", "A", "A", "A", "A", "B", "A", "B", "D", "D", "B", "B", "A",
]
MATERNO_INFANTIL_KEYS = [
    "C", "C", "C", "B", "B", "B", "C", "B", "B", "A", "D", "C", "A", "A", "D", "B", "D", "A", "C", "A", "D", "A", "C", "A",
]

BASES_REPAIRS = {
    1: [
        "Fortalecer la calidad de la educación en enfermería para responder a las necesidades de los sistemas de salud, al acceso universal y a la cobertura universal de salud, así como a los ODS.",
        "Abordar las condiciones de trabajo y las capacidades de las y los profesionales de enfermería para ampliar el acceso y la cobertura con equidad y calidad.",
        "Promover un modelo de atención centrado en las personas, las familias y las comunidades, fortaleciendo el primer nivel de atención y las redes integradas de servicios de salud.",
        "Fortalecer y consolidar el liderazgo y la gestión estratégica de la enfermería en los sistemas de salud y en la formulación y el seguimiento de las políticas.",
    ],
    7: [
        "Según Samaniego et al. (2024), los resultados muestran una tendencia creciente.",
        "Según Manuel Luis Samaniego Torres, Carlos López, María del Carmen Fernández, Luisa Pérez y Javier Cabrera, los resultados muestran una tendencia creciente.",
        "Según Samaniego, López, Fernández, Pérez y Cabrera (2024), los resultados muestran una tendencia creciente.",
        "Según el artículo de 2024, los resultados muestran una tendencia creciente.",
    ],
}

PROMPT_REPAIRS = {
    ("administrativas", 1): "El informe sobre la situación de la enfermería en 2020 identificó la necesidad de invertir en educación, empleo y liderazgo. ¿Cuál de las siguientes líneas de acción se orienta específicamente a la gobernanza de la enfermería?",
    ("administrativas", 3): "Profesionales de enfermería difunden, junto con la comunidad y en un espacio público, estrategias y servicios relacionados con la alimentación saludable. Participan autoridades de la Dirección Provincial de Salud. ¿Qué técnica de aprendizaje cooperativo se está realizando?",
    ("administrativas", 12): "En un hospital de tercer nivel se presenta un brote inesperado de Serratia marcescens. Se requiere estudiar, en un único momento, los factores posiblemente relacionados con el brote para estimar su asociación. ¿Qué tipo de investigación corresponde según las variables y el tiempo de medición?",
    ("administrativas", 15): "¿Qué medida de tendencia central se utiliza con mayor frecuencia cuando las variables están severamente sesgadas?",
    ("administrativas", 17): "En una casa de salud, el profesional de enfermería detecta un aumento de pacientes fallecidos por cáncer hepático. ¿Qué indicador describe esta situación en la población afectada?",
    ("administrativas", 19): "En un centro de salud de primer nivel se identifica un caso sospechoso de una enfermedad de notificación obligatoria e inmediata, como sarampión o parálisis flácida aguda. De acuerdo con el SIVE-Alerta del Ecuador, ¿en qué instrumento debe registrarse el caso para su notificación?",
    ("infantil", 5): "Un recién nacido de 24 horas de vida presenta secreción escasa y mal olor en la región periumbilical. ¿Cuál es la actuación inicial de enfermería más adecuada?",
    ("infantil", 12): "Una mujer de 20 años llega a la emergencia de un hospital provincial. Refiere agresiones físicas y verbales por parte de su pareja cuando este consume alcohol y drogas; presenta equimosis, deformidad nasal y una fractura del tabique nasal. Además, se identifica una cicatriz de quemadura en el brazo derecho. ¿Cuál es el lineamiento de atención que debe seguir el profesional de enfermería?",
    ("infantil", 15): "Una mujer de 20 años con discapacidad solicita consejería sobre métodos anticonceptivos porque no desea un embarazo. ¿Qué aspecto debe considerar el profesional de enfermería durante la asesoría?",
    ("infantil", 18): "Una mujer de 40 años, multípara, con 36 semanas de gestación presenta convulsiones tónico-clónicas generalizadas y recibe sulfato de magnesio en dosis de impregnación y mantenimiento. ¿Cuáles son los cuidados principales para prevenir la toxicidad del medicamento?",
    ("infantil", 20): "Un recién nacido con peso menor de 1 500 g recibe vitamina K en dosis única para prevenir la enfermedad hemorrágica del recién nacido. ¿Cuál afirmación es correcta?",
    ("infantil", 23): "Un niño de 2 años presenta diarrea durante cinco días, con seis deposiciones al día que no mejoran con el ayuno. El examen de heces evidencia características líquidas y ácidas, sustancias reductoras, aumento de la osmolaridad y una brecha osmótica mayor de 100 mmol/kg. ¿Cuál es el mecanismo fisiopatológico más probable?",
    ("infantil", 24): "Una mujer de 20 años, con 30 semanas de gestación, presenta cólicos y sangrado escaso con contracciones irregulares. Se indica maduración pulmonar fetal con betametasona. ¿Cuál es la dosis y frecuencia de administración recomendada?",
}

OPTION_REPAIRS = {
    ("infantil", 5): [
        "Realizar limpieza con agua oxigenada y aplicar una crema.",
        "Realizar aseo con solución fisiológica, valorar signos de onfalitis y comunicar al profesional responsable para el tratamiento indicado.",
        "Realizar limpieza y colocar ungüento antibiótico sin valoración adicional.",
        "Realizar limpieza con alcohol y aplicar una crema.",
    ],
    ("infantil", 11): [
        "Valorar la zona de ictericia, asegurar alimentación temprana con aporte calórico adecuado, controlar la temperatura de la piel y de la incubadora, y solicitar los exámenes indicados.",
        "Mantener al recién nacido en ayuno y prepararlo para exanguinotransfusión de forma inmediata.",
        "Indicar lactancia exclusiva cada una a dos horas y contrarreferirlo sin intervención adicional.",
        "Iniciar fototerapia según prescripción o protocolo, proteger ojos y genitales, mantener lactancia cada tres horas, controlar signos vitales y vigilar hidratación y estado neurológico.",
    ],
    ("infantil", 12): [
        "Realizar el triaje y ofrecer apoyo psicológico sin activar la ruta institucional de protección.",
        "Preguntar a la usuaria qué hizo para provocar la agresión y centrar la atención en su conducta.",
        "Brindar un ambiente seguro, cálido y sin intimidación; garantizar confidencialidad, obtener consentimiento informado y activar la ruta de protección y notificación que corresponda.",
        "Permitir que el agresor acompañe a la usuaria durante toda la atención.",
    ],
}

EXPLANATIONS = {
    "administrativas": [
        "La gobernanza de enfermería se relaciona con liderazgo, gestión estratégica y participación en la formulación y seguimiento de políticas.",
        "La desviación estándar cuantifica cuánto se dispersan los datos respecto de su media en cada grupo.",
        "Una feria de salud acerca información y servicios a la comunidad en un espacio público mediante participación interinstitucional.",
        "Un taller permite brindar información y desarrollar habilidades prácticas para prevenir o abandonar el consumo de alcohol.",
        "La comunicación descendente transmite directrices desde la subdirección hacia los líderes y el personal del servicio.",
        "La experienciación recupera las vivencias y perspectivas de las personas participantes para analizar el tema tratado.",
        "En una cita narrativa con cinco autores, APA 7 indica usar el apellido del primer autor seguido de “et al.” desde la primera cita.",
        "La vigilancia comunitaria inicia con la identificación y articulación de líderes y vigilantes comunitarios con el establecimiento de salud.",
        "Ante una alerta, primero debe verificarse que el número de casos supere lo esperado y que exista un brote.",
        "La búsqueda activa permite identificar casos adicionales y delimitar oportunamente la magnitud del brote.",
        "Para evaluar el efecto de una intervención se requiere manipular la intervención y comparar sus resultados; eso corresponde a investigación experimental.",
        "Un estudio transversal mide exposición y resultado en un único momento, lo que permite describir asociaciones en ese periodo.",
        "Explicar objetivos, procedimientos y riesgos respalda una decisión informada y voluntaria, propia del principio de autonomía.",
        "La ausencia de casos también se comunica mediante la notificación de silencio epidemiológico semanal.",
        "La mediana es más representativa que la media cuando la distribución presenta sesgo o valores extremos.",
        "La hipótesis plantea un efecto esperado de la intervención; por ello es una hipótesis alternativa, no nula.",
        "El aumento de personas fallecidas por una causa describe mortalidad por esa causa en la población.",
        "La rotación, las quejas por trato y el incumplimiento de protocolos son indicadores de problemas en la gestión del talento humano.",
        "El formulario EPI-1 se utiliza para registrar y notificar casos sujetos a vigilancia epidemiológica inmediata.",
    ],
    "materno-infantil": [
        "El tamizaje metabólico neonatal detecta hipotiroidismo congénito, galactosemia, fenilcetonuria e hiperplasia suprarrenal congénita.",
        "La producción de calostro es fisiológica; se debe mantener la lactancia frecuente para favorecer la producción de leche.",
        "Un Apgar de 7 al minuto indica una condición neonatal generalmente adecuada, aunque requiere observación y cuidados rutinarios.",
        "El pinzamiento tardío recomendado se realiza entre uno y tres minutos, salvo que exista una indicación clínica para hacerlo antes.",
        "La secreción maloliente requiere higiene suave, valoración de signos de onfalitis y comunicación al profesional responsable; no se indican cremas o antibióticos por rutina.",
        "En una multípara, la fase activa del trabajo de parto suele ser más breve; el tiempo aproximado planteado es cinco horas.",
        "Las medidas no farmacológicas, como respiración, relajación, apoyo continuo y cambios de posición, son la primera estrategia de enfermería para aliviar el dolor.",
        "La analgesia epidural puede prolongar la segunda etapa del parto; en una multípara puede durar hasta tres horas según el escenario planteado.",
        "Una gestante Rh negativa con antecedente de feto Rh positivo debe recibir inmunoglobulina anti-D durante el embarazo para prevenir aloinmunización.",
        "Ante hemorragia posparto por atonía uterina, el masaje uterino inmediato favorece la contracción mientras se activa el manejo integral.",
        "La hiperbilirrubinemia temprana en un prematuro con bajo peso requiere fototerapia y vigilancia de la temperatura, hidratación, alimentación y estado neurológico.",
        "La atención a una presunta víctima de violencia debe ser confidencial, sin intimidación ni revictimización, con consentimiento y activación de la ruta de protección correspondiente.",
        "En niños menores de dos años se controla el perímetro cefálico junto con peso y talla para vigilar el crecimiento neurológico.",
        "El ácido acetilsalicílico en población pediátrica se asocia al síndrome de Reye, caracterizado por vómitos, alteración neurológica y compromiso hepático.",
        "La consejería debe reconocer la autonomía y derechos sexuales; la forma de apoyo puede adaptarse al tipo y grado de discapacidad.",
        "Mamas tensas, dolorosas, con abundante leche y sin fiebre son compatibles con ingurgitación mamaria.",
        "La Libreta Integral de Salud registra controles, crecimiento, desarrollo, vacunas y otras atenciones del niño.",
        "La toxicidad por sulfato de magnesio se vigila mediante diuresis, frecuencia respiratoria y reflejos osteotendinosos, además de una dilución y administración correctas.",
        "La frecuencia cardíaca de 130 latidos por minuto está dentro del rango neonatal habitual; los otros valores descritos requieren valoración según el contexto.",
        "La vitamina K intramuscular es la vía más eficaz para prevenir la enfermedad hemorrágica del recién nacido.",
        "Una diferencia persistente preductal y posductal en el tamizaje con oximetría puede indicar una cardiopatía congénita crítica.",
        "La paciente cursa su primer embarazo y tiene 39 años; la clasificación solicitada es primigesta añosa.",
        "La diarrea que persiste con el ayuno, con sustancias reductoras y brecha osmótica elevada, corresponde a diarrea osmótica.",
        "El esquema de betametasona para maduración pulmonar fetal es 12 mg intramuscular cada 24 horas por dos dosis.",
    ],
}


def make_question(identifier: str, prompt: str, options: list[str], key: str, source: str, explanation: str) -> dict[str, object]:
    if len(options) != 4 or key not in "ABCD":
        raise ValueError(f"{identifier}: reactivo incompleto o clave inválida")
    correct = options["ABCD".index(key)]
    return {
        "id": f"local-enfermeria-integral-{identifier}",
        "question_text": prompt,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct_option": key,
        "explanation": f"La respuesta correcta es {key}. {explanation}",
        "category": "Enfermería - Componente Integral",
        "difficulty": source,
        "phase": "componente-integral",
        "component": "Componente Integral",
        "created_at": None,
    }


def main() -> None:
    administrativas = parse_docx("Bases Adm.docx")
    materno = parse_docx("PREGUNTAS MATERNO INFANTIL (1).docx")
    if len(administrativas) != 19 or len(materno) != 24:
        raise ValueError(f"Conteos inesperados: administrativas={len(administrativas)}, materno={len(materno)}")
    for number, options in BASES_REPAIRS.items():
        prompt, _ = administrativas[number - 1]
        administrativas[number - 1] = (prompt, options)
    for (group, number), prompt in PROMPT_REPAIRS.items():
        entries = administrativas if group == "administrativas" else materno
        _, options = entries[number - 1]
        entries[number - 1] = (prompt, options)
    for (group, number), options in OPTION_REPAIRS.items():
        entries = administrativas if group == "administrativas" else materno
        prompt, _ = entries[number - 1]
        entries[number - 1] = (prompt, options)
    groups = [
        ("administrativas", administrativas, BASES_ADMINISTRATIVAS_KEYS, "Bases administrativas"),
        ("materno-infantil", materno, MATERNO_INFANTIL_KEYS, "Materno infantil"),
    ]
    questions = [
        make_question(
            f"{slug}-{number:03d}",
            prompt,
            options,
            key,
            source,
            EXPLANATIONS[slug][number - 1],
        )
        for slug, entries, keys, source in groups
        for number, ((prompt, options), key) in enumerate(zip(entries, keys), start=1)
    ]
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generadas {len(questions)} preguntas en {OUTPUT}")


if __name__ == "__main__":
    main()

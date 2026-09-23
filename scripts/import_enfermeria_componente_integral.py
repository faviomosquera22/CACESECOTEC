"""Importa el banco exclusivo del Componente Integral de Enfermería."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "Base de Caces/componente-integral"
OUTPUT = ROOT / "src/data/enfermeriaComponenteIntegralQuestions.json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


@dataclass
class SourceQuestion:
    prompt: str
    options: list[str]
    key: str
    marks: list[str]


def effective_font_property(run, paragraph, name: str):
    """Resuelve también marcas heredadas de estilos; un False explícito prevalece."""
    value = getattr(run.font, name)
    if value is not None:
        return value
    for style in (run.style, paragraph.style):
        while style is not None:
            value = getattr(style.font, name)
            if value is not None:
                return value
            style = style.base_style
    return None


def answer_marks(paragraph) -> set[str]:
    marks = set()
    for run in paragraph.runs:
        if not clean(run.text):
            continue
        for property_name, label in (
            ("underline", "subrayado"),
            ("bold", "negrita"),
            ("highlight_color", "resaltado"),
        ):
            if effective_font_property(run, paragraph, property_name):
                marks.add(label)
    return marks


def marked_key(paragraphs, context: str) -> tuple[str, list[str]]:
    """No adivina la clave si varias opciones tienen marcas o ninguna la tiene."""
    marked = [(index, answer_marks(p)) for index, p in enumerate(paragraphs)]
    marked = [(index, marks) for index, marks in marked if marks]
    if len(marked) != 1:
        raise ValueError(f"{context}: se esperaba una opción marcada; encontradas {len(marked)}")
    index, marks = marked[0]
    return "ABCD"[index], sorted(marks)


def parse_docx(filename: str, source_dir: Path = SOURCES) -> list[SourceQuestion]:
    paragraphs = Document(source_dir / filename).paragraphs
    lines = [clean(paragraph.text) for paragraph in paragraphs]
    if filename == "Bases Adm.docx":
        starts = [index for index, line in enumerate(lines) if re.match(r"^\d+\.\-", line)]
    else:
        first_numbered = next(index for index, line in enumerate(lines) if re.match(r"^\d+\.\s", line))
        starts = [
            index
            for index, line in enumerate(lines)
            if (index < first_numbered and "?" in line)
            or re.match(r"^\d+\.\s", line)
        ]

    questions = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        prompt = re.sub(r"^\d+\.\-?\s*", "", lines[start])
        option_paragraphs = [
            paragraphs[index]
            for index in range(start + 1, end)
            if lines[index]
            and not lines[index].startswith("(")
            and "NO TENGO" not in lines[index]
            and not lines[index].startswith("PREGUNTAS MATERNO")
        ]
        options = [clean(p.text) for p in option_paragraphs]
        context = f"{filename}, pregunta {position + 1}"
        expected_count = 1 if filename == "Bases Adm.docx" and position == 6 else 4
        if len(options) != expected_count:
            raise ValueError(f"{context}: se esperaban {expected_count} opciones, hay {len(options)}")
        # Este único reactivo no tiene marca en el archivo recibido. Conservamos
        # su clave anterior, identificada por el contenido, sin atribuirla al Word.
        if (
            filename == "PREGUNTAS MATERNO INFANTIL.docx"
            and prompt == UNMARKED_POSTPARTUM_PROMPT
            and options == UNMARKED_POSTPARTUM_OPTIONS
            and not any(answer_marks(p) for p in option_paragraphs)
        ):
            key, marks = "A", ["sin marca: clave previa conservada"]
        else:
            key, marks = marked_key(option_paragraphs, context)
        questions.append(SourceQuestion(prompt, options, key, marks))
    return questions


UNMARKED_POSTPARTUM_PROMPT = "Una paciente de 27 años, en puerperio inmediato, presenta hemorragia. En la valoración se identifican signos de inestabilidad hemodinámica, involución uterina inadecuada y atonía uterina. P/A ¿Qué actividad debe realizar inicialmente el personal de enfermería?"
UNMARKED_POSTPARTUM_OPTIONS = [
    "Realizar masaje uterino.",
    "Efectuar compresión uterina bimanual.",
    "Administrar oxitocina según prescripción.",
    "Colocar medias de compresión.",
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
        "Realizar aseo con solución fisiológica y aplicar yodopovidona.",
        "Realizar limpieza y colocar ungüento antibiótico.",
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

# Las explicaciones se vinculan al TEXTO de la respuesta, no a su posición.
# Una marca nueva requiere revisar su explicación antes de regenerar el banco.
EXPLANATIONS = {
    "administrativas": {
        "Fortalecer y consolidar el liderazgo y la gestión estrategia de la enfermería en el contexto de los sistemas de salud y en la formulación y monitoreo del mismo.": "La gobernanza de enfermería se relaciona con liderazgo, gestión estratégica y participación en la formulación y seguimiento de políticas.",
        "La dispersión de los datos de cada grupo de los pacientes": "La desviación estándar cuantifica cuánto se dispersan los datos respecto de su media en cada grupo.",
        "Ferias de salud": "Una feria de salud acerca información y servicios a la comunidad en un espacio público mediante participación interinstitucional.",
        "Talleres de salud": "Un taller permite brindar información y desarrollar habilidades prácticas para prevenir o abandonar el consumo de alcohol.",
        "Comunicación descendente": "La comunicación descendente transmite directrices desde la subdirección hacia los líderes y el personal del servicio.",
        "Experienciación": "La experienciación recupera las vivencias y perspectivas de las personas participantes para analizar el tema tratado.",
        "Según Samaniego et al. (2024), los resultados muestran una tendencia creciente": "En una cita narrativa con cinco autores, APA 7 indica usar el apellido del primer autor seguido de “et al.” desde la primera cita.",
        "Identificar y seleccionar a los líderes y vigilantes comunitarios que se articularan con establecimientos de salud en las actividades de vigilancia con base en los lineamientos de la dirección nacional de participación": "La vigilancia comunitaria inicia con la identificación y articulación de líderes y vigilantes comunitarios con el establecimiento de salud.",
        "Confirmar la concurrencia del brote o epidemia.": "Ante una alerta, primero debe verificarse que el número de casos supere lo esperado y que exista un brote.",
        "Realizar la búsqueda activa de los casos.": "La búsqueda activa permite identificar casos adicionales y delimitar oportunamente la magnitud del brote.",
        "Investigación experimental": "Para evaluar el efecto de una intervención se requiere manipular la intervención y comparar sus resultados; eso corresponde a investigación experimental.",
        "Transversal": "Un estudio transversal mide exposición y resultado en un único momento, lo que permite describir asociaciones en ese periodo.",
        "Autonomía": "Explicar objetivos, procedimientos y riesgos respalda una decisión informada y voluntaria, propia del principio de autonomía.",
        "Notificar el \"silencio epidemiológico\", indicando la ausencia de casos en la semana correspondiente": "La ausencia de casos también se comunica mediante la notificación de silencio epidemiológico semanal.",
        "Mediana": "La mediana es más representativa que la media cuando la distribución presenta sesgo o valores extremos.",
        "hipótesis alternativa": "La hipótesis plantea un efecto esperado de la intervención; por ello es una hipótesis alternativa, no nula.",
        "Letalidad": "La clave marcada en el documento fuente es letalidad, indicador que expresa la proporción de personas fallecidas entre quienes presentan la enfermedad.",
        "Evidencian un problema de gestión del talento humano": "La rotación, las quejas por trato y el incumplimiento de protocolos son indicadores de problemas en la gestión del talento humano.",
        "Formulario EPI-1": "El formulario EPI-1 se utiliza para registrar y notificar casos sujetos a vigilancia epidemiológica inmediata."
    },
    "materno-infantil": {
        "Hipotiroidismo congénito, galactosemia, fenilcetonuria e hiperplasia suprarrenal congénita.": "El tamizaje metabólico neonatal detecta hipotiroidismo congénito, galactosemia, fenilcetonuria e hiperplasia suprarrenal congénita.",
        "Continuar con la lactancia materna.": "La producción de calostro es fisiológica; se debe mantener la lactancia frecuente para favorecer la producción de leche.",
        "Con bienestar o condición neonatal adecuada.": "Un Apgar de 7 al minuto indica una condición neonatal generalmente adecuada, aunque requiere observación y cuidados rutinarios.",
        "Entre uno y tres minutos.": "El pinzamiento tardío recomendado se realiza entre uno y tres minutos, salvo que exista una indicación clínica para hacerlo antes.",
        "Realizar limpieza y colocar ungüento antibiótico.": "La clave marcada en el documento fuente indica limpieza y aplicación de ungüento antibiótico ante secreción y mal olor periumbilical.",
        "Cinco horas.": "En una multípara, la fase activa del trabajo de parto suele ser más breve; el tiempo aproximado planteado es cinco horas.",
        "Aplicar métodos no farmacológicos": "Las medidas no farmacológicas, como respiración, relajación, apoyo continuo y cambios de posición, son la primera estrategia de enfermería para aliviar el dolor.",
        "Hasta tres horas.": "La analgesia epidural puede prolongar la segunda etapa del parto; en una multípara puede durar hasta tres horas según el escenario planteado.",
        "Administrar inmunoglobulina anti-D.": "Una gestante Rh negativa con antecedente de feto Rh positivo debe recibir inmunoglobulina anti-D durante el embarazo para prevenir aloinmunización.",
        "Realizar masaje uterino.": "Ante hemorragia posparto por atonía uterina, el masaje uterino inmediato favorece la contracción mientras se activa el manejo integral.",
        "Iniciar fototerapia a una distancia de 40 a 60 centímetros, cubrir ojos y genitales, lactancia materna cada 3 horas, toma de signos vitales, cambio de posición, valorar el estado neurológico e hidratación.": "La hiperbilirrubinemia temprana en un prematuro con bajo peso requiere fototerapia y vigilancia de la temperatura, hidratación, alimentación y estado neurológico.",
        "Promover ambiente cálido, sensible, garantiza la confidencialidad, ausencia de intimidación, consentimiento informado, notificar caso a la fiscalía.": "La atención a una presunta víctima de violencia debe ser confidencial, sin intimidación ni revictimización, con consentimiento y activación de la ruta de protección correspondiente.",
        "Perímetro cefálico": "En niños menores de dos años se controla el perímetro cefálico junto con peso y talla para vigilar el crecimiento neurológico.",
        "Síndrome de Reyer": "El ácido acetilsalicílico en población pediátrica se asocia al síndrome de Reye, caracterizado por vómitos, alteración neurológica y compromiso hepático.",
        "Reconocer que los derechos sexuales y reproductivos de las personas con discapacidad son diferentes de los de cualquier otra persona.": "La clave marcada en el documento fuente es B: reconoce un enfoque diferenciado en la consejería de derechos sexuales y reproductivos para personas con discapacidad.",
        "Ingurgitación mamaria": "Mamas tensas, dolorosas, con abundante leche y sin fiebre son compatibles con ingurgitación mamaria.",
        "Libreta integral de salud": "La Libreta Integral de Salud registra controles, crecimiento, desarrollo, vacunas y otras atenciones del niño.",
        "Realizar la dilución correcta, control de diuresis de al menos 30 ml/hora, valorar la frecuencia respiratoria y reflejos rotulianos cada 30 minutos.": "La toxicidad por sulfato de magnesio se vigila mediante diuresis, frecuencia respiratoria y reflejos osteotendinosos, además de una dilución y administración correctas.",
        "La frecuencia cardíaca del recién nacido.": "La frecuencia cardíaca de 130 latidos por minuto está dentro del rango neonatal habitual; los otros valores descritos requieren valoración según el contexto.",
        "La administración por vía intramuscular de vitamina K es más efectiva que la vía oral para prevenir enfermedades.": "La vitamina K intramuscular es la vía más eficaz para prevenir la enfermedad hemorrágica del recién nacido.",
        "Anomalía cardíaca congénita": "Una diferencia persistente preductal y posductal en el tamizaje con oximetría puede indicar una cardiopatía congénita crítica.",
        "Primigesta añosa": "La paciente cursa su primer embarazo y tiene 39 años; la clasificación solicitada es primigesta añosa.",
        "Diarrea Osmótica": "La diarrea que persiste con el ayuno, con sustancias reductoras y brecha osmótica elevada, corresponde a diarrea osmótica.",
        "12 mg intramuscular cada 24 horas por 2 dosis.": "El esquema de betametasona para maduración pulmonar fetal es 12 mg intramuscular cada 24 horas por dos dosis."
    }
}


def make_question(identifier: str, prompt: str, options: list[str], key: str, source: str, explanation: str) -> dict[str, object]:
    if len(options) != 4 or key not in "ABCD":
        raise ValueError(f"{identifier}: reactivo incompleto o clave inválida")
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


def build_bank(source_dir: Path = SOURCES) -> tuple[list[dict], list[dict]]:
    administrativas = parse_docx("Bases Adm.docx", source_dir)
    materno = parse_docx("PREGUNTAS MATERNO INFANTIL.docx", source_dir)
    if len(administrativas) != 19 or len(materno) != 24:
        raise ValueError(f"Conteos inesperados: administrativas={len(administrativas)}, materno={len(materno)}")
    groups = [
        ("administrativas", "administrativas", administrativas, "Bases administrativas", "Bases Adm.docx"),
        ("materno-infantil", "infantil", materno, "Materno infantil", "PREGUNTAS MATERNO INFANTIL.docx"),
    ]
    questions, audit = [], []
    for slug, repair_group, entries, label, filename in groups:
        for number, entry in enumerate(entries, start=1):
            prompt = PROMPT_REPAIRS.get((repair_group, number), entry.prompt)
            options = OPTION_REPAIRS.get((repair_group, number), entry.options)
            if slug == "administrativas":
                options = BASES_REPAIRS.get(number, options)
            source_answer = entry.options["ABCD".index(entry.key)]
            explanation = EXPLANATIONS[slug].get(source_answer)
            if explanation is None:
                raise ValueError(f"{filename}, pregunta {number}: falta revisar la explicación de la respuesta marcada {source_answer!r}")
            question = make_question(
                f"{slug}-{number:03d}", prompt, options, entry.key, label,
                explanation,
            )
            questions.append(question)
            audit.append({
                "id": question["id"], "source_file": filename,
                "source_number": number, "marks": entry.marks,
                "correct_option": entry.key,
                "source_answer": source_answer,
                "simulator_answer": options["ABCD".index(entry.key)],
            })
    return questions, audit


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCES)
    parser.add_argument("--check", action="store_true", help="Comprobar sin modificar el banco")
    parser.add_argument("--audit", type=Path, help="Guardar evidencia de las marcas por reactivo")
    args = parser.parse_args()
    questions, audit = build_bank(args.source_dir)
    if args.audit:
        args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.check:
        if questions != json.loads(OUTPUT.read_text(encoding="utf-8")):
            raise ValueError("El banco local no coincide con la importación de las marcas del Word")
        unmarked = sum(row["marks"][0].startswith("sin marca") for row in audit)
        print(f"Verificadas {len(questions)} preguntas: {len(questions) - unmarked} con marcas; {unmarked} sin marca (excepción documentada).")
        return
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generadas {len(questions)} preguntas en {OUTPUT}")


if __name__ == "__main__":
    main()

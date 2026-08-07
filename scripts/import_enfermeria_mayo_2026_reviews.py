from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import uuid
from pathlib import Path

from extract_enfermeria_questions import (
    OPTION_LETTERS,
    classify_nursing_area,
    collect_review_attempt_lines,
    parse_review_attempt_block,
    passes_post_repair_quality,
    split_review_attempt_blocks,
)


ROOT = Path(__file__).resolve().parents[1]
QUESTION_JSON = ROOT / "src/data/enfermeriaQuestions.json"
SEED_SQL = ROOT / "supabase/enfermeria_mayo_2026_reviews_seed.sql"
ID_NAMESPACE = uuid.UUID("be22ef34-073e-4210-98d7-462cbbd582aa")
SOURCE_PREFIX = "CACES Mayo 2026 - revisión "
EXPLANATION = (
    "Respuesta verificada con la clave explícita de la revisión del simulador "
    "CACES de mayo de 2026."
)

SOURCES = (
    (
        ROOT
        / "Base de Caces/mayo-2026-review-sources/2026 MAYO SIMULADOR ENFERMERIA_ Revision del intento A.pdf",
        f"{SOURCE_PREFIX}A",
    ),
    (
        ROOT
        / "Base de Caces/mayo-2026-review-sources/2026 MAYO SIMULADOR ENFERMERIA_ Revision del intento B.pdf",
        f"{SOURCE_PREFIX}B",
    ),
    (
        ROOT
        / "Base de Caces/mayo-2026-review-sources/2026 MAYO SIMULADOR ENFERMERIA_ Revision del intento C.pdf",
        f"{SOURCE_PREFIX}C",
    ),
    (
        ROOT
        / "Base de Caces/mayo-2026-review-sources/2026 MAYO SIMULADOR ENFERMERIA_ Revision del intento D.pdf",
        f"{SOURCE_PREFIX}D",
    ),
    (
        ROOT
        / "Base de Caces/mayo-2026-review-sources/2026 MAYO SIMULADOR ENFERMERIA_ Revision pagina 1 de 100.pdf",
        f"{SOURCE_PREFIX}página suelta",
    ),
)

INVALID_CONTENT_PATTERN = re.compile(
    r"(?:revisi[oó]n del intento|se punt[uú]a|calificaci[oó]n|"
    r"[\ufb00-\ufb06])",
    re.IGNORECASE,
)
INCOMPLETE_END_PATTERN = re.compile(
    r"\b(?:por el|por la|para el|para la|con el|con la|como|que|y|o|de|del|la|el)\s*$",
    re.IGNORECASE,
)

def normalized(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value).lower())
    return "".join(character for character in text if character.isalnum())


EXCLUDED_QUESTION_KEYS = {
    normalized(
        "La calidad es un concepto que ha evolucionado hasta nuestros días, "
        "existe un pensador que hace referencia a la calidad como la satisfacción "
        "del cliente. ¿Cuál es el autor que hace referencia al enunciado?"
    ): "La clave atribuida a Deming es conceptualmente discutible.",
    normalized(
        "Durante la visita domiciliaria a un niño de 2 años 2 meses, el profesional "
        "de enfermería solicita a la madre la libreta integral de salud del niño"
    ): "El esquema vacunal citado es de 2019 y no se incorporó como vigente.",
    normalized(
        "Al centro de salud donde usted labora acude una madre con su hijo de 2 "
        "meses de edad para la vacunación"
    ): "No se encontró respaldo oficial vigente para el esquema con hexavalente.",
    normalized(
        "De las siguientes acciones a seguir en la identificación de un sintomático "
        "respiratorio. ¿Cuál de ellas NO corresponde?"
    ): "La clave sobre el material de la caja de transporte es ambigua frente a la guía de la OMS.",
    normalized(
        "¿Cuál de ellas NO corresponde?"
    ): "La clave sobre el material de la caja de transporte es ambigua frente a la guía de la OMS.",
    normalized(
        "Observe la curva de peso para la edad e identifique el estado nutricional:"
    ): "La pregunta depende de una curva que no está incluida en el PDF importable.",
    normalized(
        "Paciente que durante su turno presenta deterioro neurológico, al preguntarle "
        "su nombre responde con palabras inapropiadas"
    ): "La tabla de Glasgow quedó intercalada entre las alternativas.",
}


QUESTION_REPAIRS: dict[str, dict[str, str]] = {
    normalized(
        "¿Cuáles son los escenarios de atención en salud, según lo establecido en "
        "el MAIS -FCI? Señale la respuesta correcta:"
    ): {
        "question_text": (
            "¿Cuáles son los escenarios de atención en salud establecidos en el "
            "MAIS-FCI?"
        ),
        "option_a": (
            "Individual, familiar, comunitario y atención al ambiente o entorno natural."
        ),
        "option_b": "Individual, grupal, familiar, comunitario e institucional.",
        "option_c": "Individual, familiar, sectorial y comunitario.",
        "option_d": "Individual, familiar y comunitario.",
        "correct_option": "A",
    },
    normalized(
        "Luego de administrar un medicamento, el profesional de enfermería debe "
        "evaluar el efecto esperado"
    ): {
        "question_text": (
            "Después de administrar un medicamento, el profesional de enfermería "
            "evalúa el efecto esperado en el paciente. ¿A cuál de los principios de "
            "administración segura conocidos como los 'correctos' corresponde esta "
            "acción?"
        ),
        "option_a": "Registro correcto.",
        "option_b": "Forma correcta.",
        "option_c": "Respuesta correcta.",
        "option_d": "Acción correcta.",
        "correct_option": "C",
    },
    normalized(
        "Seleccione la respuesta correcta con relación a las actividades que NO se "
        "debe realizar en la primera etapa del parto:"
    ): {
        "question_text": (
            "¿Qué actividad no debe realizarse de forma rutinaria durante la primera "
            "etapa del parto?"
        ),
        "option_a": "Rasurar el área genital.",
        "option_b": "Permitir la ingesta de líquidos azucarados.",
        "option_c": "Permitir la libertad de movimiento.",
        "option_d": "Brindar tranquilidad y apoyo emocional continuo.",
        "correct_option": "A",
    },
    normalized("¿Cuál de las siguientes intervenciones usted realiza?"): {
        "question_text": (
            "Al brindar cuidados de enfermería a un paciente con hipotiroidismo, "
            "¿cuál de las siguientes intervenciones debe realizar?"
        ),
    },
    normalized(
        "¿Cuál es el valor de plaquetas por milímetro cúbico que indica que el "
        "paciente se encuentra en riesgo de hemorragia? 100 000"
    ): {
        "question_text": (
            "¿Qué recuento de plaquetas por microlitro indica riesgo de hemorragia "
            "espontánea?"
        ),
        "option_a": "100 000/µL.",
        "option_b": "75 000/µL.",
        "option_c": "19 000/µL.",
        "option_d": "50 000/µL.",
        "correct_option": "C",
    },
    normalized(
        "En una comunidad rural, desde hace un año se presenta falta de agua y el "
        "funcionamiento del nuevo centro de comercialización de animales domésticos"
    ): {
        "question_text": (
            "En una comunidad rural hay falta de agua, proliferación de vectores, "
            "animales callejeros, olores desagradables, enfermedades gastrointestinales "
            "y escasa participación de los líderes. Las familias desconocen cómo "
            "consumir agua segura y mantener la higiene ambiental. ¿Qué estrategia "
            "favorece el cambio social y de comportamiento?"
        ),
    },
    normalized(
        "¿Cuáles son las Modalidades de Atención del Modelo Integral de Salud? "
        "Atención individual, atención familiar"
    ): {
        "question_text": (
            "¿Cuáles son las modalidades de atención del Modelo de Atención Integral "
            "de Salud Familiar, Comunitario e Intercultural (MAIS-FCI)?"
        ),
        "option_a": (
            "Atención individual, familiar, comunitaria y al ambiente o entorno natural."
        ),
        "option_b": (
            "Promoción, prevención, curación, rehabilitación, cuidados paliativos e "
            "integración social."
        ),
        "option_c": (
            "Atención extramural, intramural, en establecimientos móviles y "
            "prehospitalaria."
        ),
        "option_d": (
            "Atención a personas aparentemente sanas, con riesgo, con patología o "
            "con discapacidad o secuela."
        ),
        "correct_option": "C",
    },
    normalized(
        "En el transoperatorio se presenta complicación en la respiración, provocando "
        "disminución en la función ventilatoria"
    ): {
        "question_text": (
            "Durante el transoperatorio se presenta una disminución de la función "
            "ventilatoria. ¿Qué condición del paciente aumenta principalmente el "
            "riesgo de esta complicación?"
        ),
        "option_a": "Obesidad.",
    },
    normalized(
        "El profesional de enfermería brinda atención a una paciente de 26 años en "
        "el puerperio inmediato con evolución de 7 horas"
    ): {
        "question_text": (
            "Una paciente de 26 años, a las 7 horas posparto, refiere que no tiene una "
            "buena producción de leche y se muestra preocupada por el crecimiento de "
            "su bebé. ¿Qué actividad de enfermería debe realizarse de inmediato?"
        ),
    },
    normalized(
        "¿Cuáles son los componentes del Modelo de Atención Integral y Comunitario e "
        "Intercultural MAIS - FCI? Atención individual"
    ): {
        "question_text": (
            "¿Cuáles son los componentes del Modelo de Atención Integral de Salud "
            "Familiar, Comunitario e Intercultural (MAIS-FCI)?"
        ),
        "option_a": "Atención individual, familiar, comunitaria y al ambiente.",
        "option_b": "Provisión de servicios, organización, gestión y financiamiento.",
        "option_c": "Niñez, adolescencia, adultez y adulto mayor.",
        "option_d": "Universalidad, integralidad, equidad y continuidad.",
        "correct_option": "B",
    },
    normalized("¿En qué momentos debe realizarse esta verificación?"): {
        "question_text": (
            "La verificación de seguridad quirúrgica es una de las funciones del "
            "profesional de enfermería circulante. ¿En qué momentos debe realizarse?"
        ),
        "option_a": (
            "Cuando el profesional circulante disponga de tiempo para realizarla."
        ),
        "option_b": (
            "Antes de que el paciente entre al quirófano, antes de preparar el campo "
            "quirúrgico y antes de que se recupere de la anestesia."
        ),
        "option_c": (
            "Antes de la incisión cutánea, antes de que el paciente se recupere de "
            "la anestesia y antes de trasladarlo a recuperación."
        ),
        "option_d": (
            "Antes de la inducción de la anestesia, antes de la incisión cutánea y "
            "antes de que el paciente salga del quirófano."
        ),
        "correct_option": "D",
    },
    normalized(
        "Cuando el MAIS-FCI, orienta el accionar integrado de los actores del Sistema "
        "Nacional de Salud"
    ): {
        "question_text": (
            "El MAIS-FCI orienta la acción integrada de los actores del Sistema "
            "Nacional de Salud para garantizar los derechos en salud, cumplir las "
            "metas nacionales y mejorar las condiciones de vida de la población. "
            "¿A qué elemento del modelo corresponde este enunciado?"
        ),
        "option_a": "Objetivo del Modelo de Atención Integral de Salud.",
        "option_b": "Objetivos estratégicos para el fortalecimiento del modelo.",
        "option_c": "Propósito del Modelo de Atención Integral de Salud.",
        "option_d": "Principios del Modelo de Atención Integral de Salud.",
        "correct_option": "C",
    },
    normalized(
        "Paciente femenina de 50 años se encuentra hospitalizada por laparotomía "
        "exploratoria, presenta herida quirúrgica"
    ): {
        "question_text": (
            "Paciente de 50 años, hospitalizada después de una laparotomía, presenta "
            "una herida quirúrgica con secreción purulenta y mal olor. Tras realizar "
            "la curación con técnica aséptica, ¿cómo se clasifican los apósitos y "
            "materiales contaminados generados?"
        ),
        "option_a": "Desechos cortopunzantes.",
        "option_b": "Desechos comunes.",
        "option_c": "Desechos anatomopatológicos.",
        "option_d": "Desechos biológico-infecciosos.",
        "correct_option": "D",
    },
    normalized(
        "La ________________, se define como un volumen urinario menor de ________. "
        "Entre las posibles etiologías"
    ): {
        "question_text": (
            "Complete el enunciado: La __________ se define como un volumen urinario "
            "menor de __________. Entre sus posibles causas se encuentra __________."
        ),
        "option_a": "Anuria - 500 mL/día - obstrucción completa.",
        "option_b": "Oliguria - 500 mL/día - ingestión inadecuada de líquidos.",
        "option_c": "Anuria - 50 mL/día - infección.",
        "option_d": "Oliguria - 50 mL/día - lesión obstétrica.",
        "correct_option": "B",
    },
}


def parse_sources() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    parsed: list[dict[str, object]] = []
    rejected: list[dict[str, object]] = []

    for path, source in SOURCES:
        if not path.exists():
            raise FileNotFoundError(f"No se encontró la fuente: {path}")

        lines = collect_review_attempt_lines(path)
        blocks = split_review_attempt_blocks(lines)

        for block_number, (block_lines, answer) in enumerate(blocks, start=1):
            question = parse_review_attempt_block(block_lines, answer, source)

            if question is None:
                rejected.append(
                    {
                        "source": source,
                        "block": block_number,
                        "reason": "No se pudieron reconstruir cuatro opciones independientes.",
                        "answer": answer,
                        "preview": " ".join(block_lines)[:700],
                    }
                )
                continue

            question_key = normalized(question["question_text"])
            repair = next(
                (
                    values
                    for repair_key, values in QUESTION_REPAIRS.items()
                    if question_key.startswith(repair_key)
                ),
                None,
            )
            if repair:
                question.update(repair)

            question["source_block"] = block_number
            parsed.append(question)

    return parsed, rejected


def structural_problem(question: dict[str, object]) -> str | None:
    question_text = str(question["question_text"]).strip()
    options = [
        str(question[f"option_{letter.lower()}"]).strip()
        for letter in OPTION_LETTERS
    ]

    if not passes_post_repair_quality(question):
        return "No supera los controles editoriales posteriores a la extracción."
    if INVALID_CONTENT_PATTERN.search(" ".join([question_text, *options])):
        return "Contiene metadatos o residuos tipográficos del informe."
    if INCOMPLETE_END_PATTERN.search(question_text):
        return "El enunciado termina de forma incompleta."
    if not (20 <= len(question_text) <= 2200):
        return "La longitud del enunciado no es plausible."
    if not all(1 <= len(option) <= 800 for option in options):
        return "La longitud de una alternativa no es plausible."
    if len({normalized(option) for option in options}) != 4:
        return "Las alternativas no son distintas."
    if str(question.get("correct_option")) not in OPTION_LETTERS:
        return "La clave de respuesta no corresponde a una alternativa."

    key = normalized(question_text)
    excluded_reason = next(
        (
            reason
            for excluded_key, reason in EXCLUDED_QUESTION_KEYS.items()
            if key.startswith(excluded_key)
        ),
        None,
    )
    if excluded_reason:
        return excluded_reason

    return None


def select_questions(
    parsed: list[dict[str, object]],
    existing: list[dict[str, object]],
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    existing_keys = {normalized(question["question_text"]) for question in existing}
    selected_keys: set[str] = set()
    selected: list[dict[str, object]] = []
    rejected: list[dict[str, object]] = []

    for question in parsed:
        question_key = normalized(question["question_text"])
        problem = structural_problem(question)

        if problem:
            rejected.append({**question, "reason": problem})
        elif question_key in existing_keys:
            rejected.append({**question, "reason": "Duplicada en el banco existente."})
        elif question_key in selected_keys:
            rejected.append({**question, "reason": "Duplicada entre los PDF revisados."})
        else:
            selected_keys.add(question_key)
            selected.append(question)

    return selected, rejected


def arrange_options(
    question: dict[str, object], target_index: int
) -> tuple[dict[str, str], str]:
    source_options = {
        letter: str(question[f"option_{letter.lower()}"])
        for letter in OPTION_LETTERS
    }
    source_correct = str(question["correct_option"])
    correct_text = source_options[source_correct]
    distractors = [
        source_options[letter] for letter in OPTION_LETTERS if letter != source_correct
    ]
    digest = hashlib.sha256(str(question["question_text"]).encode("utf-8")).digest()
    rotation = digest[0] % len(distractors)
    distractors = distractors[rotation:] + distractors[:rotation]
    if digest[1] % 2:
        distractors.reverse()

    arranged: list[str | None] = [None] * 4
    arranged[target_index] = correct_text
    distractor_iterator = iter(distractors)
    for index, option in enumerate(arranged):
        if option is None:
            arranged[index] = next(distractor_iterator)

    return (
        {
            f"option_{letter.lower()}": str(arranged[index])
            for index, letter in enumerate(OPTION_LETTERS)
        },
        OPTION_LETTERS[target_index],
    )


def local_question(
    question: dict[str, object], index: int
) -> dict[str, object]:
    options, correct_option = arrange_options(question, index % 4)
    content_hash = hashlib.sha256(
        normalized(
            " ".join(
                [
                    question["question_text"],
                    *[
                        options[f"option_{letter.lower()}"]
                        for letter in OPTION_LETTERS
                    ],
                ]
            )
        ).encode("utf-8")
    ).hexdigest()[:12]

    return {
        "id": f"local-enfermeria-mayo-2026-{content_hash}",
        "question_text": question["question_text"],
        **options,
        "correct_option": correct_option,
        "explanation": EXPLANATION,
        "category": f"Enfermería - {classify_nursing_area(str(question['question_text']))}",
        "difficulty": question["source"],
        "created_at": None,
    }


def validate(questions: list[dict[str, object]], retained: list[dict[str, object]]) -> None:
    retained_keys = {normalized(question["question_text"]) for question in retained}
    question_keys: set[str] = set()
    identifiers: set[str] = set()

    for question in questions:
        question_key = normalized(question["question_text"])
        if question_key in retained_keys or question_key in question_keys:
            raise ValueError(f"Pregunta duplicada: {question['question_text']}")
        if str(question["id"]) in identifiers:
            raise ValueError(f"Identificador duplicado: {question['id']}")
        if structural_problem(question):
            raise ValueError(
                f"Pregunta inválida después de organizar opciones: {question['id']}"
            )

        question_keys.add(question_key)
        identifiers.add(str(question["id"]))


def sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def build_seed(questions: list[dict[str, object]]) -> str:
    rows: list[str] = []
    for question in questions:
        identifier = uuid.uuid5(ID_NAMESPACE, str(question["id"]))
        values = [
            identifier,
            question["question_text"],
            question["option_a"],
            question["option_b"],
            question["option_c"],
            question["option_d"],
            question["correct_option"],
            question["explanation"],
            question["category"],
            question["difficulty"],
        ]
        rows.append("  (" + ", ".join(sql_literal(value) for value in values) + ")")

    return f"""-- Generated by scripts/import_enfermeria_mayo_2026_reviews.py
-- Sources: four complete Moodle attempt reviews and one supplied single-page extract.
-- Questions: {len(questions)}

insert into public.questions (
  id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  explanation,
  category,
  difficulty
) values
""" + ",\n".join(rows) + """
on conflict (id) do update set
  question_text = excluded.question_text,
  option_a = excluded.option_a,
  option_b = excluded.option_b,
  option_c = excluded.option_c,
  option_d = excluded.option_d,
  correct_option = excluded.correct_option,
  explanation = excluded.explanation,
  category = excluded.category,
  difficulty = excluded.difficulty;
"""


def build_audit(
    parsed: list[dict[str, object]],
    selected: list[dict[str, object]],
    rejected: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "parsed_count": len(parsed),
        "selected_count": len(selected),
        "rejected_count": len(rejected),
        "selected": selected,
        "rejected": rejected,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--audit-output", type=Path)
    args = parser.parse_args()

    existing = json.loads(QUESTION_JSON.read_text(encoding="utf-8"))
    retained = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith(
            "local-enfermeria-mayo-2026-"
        )
        and not str(question.get("difficulty", "")).startswith(SOURCE_PREFIX)
    ]
    parsed, parse_rejections = parse_sources()
    selected, quality_rejections = select_questions(parsed, retained)
    new_questions = [
        local_question(question, index)
        for index, question in enumerate(selected)
    ]
    validate(new_questions, retained)
    rejected = [*parse_rejections, *quality_rejections]

    if args.audit_output:
        args.audit_output.parent.mkdir(parents=True, exist_ok=True)
        args.audit_output.write_text(
            json.dumps(
                build_audit(parsed, selected, rejected),
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    if args.write:
        QUESTION_JSON.write_text(
            json.dumps([*retained, *new_questions], ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        SEED_SQL.write_text(build_seed(new_questions), encoding="utf-8")

    rejection_counts: dict[str, int] = {}
    for rejection in rejected:
        reason = str(rejection["reason"])
        rejection_counts[reason] = rejection_counts.get(reason, 0) + 1

    print(f"Bloques leídos: {len(parsed) + len(parse_rejections)}")
    print(f"Preguntas reconstruidas: {len(parsed)}")
    print(f"Preguntas nuevas aptas: {len(new_questions)}")
    print(f"Banco resultante: {len(retained) + len(new_questions)}")
    print(f"Descartes: {json.dumps(rejection_counts, ensure_ascii=False)}")


if __name__ == "__main__":
    main()

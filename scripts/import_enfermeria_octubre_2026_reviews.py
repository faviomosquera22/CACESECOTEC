from __future__ import annotations

import argparse
import hashlib
import json
import unicodedata
import uuid
from pathlib import Path

from extract_enfermeria_questions import (
    OPTION_LETTERS,
    classify_nursing_area,
    collect_review_attempt_lines,
    parse_review_attempt_block,
    split_review_attempt_blocks,
)


ROOT = Path(__file__).resolve().parents[1]
QUESTION_JSON = ROOT / "src/data/enfermeriaQuestions.json"
SEED_SQL = ROOT / "supabase/enfermeria_octubre_2026_reviews_seed.sql"
AUDIT_OUTPUT = ROOT / "tmp/pdfs/enfermeria_octubre_2026_import_audit.json"
ID_NAMESPACE = uuid.UUID("a5e0fce6-2a55-4b56-9e54-a71a12ee55b3")
SOURCE_PREFIX = "CACES Octubre 2026 - revisión"
EXPLANATION = (
    "Respuesta verificada con la clave explícita de la revisión del simulador "
    "CACES de octubre de 2026."
)

SOURCES = (
    (
        Path("/Users/Apple/Downloads/2026 OCTUBRE SIMULADOR ENFERMERIA_ Revisión del intentoh.pdf"),
        f"{SOURCE_PREFIX} A",
    ),
    (
        Path("/Users/Apple/Downloads/2026 OCTUBRE SIMULADOR ENFERMERIA_ Revisión del intento.pdf"),
        f"{SOURCE_PREFIX} B",
    ),
)


def normalized(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value).lower())
    return "".join(character for character in text if character.isalnum())


REPAIRS = {
    normalized(
        "Usted como profesional de enfermería acaba de medir los signos vitales a "
        "un paciente internado en el servicio de hospitalización de cirugía, sus "
        "manos están visiblemente limpias, por lo que elije un preparado de base "
        "alcohólica para iniciar la higiene de manos. ¿Qué tiempo debe durar el "
        "procedimiento?"
    ): {
        "question_text": (
            "Después de tomar los signos vitales de un paciente hospitalizado, el "
            "profesional de enfermería tiene las manos visiblemente limpias y elige "
            "un preparado de base alcohólica para realizar la higiene de manos. "
            "¿Cuánto debe durar el procedimiento?"
        ),
    },
    normalized(
        "Paciente de 80 años hospitalizado en el servicio de medicina interna con "
        "signos de demencia senil, se encuentra intranquilo y como consecuencia se "
        "retira la vía periférica colocada en el miembro superior izquierdo, por lo "
        "que el personal de enfermería vuelve a canalizar una vía periférica en el "
        "miembro contrario para continuar con la hidratación. De acuerdo con el "
        "protocolo de higienización de manos. ¿Qué producto debe usar el personal de "
        "enfermería inmediatamente después de realizar el procedimiento descrito?"
    ): {
        "question_text": (
            "Un paciente de 80 años hospitalizado, con signos de demencia, se retira "
            "una vía periférica. El personal de enfermería canaliza una nueva vía en "
            "el miembro contrario para continuar la hidratación. Según el protocolo "
            "de higiene de manos, ¿qué producto debe utilizar inmediatamente después "
            "del procedimiento?"
        ),
    },
    normalized("¿Cuál es la indicada para realizar una intubación endotraqueal?"):
        {
            "question_text": (
                "¿Cuál es la posición indicada para realizar una intubación "
                "endotraqueal?"
            ),
        },
    normalized("¿Qué vacunas le corresponde administrar al niño de 6 meses?"):
        {"question_text": "¿Qué vacunas le corresponden administrar a un niño de 6 meses?"},
    normalized(
        "Llega a la unidad de atención de primer nivel una madre de familia con su "
        "bebe recién nacido y solicita la administración de la vacuna BCG. ¿Qué tipo "
        "de jeringuilla y aguja utilizaría en esta vacuna?"
    ): {
        "question_text": (
            "Una madre acude con su bebé recién nacido a una unidad de atención "
            "primaria para administrar la vacuna BCG. ¿Qué tipo de jeringa y aguja "
            "debe utilizarse?"
        ),
    },
    normalized(
        "El profesional de enfermería brinda atención a una paciente de 26 años en "
        "el puerperio inmediato con evolución de 7 horas quién refiere que no tiene "
        "una buena producción de leche materna, mostrándose preocupada por el "
        "crecimiento y desarrollo de su bebé. ¿Qué actividad de enfermería realiza "
        "inmediatamente?"
    ): {
        "question_text": (
            "Una paciente de 26 años, a las 7 horas posparto, refiere baja producción "
            "de leche materna y se muestra preocupada por el crecimiento y desarrollo "
            "de su bebé. ¿Qué actividad de enfermería debe realizarse de inmediato?"
        ),
    },
    normalized(
        "Usted como profesional de enfermería, se encuentra realizando los pasos de "
        "la higiene de manos con agua y jabón, se ha mojado las manos con agua y ha "
        "aplicado suficiente cantidad de jabón para cubrir toda la superficie de la "
        "mano. ¿Cual es el siguiente paso en el procedimiento de la Higiene de manos?"
    ): {
        "question_text": (
            "Durante la higiene de manos con agua y jabón, después de mojar las manos "
            "y aplicar jabón suficiente para cubrir toda la superficie, ¿cuál es el "
            "siguiente paso?"
        ),
    },
}

CATEGORY_BY_QUESTION = {
    normalized(
        "Después de tomar los signos vitales de un paciente hospitalizado, el "
        "profesional de enfermería tiene las manos visiblemente limpias y elige un "
        "preparado de base alcohólica para realizar la higiene de manos. ¿Cuánto debe "
        "durar el procedimiento?"
    ): "Cuidado y Procedimientos Clínicos de Enfermería",
    normalized(
        "Un paciente de 80 años hospitalizado, con signos de demencia, se retira una "
        "vía periférica. El personal de enfermería canaliza una nueva vía en el "
        "miembro contrario para continuar la hidratación. Según el protocolo de "
        "higiene de manos, ¿qué producto debe utilizar inmediatamente después del "
        "procedimiento?"
    ): "Cuidado y Procedimientos Clínicos de Enfermería",
    normalized(
        "Paciente de 79 años, con patología cardiaca, lleva insertada válvula de "
        "derivación ventrículo-peritoneal, presenta dificultad para respirar, "
        "frecuencia respiratoria 24 por minuto y limitación del esfuerzo terapéutico. "
        "Los familiares plantean la posibilidad de solicitar alta a petición. ¿Cuál "
        "es el diagnóstico de enfermería más probable para el abordaje de la condición "
        "clínica del paciente?"
    ): "Cuidados del Adulto y Adulto Mayor",
    normalized(
        "Usted como profesional de enfermería está programando las visitas "
        "domiciliarias en su comunidad y decide priorizar a una familia en la que un "
        "adulto mayor convive con sus dos hijas mayores de edad, ha sido diagnosticado "
        "con tuberculosis pulmonar y es necesario evaluar el estado de salud de todos "
        "los miembros de la familia, asegurar la adherencia al tratamiento y prevenir "
        "la transmisión de la enfermedad a otros miembros de la comunidad. Según el "
        "Modelo de Atención Integral del Sistema Nacional de Salud Familiar, "
        "Comunitaria e Intercultural (MAIS-FCI). ¿Qué criterio se utilizó para "
        "establecer la prioridad de esta visita domiciliaria?"
    ): "Cuidado Familiar, Comunitario e Intercultural",
}

EXCLUDED = {
    normalized("¿Cómo se denomina esta técnica?"):
        "No incluye el caso ni la técnica que debe identificarse.",
    normalized("¿Qué sistema está aplicando según Dorothea Orem?"):
        "No incluye el caso clínico necesario para identificar el sistema de Orem.",
    normalized("¿Cuál de ellas NO corresponde?"):
        "La clave sobre el material de la caja de transporte es ambigua frente a la guía de la OMS.",
    normalized(
        "¿Cuáles son los valores normales de las constantes vitales para un adulto? "
        "Frecuencia cardíaca 60 - 120 L/min, frecuencia respiratoria 18 - 22 R/min, "
        "tensión arterial 120/80 mmHg, temperatura 36"
    ): "El enunciado y las alternativas quedaron truncados durante la extracción.",
    normalized(
        "Mujer de 72 años, residente en centro geriátrico, con antecedentes de evento "
        "cerebro vascular, desorientada en espacio y necesidades básicas, a nivel de "
        "extremidades inferiores presencia de venas varicosas, trombosadas y tortuosas. "
        "En el proceso de atención de enfermería, luego de la valoración. ¿Cuál es la "
        "condición de mayor riesgo para la posibilidad de complicación?"
    ): "La clave marcada no corresponde a la condición de mayor riesgo descrita.",
    normalized(
        "¿Cuáles son los signos y síntomas que se pueden presentar si se habla de "
        "presencia de un ESAVI grave?"
    ): "La clave marcada no corresponde al evento adverso grave planteado.",
}


def parse_sources() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    parsed: list[dict[str, object]] = []
    rejected: list[dict[str, object]] = []

    for path, source in SOURCES:
        if not path.exists():
            raise FileNotFoundError(f"No se encontró la fuente: {path}")

        for block_number, (lines, answer) in enumerate(
            split_review_attempt_blocks(collect_review_attempt_lines(path)), start=1
        ):
            question = parse_review_attempt_block(lines, answer, source)
            if question is None:
                rejected.append(
                    {
                        "source": source,
                        "block": block_number,
                        "reason": "No se pudieron reconstruir cuatro opciones independientes.",
                    }
                )
                continue

            key = normalized(question["question_text"])
            if key in REPAIRS:
                question.update(REPAIRS[key])
            question["source_block"] = block_number
            parsed.append(question)

    return parsed, rejected


def quality_problem(question: dict[str, object]) -> str | None:
    question_text = str(question["question_text"]).strip()
    options = [str(question[f"option_{letter.lower()}"]).strip() for letter in OPTION_LETTERS]

    if normalized(question_text) in EXCLUDED:
        return EXCLUDED[normalized(question_text)]
    if not question_text.endswith(("?", ":")):
        return "El enunciado no termina como pregunta o instrucción."
    if not (20 <= len(question_text) <= 2200):
        return "La longitud del enunciado no es plausible."
    if not all(1 <= len(option) <= 800 for option in options):
        return "La longitud de una alternativa no es plausible."
    if len({normalized(option) for option in options}) != 4:
        return "Las alternativas no son distintas."
    if str(question["correct_option"]) not in OPTION_LETTERS:
        return "La clave de respuesta no corresponde a una alternativa."
    return None


def arrange_options(question: dict[str, object], index: int) -> dict[str, object]:
    source_options = {
        letter: str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS
    }
    correct_option = str(question["correct_option"])
    correct_text = source_options[correct_option]
    other_options = [
        source_options[letter] for letter in OPTION_LETTERS if letter != correct_option
    ]
    correct_index = index % len(OPTION_LETTERS)
    options: list[str | None] = [None] * len(OPTION_LETTERS)
    options[correct_index] = correct_text
    for option_index, option in enumerate(other_options):
        target_index = option_index if option_index < correct_index else option_index + 1
        options[target_index] = option

    return {
        **question,
        **{
            f"option_{letter.lower()}": str(options[position])
            for position, letter in enumerate(OPTION_LETTERS)
        },
        "correct_option": OPTION_LETTERS[correct_index],
    }


def local_question(question: dict[str, object], index: int) -> dict[str, object]:
    arranged = arrange_options(question, index)
    content_hash = hashlib.sha256(
        normalized(
            " ".join(
                [
                    arranged["question_text"],
                    *[arranged[f"option_{letter.lower()}"] for letter in OPTION_LETTERS],
                ]
            )
        ).encode("utf-8")
    ).hexdigest()[:12]
    return {
        "id": f"local-enfermeria-octubre-2026-{content_hash}",
        **{key: value for key, value in arranged.items() if key not in {"source", "source_block", "area"}},
        "explanation": EXPLANATION,
        "category": "Enfermería - " + CATEGORY_BY_QUESTION.get(
            normalized(arranged["question_text"]),
            classify_nursing_area(str(arranged["question_text"])),
        ),
        "difficulty": str(arranged["source"]),
        "created_at": None,
    }


def sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def build_seed(questions: list[dict[str, object]]) -> str:
    rows = []
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

    return f"""-- Generated by scripts/import_enfermeria_octubre_2026_reviews.py
-- Sources: two distinct Moodle review attempts supplied for October 2026.
-- Questions: {len(questions)}

insert into public.questions (
  id, question_text, option_a, option_b, option_c, option_d,
  correct_option, explanation, category, difficulty
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--audit-output", type=Path, default=AUDIT_OUTPUT)
    args = parser.parse_args()

    existing = json.loads(QUESTION_JSON.read_text(encoding="utf-8"))
    retained = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith("local-enfermeria-octubre-2026-")
    ]
    existing_keys = {normalized(question["question_text"]) for question in retained}
    parsed, rejected = parse_sources()
    selected: list[dict[str, object]] = []
    selected_keys: set[str] = set()

    for question in parsed:
        key = normalized(question["question_text"])
        reason = quality_problem(question)
        if reason:
            rejected.append({**question, "reason": reason})
        elif key in existing_keys:
            rejected.append({**question, "reason": "Duplicada en el banco existente."})
        elif key in selected_keys:
            rejected.append({**question, "reason": "Duplicada entre los PDF revisados."})
        else:
            selected.append(question)
            selected_keys.add(key)

    new_questions = [local_question(question, index) for index, question in enumerate(selected)]
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(
            {
                "parsed_count": len(parsed),
                "selected_count": len(new_questions),
                "rejected_count": len(rejected),
                "selected": new_questions,
                "rejected": rejected,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    if args.write:
        QUESTION_JSON.write_text(
            json.dumps([*retained, *new_questions], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        SEED_SQL.write_text(build_seed(new_questions), encoding="utf-8")

    reasons: dict[str, int] = {}
    for rejection in rejected:
        reason = str(rejection["reason"])
        reasons[reason] = reasons.get(reason, 0) + 1
    print(f"Preguntas reconstruidas: {len(parsed)}")
    print(f"Preguntas nuevas aptas: {len(new_questions)}")
    print(f"Banco resultante: {len(retained) + len(new_questions)}")
    print(f"Descartes: {json.dumps(reasons, ensure_ascii=False)}")


if __name__ == "__main__":
    main()

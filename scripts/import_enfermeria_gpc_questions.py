from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
import unicodedata
import uuid
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
QUESTION_JSON = ROOT / "src/data/enfermeriaQuestions.json"
SEED_SQL = ROOT / "supabase/enfermeria_gpc_obstetricia_seed.sql"
CATEGORY = "Enfermería - Cuidados de la Mujer, Recién Nacido, Niño y Adolescente"
OPTION_LETTERS = ("A", "B", "C", "D")
ID_NAMESPACE = uuid.UUID("aa50b5fe-7846-44cb-b97a-1437bc086832")
MISSING_VISUAL_PATTERN = re.compile(
    r"(?:\b(?:según|de acuerdo (?:con|al)|con base en|observe|observa|analice|"
    r"interprete|revise)\s+(?:el|la|los|las)?\s*(?:gr[aá]fic[oa]|figura|imagen|"
    r"tabla|cuadro|diagrama|familiograma)\b|\bobserve\s+(?:el|la)\s+curva\b|"
    r"\brepresenta (?:el|la) gr[aá]fic[oa]\b|\brepresentaci[oó]n gr[aá]fica del "
    r"familiograma\b)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Bank:
    slug: str
    path: Path
    expected_count: int
    topic: str
    source: str

    @property
    def guide_label(self) -> str:
        return f"la GPC del MSP de Ecuador sobre {self.topic}"


BANKS = (
    Bank(
        slug="rpmp",
        path=ROOT / "Base de Caces/Banco_GPC_RupturaPrematuraMembranas_Docente.docx",
        expected_count=20,
        topic="ruptura prematura de membranas pretérmino",
        source="GPC MSP Ecuador – RPMP 2015",
    ),
    Bank(
        slug="ivu-embarazo",
        path=ROOT / "Base de Caces/Banco_EHEP_CACES_Enfermeria_IVU_Embarazo_100preguntas.docx",
        expected_count=100,
        topic="infección de vías urinarias en el embarazo",
        source="GPC MSP Ecuador – IVU en el embarazo 2013",
    ),
    Bank(
        slug="hemorragia-posparto",
        path=ROOT / "Base de Caces/Banco_100_Preguntas_EHEP_Hemorragia_Posparto_ECOTEC.docx",
        expected_count=100,
        topic="prevención, diagnóstico y tratamiento de la hemorragia posparto",
        source="GPC MSP Ecuador – Hemorragia posparto 2013",
    ),
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    return "".join(character for character in value if character.isalnum())


def normalized_option(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    return re.sub(r"[^a-z0-9+%-]+", "", value)


def identify_guide(value: str, bank: Bank) -> str:
    visual_reference_replacements = (
        (
            "Según la Tabla 1 de clasificación de la guía,",
            "De acuerdo con la clasificación de la guía,",
        ),
        (
            "Según la tabla de clasificación SIGN incluida en el Anexo 5,",
            "De acuerdo con la clasificación SIGN incluida en el Anexo 5,",
        ),
        (
            "Según la tabla de diagnóstico diferencial de la guía,",
            "De acuerdo con los criterios de diagnóstico diferencial de la guía,",
        ),
        (
            "Según la tabla de factores de riesgo de la guía,",
            "De acuerdo con los factores de riesgo descritos en la guía,",
        ),
        (
            "Según la tabla de factores de riesgo,",
            "De acuerdo con los factores de riesgo descritos en la guía,",
        ),
        (
            "Según la tabla de identificación y tratamiento de la causa de la guía,",
            "De acuerdo con las medidas para identificar y tratar la causa descritas "
            "en la guía,",
        ),
        (
            "Según la tabla de identificación y tratamiento de la causa,",
            "De acuerdo con las medidas para identificar y tratar la causa descritas "
            "en la guía,",
        ),
    )
    for source, target in visual_reference_replacements:
        value = value.replace(source, target)

    generic_reference = re.compile(
        r"\b(?:esta Guía de Práctica Clínica|esta guía de práctica clínica|"
        r"esta GPC|la GPC|esta guía|la guía)\b"
    )
    return generic_reference.sub(bank.guide_label, value)


def polish(value: str) -> str:
    replacements = (
        ("materno neonatales", "materno-neonatales"),
        ("partos pretérminos", "partos pretérmino"),
        ("Escherichia Coli", "Escherichia coli"),
        ("beta lactámicos", "betalactámicos"),
        ("uro patógenos", "uropatógenos"),
        ("membranas corioamnióticas que se producen", "membranas corioamnióticas que se produce"),
        ("50 – 100", "50-100"),
        ("250 – 500", "250-500"),
    )
    value = clean(value)

    for source, target in replacements:
        value = value.replace(source, target)

    return value


def apply_review_repairs(
    bank: Bank,
    number: int,
    question_text: str,
    options: dict[str, str],
    explanation: str,
) -> tuple[str, dict[str, str], str]:
    if bank.slug == "ivu-embarazo" and number == 11:
        question_text = question_text.replace(
            "la historia natural y pronóstico descrita",
            "la historia natural y el pronóstico descritos",
        )

    if bank.slug == "ivu-embarazo" and number == 4:
        options["A"] = (
            "Diagnóstico y tratamiento de las IVU, además de prevención, detección "
            "y tratamiento de sus complicaciones materno-neonatales."
        )

    if bank.slug == "ivu-embarazo" and number == 20:
        options["A"] = (
            "Ampicilina y combinaciones con inhibidores de betalactamasas."
        )

    if bank.slug == "ivu-embarazo" and number == 43:
        question_text = question_text.replace(
            "¿qué grado de evidencia respalda",
            "¿qué grado de recomendación y niveles de evidencia respaldan",
        )
        options["A"] = "Grado A, con niveles de evidencia 1++/2+."
        explanation = explanation.replace(
            "nivel de evidencia A 1++/2+",
            "grado de recomendación A, con niveles de evidencia 1++/2+",
        )

    if bank.slug == "ivu-embarazo" and number == 58:
        options["A"] = (
            "Espectro frente al germen, farmacocinética, efectos adversos, duración, "
            "costo y patrones locales de resistencia."
        )

    if bank.slug == "ivu-embarazo" and number == 99:
        question_text = (
            "Se dispone de una presentación parenteral intramuscular de fosfomicina "
            "que contiene lidocaína. Si una paciente embarazada requiere dosis "
            "superiores a 8 g al día, ¿puede administrarse esa misma presentación "
            "por vía intravenosa?"
        )
        options["A"] = (
            "No. La presentación intramuscular contiene lidocaína y no debe usarse "
            "por vía intravenosa; corresponde emplear la formulación IV."
        )

    if bank.slug == "rpmp" and number == 12:
        options["B"] = (
            "No. Los cursos múltiples no han demostrado beneficio neonatal frente "
            "a un curso único y se asocian con restricción del crecimiento y muerte "
            "neonatal en fetos menores de 28 semanas."
        )

    if bank.slug == "hemorragia-posparto" and number == 27:
        question_text = (
            "Según la GPC, ¿cuál es la recomendación para todas las instituciones "
            "que atienden partos?"
        )
        options["A"] = (
            "Deben estar preparadas para responder a una emergencia durante el "
            "parto y a sus posibles complicaciones."
        )

    if bank.slug == "hemorragia-posparto" and number == 51:
        question_text = question_text.replace(
            "¿cuál es la secuencia de los cuatro componentes del manejo que deben "
            "llevarse a cabo simultáneamente?",
            "¿cuáles son los cuatro componentes del manejo que deben llevarse a "
            "cabo simultáneamente?",
        )

    if bank.slug == "hemorragia-posparto" and number == 58:
        options["A"] = (
            "Verificar la expulsión e integridad de la placenta, buscar desgarros en "
            "cuello uterino, vagina y periné, y considerar una coagulopatía."
        )

    if bank.slug == "hemorragia-posparto" and number == 97:
        options["A"] = "En 2011, a una dosis de 600 µg por vía oral."
        options["B"] = "En 2005, a una dosis de 200 µg por vía oral."
        options["C"] = "En 2015, a una dosis de 1.000 µg por vía oral."
        explanation = re.sub(r"600\s*mg", "600 µg", explanation, flags=re.IGNORECASE)

    return question_text, options, explanation


def parse_bank(bank: Bank) -> list[dict[str, object]]:
    lines = [
        clean(paragraph.text)
        for paragraph in Document(bank.path).paragraphs
        if clean(paragraph.text)
    ]
    header_indexes = [
        index
        for index, line in enumerate(lines)
        if re.fullmatch(r"(?:PREGUNTA|Pregunta)\s+\d+", line)
    ]
    questions: list[dict[str, object]] = []

    for header_position, start in enumerate(header_indexes):
        stop = (
            header_indexes[header_position + 1]
            if header_position + 1 < len(header_indexes)
            else len(lines)
        )
        number = int(re.search(r"\d+", lines[start]).group())
        block = lines[start + 1 : stop]
        prompt_indexes = [
            index for index, line in enumerate(block) if line.startswith("Pregunta:")
        ]

        if len(prompt_indexes) != 1:
            raise ValueError(
                f"{bank.path.name}, pregunta {number}: se esperaba un enunciado y "
                f"se encontraron {len(prompt_indexes)}"
            )

        prompt_index = prompt_indexes[0]
        case_lines: list[str] = []
        collecting_case = False

        for line in block[:prompt_index]:
            if line.startswith("Caso clínico:"):
                collecting_case = True
                line = line.removeprefix("Caso clínico:").strip()
            if collecting_case and line:
                case_lines.append(line)

        prompt = block[prompt_index].removeprefix("Pregunta:").strip()
        question_text = polish(" ".join([*case_lines, prompt]))
        option_matches = [
            match
            for line in block
            if (match := re.match(r"^([A-D])\.\s*(.+)$", line))
        ]
        options = {match.group(1): polish(match.group(2)) for match in option_matches}
        answer_lines = [
            line for line in block if line.lower().startswith("respuesta correcta:")
        ]

        if set(options) != set(OPTION_LETTERS):
            raise ValueError(
                f"{bank.path.name}, pregunta {number}: opciones inválidas {sorted(options)}"
            )
        if len(answer_lines) != 1:
            raise ValueError(
                f"{bank.path.name}, pregunta {number}: clave de respuesta inválida"
            )

        correct_match = re.search(r"([A-D])\s*$", answer_lines[0])
        if not correct_match:
            raise ValueError(
                f"{bank.path.name}, pregunta {number}: no se pudo leer la clave"
            )
        correct_option = correct_match.group(1)

        try:
            explanation_start = next(
                index
                for index, line in enumerate(block)
                if line.lower() == "justificación de la respuesta correcta"
            )
            explanation_stop = next(
                index
                for index, line in enumerate(block)
                if line.lower() == "justificación de las opciones incorrectas"
            )
        except StopIteration as error:
            raise ValueError(
                f"{bank.path.name}, pregunta {number}: falta la justificación"
            ) from error

        explanation = polish(
            " ".join(block[explanation_start + 1 : explanation_stop])
        )
        question_text, options, explanation = apply_review_repairs(
            bank,
            number,
            question_text,
            options,
            explanation,
        )
        question_text = identify_guide(polish(question_text), bank)

        questions.append(
            {
                "bank": bank,
                "number": number,
                "question_text": question_text,
                "options": options,
                "correct_option": correct_option,
                "explanation": explanation,
            }
        )

    if len(questions) != bank.expected_count:
        raise ValueError(
            f"{bank.path.name}: se esperaban {bank.expected_count} preguntas y se "
            f"extrajeron {len(questions)}"
        )
    if [question["number"] for question in questions] != list(
        range(1, bank.expected_count + 1)
    ):
        raise ValueError(f"{bank.path.name}: la numeración no es consecutiva")

    return questions


def arrange_options(
    question: dict[str, object], target_correct_index: int
) -> tuple[dict[str, str], str]:
    options = dict(question["options"])
    source_correct = str(question["correct_option"])
    correct_text = options[source_correct]
    distractors = [options[letter] for letter in OPTION_LETTERS if letter != source_correct]
    digest = hashlib.sha256(str(question["question_text"]).encode("utf-8")).digest()
    rotation = digest[0] % len(distractors)
    distractors = distractors[rotation:] + distractors[:rotation]
    if digest[1] % 2:
        distractors.reverse()

    arranged: list[str | None] = [None] * 4
    arranged[target_correct_index] = correct_text
    distractor_iterator = iter(distractors)
    for index, option in enumerate(arranged):
        if option is None:
            arranged[index] = next(distractor_iterator)

    return (
        {
            f"option_{letter.lower()}": str(arranged[index])
            for index, letter in enumerate(OPTION_LETTERS)
        },
        OPTION_LETTERS[target_correct_index],
    )


def local_question(question: dict[str, object], global_index: int) -> dict[str, object]:
    bank = question["bank"]
    assert isinstance(bank, Bank)
    options, correct_option = arrange_options(question, global_index % 4)
    content_hash = hashlib.sha256(
        normalized(
            " ".join(
                [
                    str(question["question_text"]),
                    *[options[f"option_{letter.lower()}"] for letter in OPTION_LETTERS],
                ]
            )
        ).encode("utf-8")
    ).hexdigest()[:12]

    return {
        "id": (
            f"local-enfermeria-gpc-{bank.slug}-{int(question['number']):03d}-"
            f"{content_hash}"
        ),
        "question_text": question["question_text"],
        **options,
        "correct_option": correct_option,
        "explanation": question["explanation"],
        "category": CATEGORY,
        "difficulty": bank.source,
        "created_at": None,
    }


def validate(new_questions: list[dict[str, object]], existing: list[dict[str, object]]) -> None:
    if len(new_questions) != sum(bank.expected_count for bank in BANKS):
        raise ValueError("El total extraído no coincide con los tres bancos")

    existing_texts = {normalized(str(question["question_text"])) for question in existing}
    new_texts: set[str] = set()
    answer_counts = {letter: 0 for letter in OPTION_LETTERS}

    for question in new_questions:
        question_text = str(question["question_text"])
        options = [str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS]
        question_key = normalized(question_text)

        if not question_text or not str(question["explanation"]):
            raise ValueError(f"Pregunta o explicación vacía: {question['id']}")
        if len({normalized_option(option) for option in options}) != 4:
            raise ValueError(f"Opciones repetidas: {question['id']}")
        if question_key in existing_texts or question_key in new_texts:
            raise ValueError(f"Pregunta duplicada: {question_text}")
        if re.search(
            r"\b(?:según|de) (?:la|esta) (?:guía|gpc)\b"
            r"(?! del MSP de Ecuador)",
            question_text,
            re.IGNORECASE,
        ):
            raise ValueError(f"Referencia ambigua a la guía: {question_text}")
        if MISSING_VISUAL_PATTERN.search(question_text):
            raise ValueError(f"Dependencia visual sin recurso adjunto: {question_text}")
        if re.search(r"\bmisoprostol\b.{0,120}\b\d[\d.]*\s*mg\b", " ".join([question_text, *options, str(question["explanation"])]), re.IGNORECASE):
            raise ValueError(f"Unidad insegura de misoprostol: {question['id']}")

        new_texts.add(question_key)
        answer_counts[str(question["correct_option"])] += 1

    if len(set(answer_counts.values())) != 1:
        raise ValueError(f"Las respuestas no están balanceadas: {answer_counts}")


def sql_literal(value: object) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def build_seed(questions: list[dict[str, object]]) -> str:
    rows: list[str] = []
    for question in questions:
        stable_name = str(question["id"]).rsplit("-", 1)[0]
        identifier = uuid.uuid5(ID_NAMESPACE, stable_name)
        values = [
            str(identifier),
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

    return """-- Generated by scripts/import_enfermeria_gpc_questions.py
-- Sources: three ECOTEC teaching banks based on MSP Ecuador obstetric GPCs.
-- Questions: 220

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


def main() -> None:
    parsed = [question for bank in BANKS for question in parse_bank(bank)]
    existing = json.loads(QUESTION_JSON.read_text(encoding="utf-8"))
    source_names = {bank.source for bank in BANKS}
    retained = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith("local-enfermeria-gpc-")
        and question.get("difficulty") not in source_names
    ]
    new_questions = [
        local_question(question, index) for index, question in enumerate(parsed)
    ]

    validate(new_questions, retained)
    QUESTION_JSON.write_text(
        json.dumps([*retained, *new_questions], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    SEED_SQL.write_text(build_seed(new_questions), encoding="utf-8")

    counts = {
        bank.source: sum(
            question["difficulty"] == bank.source for question in new_questions
        )
        for bank in BANKS
    }
    answers = {
        letter: sum(question["correct_option"] == letter for question in new_questions)
        for letter in OPTION_LETTERS
    }
    print(
        f"Added {len(new_questions)} reviewed questions; total bank: "
        f"{len(retained) + len(new_questions)}"
    )
    print(f"Sources: {counts}")
    print(f"Correct-option distribution: {answers}")


if __name__ == "__main__":
    main()

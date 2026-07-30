from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pdfplumber
from pypdf import PdfReader


DEFAULT_PDF = Path("/Users/Apple/Downloads/PREGUNTA 1 (1).pdf")
DEFAULT_OUTPUT = Path("src/data/psicologiaQuestions.json")
COMPONENT = "2. Evaluación psicológica y psicodiagnóstico"
SUBCOMPONENTS = {
    "2.1": "2.1 Pruebas psicológicas en la evaluación clínica",
    "2.2": "2.2 Psicodiagnóstico: etapas",
    "2.3": "2.3 Formulación de casos",
}
OPTION_LETTERS = ("A", "B", "C", "D")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def clean_question_text(value: str) -> str:
    return clean(value).replace("?.", "?").replace("!.", "!")


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return clean(value).lower()


def field(
    block: str,
    start: str,
    end: str,
    *,
    required: bool = True,
) -> str:
    match = re.search(
        rf"{start}\s+(.*?)\s+(?={end}\s+)",
        block,
        flags=re.IGNORECASE,
    )
    if match:
        return clean(match.group(1))
    if required:
        raise ValueError(f"No se pudo extraer el campo entre {start!r} y {end!r}")
    return ""


def classify_structured_question(
    source_component: str,
    source_subcomponent: str,
    topic: str,
    definition: str,
    question_text: str,
) -> str:
    explicit = normalized(source_subcomponent)
    for key, label in SUBCOMPONENTS.items():
        if explicit.startswith(key):
            return label

    source = normalized(
        " ".join(
            [
                source_component,
                source_subcomponent,
                topic,
                definition,
                question_text,
            ]
        )
    )

    formulation_keywords = (
        "formulacion",
        "hipotesis",
        "analisis funcional",
        "plan de analisis conductual",
        "nivel de inferencia",
        "integracion del caso",
        "integracion clinica",
        "diagnostico diferencial",
        "diagnostico estructural",
        "estructura de personalidad",
        "organizacion estructural",
        "variables causales",
        "condiciones ambientales",
        "repertorios basicos de conducta",
    )
    if any(keyword in source for keyword in formulation_keywords):
        return SUBCOMPONENTS["2.3"]

    test_keywords = (
        "prueba",
        "test",
        "escala",
        "cuestionario",
        "inventario",
        "bateria",
        "psicometr",
        "confiabilidad",
        "fiabilidad",
        "validez",
        "baremo",
        "puntuacion",
        "percentil",
        "inteligencia",
        "aptitud",
        "personalidad",
        "proyectiv",
        "neuropsicolog",
        "medicion",
        "reactivo",
        "mmpi",
        "wisc",
        "wechsler",
        "rorschach",
        "desiderativo",
        "bender",
        "wisconsin",
    )
    if any(keyword in source for keyword in test_keywords):
        return SUBCOMPONENTS["2.1"]

    return SUBCOMPONENTS["2.2"]


def category_for(subcomponent: str) -> str:
    return f"Psicología - {COMPONENT} · {subcomponent}"


def rotate_options(
    options: list[tuple[str, str | None, bool]],
    question_index: int,
) -> tuple[dict[str, str], str, dict[str, str]]:
    correct = next(option for option in options if option[2])
    distractors = [option for option in options if not option[2]]
    shift = (question_index // len(OPTION_LETTERS)) % len(distractors)
    distractors = distractors[shift:] + distractors[:shift]
    target_index = question_index % len(OPTION_LETTERS)
    ordered = distractors[:]
    ordered.insert(target_index, correct)

    rendered_options: dict[str, str] = {}
    option_explanations: dict[str, str] = {}
    correct_option = "A"
    for letter, (text, explanation, is_correct) in zip(
        OPTION_LETTERS,
        ordered,
        strict=True,
    ):
        rendered_options[letter] = clean(text)
        if is_correct:
            correct_option = letter
        elif explanation:
            option_explanations[letter] = clean(explanation)

    return rendered_options, correct_option, option_explanations


def make_question(
    *,
    sequence: int,
    question_text: str,
    options: list[tuple[str, str | None, bool]],
    explanation: str,
    subcomponent: str,
    difficulty: str = "Alta",
) -> dict[str, Any]:
    rendered_options, correct_option, option_explanations = rotate_options(
        options,
        sequence - 1,
    )
    digest = hashlib.sha256(
        normalized(question_text).encode("utf-8")
    ).hexdigest()[:10]

    question: dict[str, Any] = {
        "id": f"local-psicologia-componente-2-{sequence:04d}-{digest}",
        "question_text": clean_question_text(question_text),
        "option_a": rendered_options["A"],
        "option_b": rendered_options["B"],
        "option_c": rendered_options["C"],
        "option_d": rendered_options["D"],
        "correct_option": correct_option,
        "explanation": clean(explanation),
        "option_explanations": option_explanations,
        "category": category_for(subcomponent),
        "difficulty": difficulty,
        "phase": "fase-2",
        "component": COMPONENT,
        "subcomponent": subcomponent,
        "created_at": None,
    }
    return question


def parse_structured_questions(text: str) -> list[dict[str, Any]]:
    structured_text = text.split("PREGUNTAS DEL DOCENTE", maxsplit=1)[0]
    starts = list(
        re.finditer(
            r"CAMPO\s+CONTENIDO\s+COMPONENTE\s+",
            structured_text,
            flags=re.IGNORECASE,
        )
    )
    questions: list[dict[str, Any]] = []

    for index, start in enumerate(starts):
        block_end = starts[index + 1].start() if index + 1 < len(starts) else len(
            structured_text
        )
        block = clean(structured_text[start.start() : block_end])
        source_component = field(block, r"COMPONENTE", r"SUBCOMPONENTE")
        source_subcomponent = field(block, r"SUBCOMPONENTE", r"TEMA")
        topic = field(
            block,
            r"TEMA",
            r"DEFINICI[ÓO]N\s+OPERACIONAL",
        )
        definition = field(
            block,
            r"DEFINICI[ÓO]N\s+OPERACIONAL",
            r"ENUNCIADO",
        )
        question_text = field(block, r"ENUNCIADO", r"RESPUESTA\s+CORRECTA")
        correct = field(
            block,
            r"RESPUESTA\s+CORRECTA",
            r"ARGUMENTACI[ÓO]N\s+\(Correcta\)",
        )
        correct_explanation = field(
            block,
            r"ARGUMENTACI[ÓO]N\s+\(Correcta\)",
            r"RESPUESTA\s+INCORRECTA\s+1",
        )
        incorrect_1 = field(
            block,
            r"RESPUESTA\s+INCORRECTA\s+1",
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*1\)",
        )
        incorrect_1_explanation = field(
            block,
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*1\)",
            r"RESPUESTA\s+INCORRECTA\s+2",
        )
        incorrect_2 = field(
            block,
            r"RESPUESTA\s+INCORRECTA\s+2",
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*2\)",
        )
        incorrect_2_explanation = field(
            block,
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*2\)",
            r"RESPUESTA\s+INCORRECTA\s+3",
        )
        incorrect_3 = field(
            block,
            r"RESPUESTA\s+INCORRECTA\s+3",
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*3\)",
        )
        incorrect_3_explanation = field(
            block,
            r"ARGUMENTACI[ÓO]N\s+\(Inc\.\s*3\)",
            r"BIBLIOGRAF[ÍI]A",
        )
        bibliography_match = re.search(
            r"BIBLIOGRAF[ÍI]A\s+(.*)",
            block,
            flags=re.IGNORECASE,
        )
        bibliography = clean(bibliography_match.group(1)) if bibliography_match else ""
        bibliography = re.sub(
            r"\s+(?:PREGUNTA|REGUNTA)\s+\d+.*$",
            "",
            bibliography,
            flags=re.IGNORECASE,
        ).strip()
        bibliography = re.sub(
            r"\s+PREGUNTAS(?:\s+CON\s+COMPONENTE\s+2\s+EXPLICITO"
            r"|\s+DE\s+APLICACION).*$",
            "",
            bibliography,
            flags=re.IGNORECASE,
        ).strip()
        explanation_parts = [correct_explanation]
        if bibliography:
            explanation_parts.append(f"Fuente: {bibliography}")
        subcomponent = classify_structured_question(
            source_component,
            source_subcomponent,
            topic,
            definition,
            question_text,
        )

        questions.append(
            make_question(
                sequence=len(questions) + 1,
                question_text=question_text,
                options=[
                    (correct, None, True),
                    (incorrect_1, incorrect_1_explanation, False),
                    (incorrect_2, incorrect_2_explanation, False),
                    (incorrect_3, incorrect_3_explanation, False),
                ],
                explanation=" ".join(explanation_parts),
                subcomponent=subcomponent,
            )
        )

    return questions


def teacher_subcomponent(case_number: int) -> str:
    if 1 <= case_number <= 30 or 81 <= case_number <= 90:
        return SUBCOMPONENTS["2.3"]
    if 31 <= case_number <= 45 or 91 <= case_number <= 100:
        return SUBCOMPONENTS["2.2"]
    return SUBCOMPONENTS["2.1"]


def extract_teacher_titles(path: Path) -> dict[int, str]:
    titles: dict[int, str] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["size"])
            index = 0
            while index < len(words):
                word = words[index]
                if word["text"] != "Caso" or float(word["size"]) < 15:
                    index += 1
                    continue

                heading_words = [word["text"]]
                cursor = index + 1
                while cursor < len(words) and float(words[cursor]["size"]) >= 15:
                    heading_words.append(words[cursor]["text"])
                    cursor += 1
                heading = clean(" ".join(heading_words))
                match = re.fullmatch(r"Caso\s+(\d+)\.\s+(.+)", heading)
                if match:
                    titles[int(match.group(1))] = clean(match.group(2))
                index = cursor
    return titles


def parse_teacher_questions(
    text: str,
    *,
    sequence_offset: int,
    titles: dict[int, str],
) -> list[dict[str, Any]]:
    teacher_text = text.split("PREGUNTAS DEL DOCENTE", maxsplit=1)[1]
    teacher_text = teacher_text.split(
        "REFERENCIAS BIBLIOGRÁFICAS DE BASE",
        maxsplit=1,
    )[0]
    case_starts = list(
        re.finditer(r"Caso\s+(\d+)\.\s+", teacher_text, flags=re.IGNORECASE)
    )
    questions: list[dict[str, Any]] = []

    for index, start in enumerate(case_starts):
        block_end = (
            case_starts[index + 1].start()
            if index + 1 < len(case_starts)
            else len(teacher_text)
        )
        case_number = int(start.group(1))
        block = clean(teacher_text[start.end() : block_end])
        block = re.split(
            r"\s+(?:II|III|IV|V|VI)\.\s+",
            block,
            maxsplit=1,
        )[0]
        match = re.fullmatch(
            r"(.*?)\s+Pregunta:\s+(.*?)\s+A\.\s+(.*?)\s+B\.\s+(.*?)\s+"
            r"C\.\s+(.*?)\s+D\.\s+(.*?)\s+Respuesta\s+correcta:\s*([ABCD])\s+"
            r"Justificaci[óo]n\s+de\s+la\s+respuesta:\s+(.*)",
            block,
            flags=re.IGNORECASE,
        )
        if not match:
            raise ValueError(f"No se pudo extraer el Caso {case_number}")

        case_body = clean(match.group(1))
        title = titles.get(case_number, "")
        if not title:
            raise ValueError(f"No se pudo identificar el título del Caso {case_number}")
        if not normalized(case_body).startswith(normalized(title)):
            raise ValueError(
                f"El cuerpo del Caso {case_number} no comienza con su título"
            )
        case_body = clean(case_body[len(title) :])
        if not case_body:
            raise ValueError(f"El Caso {case_number} no contiene un enunciado")
        case_and_question = f"{case_body} {clean(match.group(2))}"
        source_correct = match.group(7).upper()
        source_options = {
            "A": clean(match.group(3)),
            "B": clean(match.group(4)),
            "C": clean(match.group(5)),
            "D": clean(match.group(6)),
        }
        questions.append(
            make_question(
                sequence=sequence_offset + len(questions) + 1,
                question_text=case_and_question,
                options=[
                    (source_options[letter], None, letter == source_correct)
                    for letter in OPTION_LETTERS
                ],
                explanation=match.group(8),
                subcomponent=teacher_subcomponent(case_number),
            )
        )

    return questions


def component_one_subcomponent(category: str | None) -> str:
    if not category:
        return "1. Intervenciones clínicas y fundamentos de psicoterapia"
    if "·" in category:
        candidate = clean(category.split("·", maxsplit=1)[1])
        if not candidate.lower().startswith("preguntas caces"):
            return candidate
    return "1.1 Intervenciones clínicas individuales"


def add_component_one_metadata(
    questions: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    component = "1. Intervenciones clínicas y fundamentos de psicoterapia"
    for question in questions:
        updated = dict(question)
        updated.setdefault("phase", "fase-1")
        updated.setdefault("component", component)
        updated.setdefault(
            "subcomponent",
            component_one_subcomponent(updated.get("category")),
        )
        result.append(updated)
    return result


def question_identity(question: dict[str, Any]) -> str:
    return normalized(str(question["question_text"]))


def validate_questions(
    existing: list[dict[str, Any]],
    imported: list[dict[str, Any]],
) -> None:
    if len(imported) != 209:
        raise RuntimeError(f"Se esperaban 209 preguntas nuevas y se obtuvieron {len(imported)}")

    identities = [question_identity(question) for question in imported]
    if len(set(identities)) != len(identities):
        raise RuntimeError("El PDF contiene preguntas nuevas duplicadas de forma exacta")

    existing_identities = {question_identity(question) for question in existing}
    overlap = existing_identities.intersection(identities)
    if overlap:
        raise RuntimeError(
            f"Se detectaron {len(overlap)} preguntas ya existentes en el banco"
        )

    for question in imported:
        if question["correct_option"] not in OPTION_LETTERS:
            raise RuntimeError(f"Respuesta inválida en {question['id']}")
        if not all(question[f"option_{letter.lower()}"] for letter in OPTION_LETTERS):
            raise RuntimeError(f"Alternativas incompletas en {question['id']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    reader = PdfReader(str(args.pdf))
    text = clean(" ".join((page.extract_text() or "") for page in reader.pages))
    structured = parse_structured_questions(text)
    teacher = parse_teacher_questions(
        text,
        sequence_offset=len(structured),
        titles=extract_teacher_titles(args.pdf),
    )
    imported = structured + teacher

    existing = json.loads(args.output.read_text(encoding="utf-8"))
    if not isinstance(existing, list):
        raise TypeError("El banco existente debe ser una lista JSON")
    existing_without_component_2 = [
        question
        for question in existing
        if question.get("phase") != "fase-2"
        and not str(question.get("id", "")).startswith(
            "local-psicologia-componente-2-"
        )
    ]
    validate_questions(existing_without_component_2, imported)
    output = add_component_one_metadata(existing_without_component_2) + imported
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    subcomponent_counts = {
        label: sum(question["subcomponent"] == label for question in imported)
        for label in SUBCOMPONENTS.values()
    }
    answer_counts = {
        letter: sum(question["correct_option"] == letter for question in imported)
        for letter in OPTION_LETTERS
    }
    print(
        json.dumps(
            {
                "structured": len(structured),
                "teacher": len(teacher),
                "imported": len(imported),
                "total": len(output),
                "subcomponents": subcomponent_counts,
                "correct_options": answer_counts,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

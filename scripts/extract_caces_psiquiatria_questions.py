from __future__ import annotations

import argparse
import json
import random
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


SOURCE = Path("Bases de caces psiquiatria/COMPONENTE 1 - PREGUNTAS.docx")
OUTPUT = Path("src/data/psicologiaQuestions.json")
LETTERS = ("A", "B", "C", "D")
NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def clean(value: str) -> str:
    value = value.replace("\u00a0", " ").replace(
        "Intervenir gently", "Intervenir con tacto"
    )
    return re.sub(r"\s+", " ", value).strip()


def read_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as document:
        root = ElementTree.fromstring(document.read("word/document.xml"))

    paragraphs: list[str] = []
    for paragraph in root.iter(f"{NAMESPACE}p"):
        parts: list[str] = []
        for node in paragraph.iter():
            if node.tag == f"{NAMESPACE}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{NAMESPACE}tab":
                parts.append("\t")
        text = clean("".join(parts))
        if text:
            paragraphs.append(text)
    return paragraphs


def content_after(lines: list[str], label: str, terminators: set[str]) -> str:
    try:
        start = lines.index(label) + 1
    except ValueError as error:
        raise ValueError(f"No se encontró el campo {label}") from error

    content: list[str] = []
    for line in lines[start:]:
        if line in terminators:
            break
        content.append(line)
    value = clean(" ".join(content))
    if not value:
        raise ValueError(f"El campo {label} no tiene contenido")
    return value


def parse_question(number: int, lines: list[str]) -> dict[str, object]:
    labels = {
        "COMPONENTE",
        "SUBCOMPONENTE",
        "TEMA",
        "NIVEL COGNITIVO",
        "NIVEL COMPLEJIDAD",
        "ENUNCIADO",
        "RESPUESTA CORRECTA",
        "RESPUESTA INCORRECTA 1",
        "RESPUESTA INCORRECTA 2",
        "RESPUESTA INCORRECTA 3",
        "ARGUMENTACIÓN",
        "BIBLIOGRAFÍA",
    }
    question_text = content_after(lines, "ENUNCIADO", {"RESPUESTA CORRECTA"})
    correct_answer = content_after(
        lines,
        "RESPUESTA CORRECTA",
        {"ARGUMENTACIÓN"},
    )

    argument_indexes = [
        index for index, line in enumerate(lines) if line == "ARGUMENTACIÓN"
    ]
    if len(argument_indexes) != 4:
        raise ValueError(
            f"La pregunta {number} debe tener 4 argumentaciones; tiene {len(argument_indexes)}"
        )

    def argument_after(index: int, terminators: set[str]) -> str:
        content: list[str] = []
        for line in lines[index + 1 :]:
            if line in terminators:
                break
            content.append(line)
        value = clean(" ".join(content))
        if not value:
            raise ValueError(f"La pregunta {number} tiene una argumentación vacía")
        return value

    correct_explanation = argument_after(
        argument_indexes[0], {"RESPUESTA INCORRECTA 1"}
    )
    incorrect_answers: list[tuple[str, str]] = []
    for index in range(1, 4):
        incorrect_answers.append(
            (
                content_after(
                    lines,
                    f"RESPUESTA INCORRECTA {index}",
                    {"ARGUMENTACIÓN"},
                ),
                argument_after(
                    argument_indexes[index],
                    {
                        f"RESPUESTA INCORRECTA {index + 1}"
                        if index < 3
                        else "BIBLIOGRAFÍA"
                    },
                ),
            )
        )

    component = content_after(lines, "COMPONENTE", {"SUBCOMPONENTE"})
    theme = content_after(lines, "TEMA", {"NIVEL COGNITIVO"})
    difficulty = content_after(lines, "NIVEL COMPLEJIDAD", {"ENUNCIADO"})

    shuffled_incorrect = incorrect_answers[:]
    random.Random(number * 7919).shuffle(shuffled_incorrect)
    correct_position = (number - 1) % len(LETTERS)
    choices: list[tuple[str, str]] = []
    incorrect_index = 0
    for position in range(len(LETTERS)):
        if position == correct_position:
            choices.append((correct_answer, correct_explanation))
        else:
            choices.append(shuffled_incorrect[incorrect_index])
            incorrect_index += 1

    options = dict(zip(LETTERS, choices, strict=True))
    option_texts = [options[letter][0] for letter in LETTERS]
    if len(set(option_texts)) != len(option_texts):
        raise ValueError(f"La pregunta {number} tiene alternativas repetidas")

    return {
        "id": f"local-psicologia-psiquiatria-{number:04d}",
        "question_text": question_text,
        "option_a": options["A"][0],
        "option_b": options["B"][0],
        "option_c": options["C"][0],
        "option_d": options["D"][0],
        "correct_option": LETTERS[correct_position],
        "explanation": correct_explanation,
        "option_explanations": {
            letter: options[letter][1] for letter in LETTERS if letter != LETTERS[correct_position]
        },
        "category": f"Psicología - {component} · {theme}",
        "difficulty": difficulty,
        "created_at": None,
    }


def parse_document(path: Path, limit: int) -> list[dict[str, object]]:
    paragraphs = read_paragraphs(path)
    starts = [
        (index, int(match.group(1)))
        for index, line in enumerate(paragraphs)
        if (match := re.fullmatch(r"PREGUNTA (\d+)", line))
    ]
    questions: list[dict[str, object]] = []
    seen_numbers: set[int] = set()
    for offset, (start, number) in enumerate(starts):
        if number > limit:
            break
        end = starts[offset + 1][0] if offset + 1 < len(starts) else len(paragraphs)
        # El documento fuente repite íntegramente el bloque 41-60. Conservamos
        # la primera versión para que el simulador tenga exactamente 80 reactivos.
        if number in seen_numbers:
            continue
        questions.append(parse_question(number, paragraphs[start + 1 : end]))
        seen_numbers.add(number)

    expected_numbers = list(range(1, limit + 1))
    parsed_numbers = [
        int(str(question["id"]).rsplit("-", 1)[1]) for question in questions
    ]
    if parsed_numbers != expected_numbers:
        raise ValueError(
            f"Se esperaban las preguntas 1-{limit}; se obtuvieron {parsed_numbers}"
        )
    return questions


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrae las primeras preguntas estructuradas del banco de Psiquiatría."
    )
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--limit", type=int, default=80)
    args = parser.parse_args()

    questions = parse_document(args.source, args.limit)
    args.output.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generadas {len(questions)} preguntas en {args.output}")


if __name__ == "__main__":
    main()

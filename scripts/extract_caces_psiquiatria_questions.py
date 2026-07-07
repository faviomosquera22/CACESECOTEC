from __future__ import annotations

import argparse
import json
import random
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


SOURCE = Path("Bases de caces psiquiatria/COMPONENTE1_105_Preguntas_Final.docx")
XLSX_QUESTION_SOURCES = [
    (
        Path("Bases de caces psiquiatria/COMPONENTE1_20_Preguntas_Nuevas (1).xlsx"),
        "Banco 20 preguntas",
        "c1-nuevas",
    ),
    (
        Path("Bases de caces psiquiatria/Preguntas_Componente_1_Formato_EHEP_argumentadas (1).xlsx"),
        "Tabla completa",
        "c1-ehep",
    ),
]
JSON_QUESTION_SOURCE = Path(
    "Bases de caces psiquiatria/preguntas_caces_psicologia_clinica_1_30.json"
)
CURATED_HIGH_QUESTION_SOURCE = Path(
    "Bases de caces psiquiatria/preguntas_caces_psicologia_clinica_alta_25.json"
)
OUTPUT = Path("src/data/psicologiaQuestions.json")
LETTERS = ("A", "B", "C", "D")
NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SPREADSHEET_NAMESPACE = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RELATIONSHIP_NAMESPACE = "{http://schemas.openxmlformats.org/package/2006/relationships}"
OFFICE_RELATIONSHIP_NAMESPACE = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
)
QUESTION_HEADING_PATTERN = re.compile(
    r"PREGUNTA\s+(\d+)(?:\s+★\s+NUEVA)?",
    flags=re.IGNORECASE,
)
LEAKED_LABEL_PATTERN = re.compile(
    r"\b(?:RESPUESTA\s+(?:CORRECTA|INCORRECTA)|ARGUMENTACIÓN|BIBLIOGRAFÍA|OPCIÓN\s+[A-D])\b",
    flags=re.IGNORECASE,
)


def clean(value: str) -> str:
    if value is None:
        return ""
    value = str(value)
    value = value.replace("\u00a0", " ").replace(
        "Intervenir gently", "Intervenir con tacto"
    )
    return re.sub(r"\s+", " ", value).strip()


def normalize_for_comparison(value: str) -> str:
    return re.sub(r"[^a-z0-9áéíóúüñ]+", " ", value.lower()).strip()


def validate_question_content(
    number: int,
    question_text: str,
    option_texts: list[str],
) -> None:
    if LEAKED_LABEL_PATTERN.search(question_text):
        raise ValueError(
            f"La pregunta {number} contiene una etiqueta de respuesta en el enunciado"
        )

    normalized_question = normalize_for_comparison(question_text)
    for option_index, option_text in enumerate(option_texts):
        normalized_option = normalize_for_comparison(option_text)
        if len(normalized_option) >= 18 and normalized_option in normalized_question:
            raise ValueError(
                f"La pregunta {number} contiene el texto de la opción "
                f"{LETTERS[option_index]} dentro del enunciado"
            )

    if re.search(r"(?:^|\s)[A-D][.)]?\s*$", question_text, flags=re.IGNORECASE):
        raise ValueError(
            f"La pregunta {number} termina con una posible letra de respuesta"
        )


def normalize_option_letter(value: object) -> str:
    option = clean(str(value)).upper()
    if option not in LETTERS:
        raise ValueError(f"Opción correcta inválida: {value!r}")
    return option


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


def shared_string_text(node: ElementTree.Element) -> str:
    return clean(
        "".join(
            text_node.text or ""
            for text_node in node.iter(f"{SPREADSHEET_NAMESPACE}t")
        )
    )


def read_shared_strings(document: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(document.read("xl/sharedStrings.xml"))
    except KeyError:
        return []

    return [shared_string_text(item) for item in root.findall(f"{SPREADSHEET_NAMESPACE}si")]


def column_number(cell_reference: str) -> int:
    match = re.match(r"([A-Z]+)", cell_reference)
    if not match:
        raise ValueError(f"Referencia de celda inválida: {cell_reference}")

    number = 0
    for character in match.group(1):
        number = number * 26 + ord(character) - ord("A") + 1
    return number


def spreadsheet_cell_value(
    cell: ElementTree.Element,
    shared_strings: list[str],
) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return shared_string_text(cell)

    value_node = cell.find(f"{SPREADSHEET_NAMESPACE}v")
    if value_node is None or value_node.text is None:
        return ""

    if cell_type == "s":
        return shared_strings[int(value_node.text)]

    return clean(value_node.text)


def worksheet_path(document: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ElementTree.fromstring(document.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(document.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall(f"{RELATIONSHIP_NAMESPACE}Relationship")
    }

    for sheet in workbook.findall(f".//{SPREADSHEET_NAMESPACE}sheet"):
        if sheet.attrib.get("name") == sheet_name:
            relationship_id = sheet.attrib[f"{OFFICE_RELATIONSHIP_NAMESPACE}id"]
            target = targets[relationship_id]
            normalized_target = target.lstrip("/")
            return (
                normalized_target
                if normalized_target.startswith("xl/")
                else f"xl/{normalized_target}"
            )

    raise ValueError(f"No se encontró la hoja {sheet_name!r}")


def read_spreadsheet_rows(path: Path, sheet_name: str) -> list[list[str]]:
    with zipfile.ZipFile(path) as document:
        shared_strings = read_shared_strings(document)
        root = ElementTree.fromstring(document.read(worksheet_path(document, sheet_name)))

    rows: list[list[str]] = []
    for row in root.findall(f".//{SPREADSHEET_NAMESPACE}row"):
        values_by_column: dict[int, str] = {}
        for cell in row.findall(f"{SPREADSHEET_NAMESPACE}c"):
            reference = cell.attrib.get("r", "")
            values_by_column[column_number(reference)] = spreadsheet_cell_value(
                cell, shared_strings
            )

        if values_by_column:
            max_column = max(values_by_column)
            rows.append(
                [values_by_column.get(column, "") for column in range(1, max_column + 1)]
            )

    return rows


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


def explanation_by_option(raw_value: str, correct_option: str) -> dict[str, str]:
    raw_value = clean(raw_value)
    if not raw_value:
        return {}

    matches = list(re.finditer(r"\(([A-D])\)", raw_value))
    if matches:
        explanations: dict[str, str] = {}
        for index, match in enumerate(matches):
            option = match.group(1)
            if option == correct_option:
                continue
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(raw_value)
            explanation = clean(raw_value[start:end])
            if explanation:
                explanations[option] = explanation
        return explanations

    return {option: raw_value for option in LETTERS if option != correct_option}


def format_category(subcomponent: str, theme: str) -> str:
    return (
        "Psicología - 1. Intervenciones clínicas y fundamentos de psicoterapia"
        f" · {subcomponent} · {theme}"
    )


def question_from_spreadsheet_row(
    row: dict[str, str],
    id_prefix: str,
) -> dict[str, object]:
    number = int(row["Nº"])
    correct_option = normalize_option_letter(row["Respuesta correcta"])
    question_text = clean(row["Caso clínico y pregunta"])
    options = {
        "A": clean(row["Opción A"]),
        "B": clean(row["Opción B"]),
        "C": clean(row["Opción C"]),
        "D": clean(row["Opción D"]),
    }
    option_texts = [options[letter] for letter in LETTERS]
    if len(set(option_texts)) != len(option_texts):
        raise ValueError(f"La pregunta {id_prefix}-{number} tiene alternativas repetidas")

    validate_question_content(number, question_text, option_texts)

    explanation = clean(row["Argumentación basada en el libro"])
    reference = clean(row["Referencia"])
    if reference:
        explanation = f"{explanation} Referencia: {reference}"

    return {
        "id": f"local-psicologia-{id_prefix}-{number:04d}",
        "question_text": question_text,
        "option_a": options["A"],
        "option_b": options["B"],
        "option_c": options["C"],
        "option_d": options["D"],
        "correct_option": correct_option,
        "explanation": explanation,
        "option_explanations": explanation_by_option(
            row["Por qué las otras opciones no son la mejor respuesta"],
            correct_option,
        ),
        "category": format_category(clean(row["Subcomponente"]), clean(row["Tema"])),
        "difficulty": clean(row["Complejidad"]),
        "created_at": None,
    }


def parse_spreadsheet_questions(
    path: Path,
    sheet_name: str,
    id_prefix: str,
) -> list[dict[str, object]]:
    rows = read_spreadsheet_rows(path, sheet_name)
    if not rows:
        raise ValueError(f"La hoja {sheet_name!r} de {path} no tiene filas")

    headers = rows[0]
    questions: list[dict[str, object]] = []
    for row_values in rows[1:]:
        row = {
            header: row_values[index] if index < len(row_values) else ""
            for index, header in enumerate(headers)
        }
        if not row.get("Nº"):
            continue
        questions.append(question_from_spreadsheet_row(row, id_prefix))

    return questions


def normalize_difficulty(value: str) -> str:
    replacements = {
        "Fácil": "Baja",
        "Facil": "Baja",
        "Difícil": "Alta",
        "Dificil": "Alta",
    }
    return replacements.get(clean(value), clean(value))


def question_from_json_record(record: dict[str, object]) -> dict[str, object]:
    number = int(record["id"])
    options_raw = record["opciones"]
    if not isinstance(options_raw, dict):
        raise ValueError(f"La pregunta JSON {number} no tiene opciones válidas")

    options = {letter: clean(options_raw.get(letter, "")) for letter in LETTERS}
    option_texts = [options[letter] for letter in LETTERS]
    if len(set(option_texts)) != len(option_texts):
        raise ValueError(f"La pregunta JSON {number} tiene alternativas repetidas")

    question_text = clean(record["enunciado"])
    validate_question_content(number, question_text, option_texts)

    bibliography = clean(record.get("bibliografia", ""))
    explanation = clean(record.get("justificacion", ""))
    if bibliography:
        explanation = f"{explanation} Bibliografía: {bibliography}"

    return {
        "id": f"local-psicologia-c1-json30-{number:04d}",
        "question_text": question_text,
        "option_a": options["A"],
        "option_b": options["B"],
        "option_c": options["C"],
        "option_d": options["D"],
        "correct_option": normalize_option_letter(record["respuesta_correcta"]),
        "explanation": explanation,
        "option_explanations": {},
        "category": (
            "Psicología - 1. Intervenciones clínicas y fundamentos de psicoterapia"
            " · Preguntas CACES Psicología Clínica 1-30"
        ),
        "difficulty": normalize_difficulty(clean(record.get("nivel_dificultad", ""))),
        "created_at": None,
    }


def parse_json_questions(path: Path) -> list[dict[str, object]]:
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError(f"{path} debe contener una lista de preguntas")

    questions: list[dict[str, object]] = []
    for record in records:
        if not isinstance(record, dict):
            raise ValueError(f"{path} contiene un registro inválido")
        questions.append(question_from_json_record(record))
    return questions


def parse_curated_questions(path: Path) -> list[dict[str, object]]:
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError(f"{path} debe contener una lista de preguntas")

    questions: list[dict[str, object]] = []
    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise ValueError(f"{path} contiene un registro inválido")

        correct_option = normalize_option_letter(record["correct_option"])
        question_text = clean(record["question_text"])
        options = {
            "A": clean(record["option_a"]),
            "B": clean(record["option_b"]),
            "C": clean(record["option_c"]),
            "D": clean(record["option_d"]),
        }
        option_texts = [options[letter] for letter in LETTERS]
        if len(set(option_texts)) != len(option_texts):
            raise ValueError(
                f"La pregunta curada {index} tiene alternativas repetidas"
            )
        validate_question_content(index, question_text, option_texts)

        questions.append(
            {
                "id": clean(record["id"]),
                "question_text": question_text,
                "option_a": options["A"],
                "option_b": options["B"],
                "option_c": options["C"],
                "option_d": options["D"],
                "correct_option": correct_option,
                "explanation": clean(record.get("explanation", "")),
                "option_explanations": record.get("option_explanations", {}),
                "category": clean(record["category"]),
                "difficulty": clean(record["difficulty"]),
                "created_at": None,
            }
        )

    return questions


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

    validate_question_content(number, question_text, option_texts)

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
        if (match := QUESTION_HEADING_PATTERN.fullmatch(line))
    ]
    questions: list[dict[str, object]] = []
    seen_numbers: set[int] = set()
    for offset, (start, number) in enumerate(starts):
        if number > limit:
            break
        end = starts[offset + 1][0] if offset + 1 < len(starts) else len(paragraphs)
        # El documento fuente anterior repetía íntegramente el bloque 41-60.
        # Conservamos la primera aparición para soportar ambos formatos.
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

    normalized_questions = [
        normalize_for_comparison(str(question["question_text"]))
        for question in questions
    ]
    if len(set(normalized_questions)) != len(normalized_questions):
        raise ValueError("El documento contiene enunciados duplicados")

    return questions


def validate_question_bank(questions: list[dict[str, object]]) -> None:
    ids = [str(question["id"]) for question in questions]
    if len(set(ids)) != len(ids):
        raise ValueError("El banco contiene IDs duplicados")

    normalized_questions = [
        normalize_for_comparison(str(question["question_text"]))
        for question in questions
    ]
    if len(set(normalized_questions)) != len(normalized_questions):
        raise ValueError("El banco contiene enunciados duplicados")


def parse_all_questions(docx_source: Path, limit: int) -> list[dict[str, object]]:
    questions = parse_document(docx_source, limit)

    for source, sheet_name, id_prefix in XLSX_QUESTION_SOURCES:
        questions.extend(parse_spreadsheet_questions(source, sheet_name, id_prefix))

    questions.extend(parse_json_questions(JSON_QUESTION_SOURCE))
    questions.extend(parse_curated_questions(CURATED_HIGH_QUESTION_SOURCE))
    validate_question_bank(questions)
    return questions


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrae las preguntas estructuradas del banco de Psicología."
    )
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--limit", type=int, default=105)
    args = parser.parse_args()

    questions = parse_all_questions(args.source, args.limit)
    args.output.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generadas {len(questions)} preguntas en {args.output}")


if __name__ == "__main__":
    main()

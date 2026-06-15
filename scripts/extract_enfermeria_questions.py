from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

from pypdf import PdfReader


PDFS = [
    (
        Path("Base de Caces/BANCO DE PRENGUNTAS ENFERMERIA - CONVOCATORIA I 2023 (1).pdf"),
        "CACES 2023",
    ),
    (
        Path("Base de Caces/CACES_Banco_Preguntas_Carrera_Enfermeria_Jun_2022.pdf.pdf"),
        "CACES 2022",
    ),
]

DOCX_FIRST_OPTION_IS_CORRECT = [
    (
        Path("Base de Caces/BANCO PREGUNTAS  CACES  OCT 2023 (Autoguardado).docx"),
        "CACES Octubre 2023",
    ),
]

PDFS_WITH_EXPLICIT_ANSWER = [
    (
        Path("Base de Caces/PREGUNTAS FILTRADAS ENFERMERIA CACES 2026 _20260529_194953_0000.pdf"),
        "CACES 2025/2026 Meducators",
    ),
]

GOOGLE_DOCS = [
    (
        "19MCvJw93sah7mEX41X_x1rRrWYtsi8M--PmlTJyz78E",
        "Preguntas referenciales EHEP Mayo",
    ),
]

NURSING_AREAS = [
    "Cuidado y Procedimientos Clínicos de Enfermería",
    "Cuidados de la Mujer, Recién Nacido, Niño y Adolescente",
    "Cuidados del Adulto y Adulto Mayor",
    "Cuidado Familiar, Comunitario e Intercultural",
    "Bases Educativas, Administrativas, Investigativas y Epidemiológicas",
]

OPTION_LETTERS = ["A", "B", "C", "D"]
EXPLANATION = (
    "Respuesta importada del banco CACES. Las opciones fueron reorganizadas "
    "para el simulador manteniendo la respuesta correcta marcada."
)


def clean_line(line: str) -> str:
    line = line.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", line).strip()


def clean_option(option: str) -> str:
    option = clean_line(option)
    option = re.sub(r"\s+(?:\d+\.\s*){2,}.*$", "", option).strip()
    option = re.sub(
        r"\s+(?:Complete el enunciado|Seleccione|Identifique|Relacione|Ordene):?.*$",
        "",
        option,
        flags=re.IGNORECASE,
    ).strip()
    return option


def clean_question_text(question_text: str) -> str:
    question_text = clean_line(question_text)
    question_text = re.sub(
        r"^\d+(?:\.\d+)*\s*[-.)]?\s*[A-Z]{1,8}\s*-\s*",
        "",
        question_text,
    )
    question_text = re.sub(r"^\d+(?:\.\d+)*\s*[-.)]\s*", "", question_text)
    question_text = re.sub(
        r"^(?:Educación médica, del futuro\.\s*)+",
        "",
        question_text,
        flags=re.IGNORECASE,
    )
    question_text = re.sub(
        r"^Bibliografía:\s*.*?(?=(?:Paciente|Un |Una |Durante |En |¿|Cuál|Qué|Según|De acuerdo|Dentro|Como parte|Al ))",
        "",
        question_text,
        flags=re.IGNORECASE,
    )
    question_starts = re.compile(
        r"(?:\bPaciente|\bUn |\bUna |\bDurante|\bEn una|\bEn un|\bEn el|¿|\bCuál|\bQué|\bSegún|\bDe acuerdo|\bDentro|\bComo parte|\bAnte |\bUsted |\bEl hospital|\bLos problemas)",
        flags=re.IGNORECASE,
    )
    for match in question_starts.finditer(question_text):
        prefix = question_text[: match.start()]
        prefix_lower = prefix.lower()

        if not prefix:
            break

        if (
            len(prefix) >= 12
            and (
                "bibliografía" in prefix_lower
                or "b i b l i o g r" in prefix_lower
                or "msp" in prefix_lower
                or "ops" in prefix_lower
                or re.search(r"\(\s*2\s*0\s*\d\s*\d\s*\)", prefix)
                or re.search(r"\(\d{4}\)", prefix)
                or ";" in prefix
            )
        ):
            question_text = question_text[match.start() :]
            break

    question_text = question_text.replace("¿ ", "¿")
    question_text = question_text.replace(" ?", "?")
    return question_text.strip(" .")


def is_code_option(option: str) -> bool:
    option = clean_option(option)
    return bool(
        re.match(r"^\d+[a-z]{1,4}\s*,", option, flags=re.IGNORECASE)
        or re.match(r"^\d+\s*,\s*\d+", option)
    )


def has_distinct_options(options: list[str]) -> bool:
    normalized_options = [
        re.sub(r"\W+", "", clean_option(option).lower()) for option in options
    ]
    return len(normalized_options) == len(set(normalized_options))


def is_question_usable(question_text: str, options: list[str]) -> bool:
    lower = question_text.lower()
    blocked_patterns = [
        r"\brelacione\b",
        r"\bordene\b",
        r"\bgráfico\b",
        r"\bgrafico\b",
        r"\bfigura\b",
        r"\bimagen\b",
        r"\btabla\b",
        r"\bcuadro\b",
        r"de acuerdo al gráfico",
    ]

    if any(re.search(pattern, lower) for pattern in blocked_patterns):
        return False

    if not has_distinct_options(options):
        return False

    if question_text.rstrip().endswith(","):
        return False

    if re.search(r"(?:\d+\.\s*){2,}", question_text):
        return False

    # Many PDF-extracted matching/list questions lose their numbered premises,
    # leaving only answer codes like "1bd, 2ac". Those are not useful in-app.
    if any(is_code_option(option) for option in options):
        return False

    if any(
        re.search(
            r"(?:\d+\.\s*){2,}|complete el enunciado|\bseleccione\b|\bidentifique\b|\brelacione\b|\bordene\b",
            option,
            flags=re.IGNORECASE,
        )
        for option in options
    ):
        return False

    return True


def classify_nursing_area(question_text: str) -> str:
    text = question_text.lower()
    woman_child_keywords = [
        "embaraz",
        "gestante",
        "prenatal",
        "parto",
        "puerper",
        "placenta",
        "recién nacido",
        "recien nacido",
        "neonato",
        "neonatal",
        "lactancia",
        "leche materna",
        "materna",
        "niño",
        "niña",
        "pediatr",
        "adolescente",
        "vacuna",
        "inmunización",
        "inmunizacion",
    ]
    adult_keywords = [
        "adulto mayor",
        "geriatr",
        "anciano",
        "alzheimer",
        "diabetes",
        "hipertensión",
        "hipertension",
        "insuficiencia cardi",
        "insuficiencia renal",
        "epoc",
        "enfermedad pulmonar",
        "medicina interna",
        "paciente de 75",
        "paciente de 85",
    ]
    community_keywords = [
        "familia",
        "familiar",
        "comunit",
        "intercultural",
        "mais",
        "ficha familiar",
        "dispensarización",
        "dispensarizacion",
        "ciudadanía",
        "ciudadania",
        "derechos sexuales",
        "salud sexual",
        "participación",
        "participacion",
    ]
    bases_keywords = [
        "investig",
        "hipótesis",
        "hipotesis",
        "muestra",
        "muestreo",
        "variable",
        "epidemiol",
        "administr",
        "planificación",
        "planificacion",
        "organización",
        "organizacion",
        "dirección",
        "direccion",
        "control",
        "liderazgo",
        "calidad",
        "bioética",
        "bioetica",
        "teoría",
        "teoria",
        "florence",
        "nightingale",
        "nanda",
        "diagnóstico enfermero",
        "diagnostico enfermero",
    ]

    if any(keyword in text for keyword in woman_child_keywords):
        return NURSING_AREAS[1]
    if any(keyword in text for keyword in adult_keywords):
        return NURSING_AREAS[2]
    if any(keyword in text for keyword in community_keywords):
        return NURSING_AREAS[3]
    if any(keyword in text for keyword in bases_keywords):
        return NURSING_AREAS[4]

    return NURSING_AREAS[0]


def skip_line(line: str) -> bool:
    lower = line.lower()

    if not line:
        return True

    skip_starts = [
        "http://",
        "https://",
        "este documento se encuentra sujeto",
        "consentimiento informado.",
        "banco de preguntas",
        "carrera de enfermeria",
        "octubre 2023",
        "examen de habilitación",
        "de conformidad con",
        "por lo tanto",
        "2. utilizar",
        "3. no realizar",
        "estos deberes",
    ]

    if any(lower.startswith(value) for value in skip_starts):
        return True

    if re.fullmatch(r"\d+", line):
        return True

    # Table residue from some extracted PDF pages.
    if re.fullmatch(r"(?:\d+\.\s*){2,}", line):
        return True

    return False


def docx_paragraphs(path: Path) -> list[str]:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []

    with zipfile.ZipFile(path) as docx:
        document = ET.fromstring(docx.read("word/document.xml"))

    for paragraph in document.findall(".//w:p", namespace):
        text = "".join(
            node.text or "" for node in paragraph.findall(".//w:t", namespace)
        )
        line = clean_line(text)

        if line:
            paragraphs.append(line)

    return paragraphs


def looks_like_new_question(line: str) -> bool:
    starts = (
        "¿",
        "De acuerdo",
        "Relacione",
        "Seleccione",
        "Identifique",
        "Según",
        "Al ",
        "El ",
        "La ",
        "Los ",
        "Las ",
        "Paciente",
        "Una ",
        "Un ",
        "En ",
        "Durante ",
        "Luego ",
        "Cuál",
        "Cuáles",
    )

    if line.startswith(starts):
        return True

    return bool(re.match(r"^[A-ZÁÉÍÓÚÑ][^\.]{25,}", line))


def parse_pdf(path: Path, source: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    questions: list[dict[str, object]] = []
    question_lines: list[str] = []
    options: list[str] = []
    current_option: str | None = None
    collecting_options = False

    def finish_option() -> None:
        nonlocal current_option

        if current_option is not None:
            options.append(clean_line(current_option))
            current_option = None

    def finish_question() -> None:
        nonlocal question_lines, options

        finish_option()

        if len(options) >= 4:
            question_text = clean_line(" ".join(question_lines))
            option_values = [clean_option(option) for option in options[:4]]

            if (
                12 < len(question_text) <= 2500
                and all(0 < len(option) <= 900 for option in option_values)
                and is_question_usable(question_text, option_values)
            ):
                questions.append(
                    {
                        "question_text": question_text,
                        "option_a": option_values[0],
                        "option_b": option_values[1],
                        "option_c": option_values[2],
                        "option_d": option_values[3],
                        "area": classify_nursing_area(question_text),
                        "source": source,
                    }
                )

        question_lines = []
        options = []

    for page_index, page in enumerate(reader.pages):
        # The first two pages are cover/legal notice in both source banks.
        if page_index < 2:
            continue

        text = page.extract_text() or ""

        for raw_line in text.splitlines():
            line = clean_line(raw_line)

            if skip_line(line):
                continue

            if line.lower().startswith("respuestas"):
                collecting_options = True
                options = []
                current_option = None
                continue

            if collecting_options:
                if line.startswith("-"):
                    finish_option()
                    current_option = line.lstrip("-").strip()
                    continue

                if current_option is not None:
                    if len(options) >= 3 and looks_like_new_question(line):
                        finish_question()
                        collecting_options = False
                        question_lines.append(line)
                    else:
                        current_option += " " + line
                    continue

                question_lines.append(line)
                collecting_options = False
                continue

            question_lines.append(line)

    if collecting_options:
        finish_question()

    return questions


def parse_first_option_docx(path: Path, source: str) -> list[dict[str, object]]:
    questions: list[dict[str, object]] = []
    question_lines: list[str] = []
    options: list[str] = []
    collecting_options = False

    def finish_question() -> None:
        nonlocal question_lines, options, collecting_options

        if len(options) >= 4:
            question_text = clean_question_text(" ".join(question_lines))
            option_values = [clean_option(option) for option in options[:4]]

            if (
                12 < len(question_text) <= 2500
                and all(0 < len(option) <= 900 for option in option_values)
                and is_question_usable(question_text, option_values)
            ):
                questions.append(
                    {
                        "question_text": question_text,
                        "option_a": option_values[0],
                        "option_b": option_values[1],
                        "option_c": option_values[2],
                        "option_d": option_values[3],
                        "area": classify_nursing_area(question_text),
                        "source": source,
                    }
                )

        question_lines = []
        options = []
        collecting_options = False

    for raw_line in docx_paragraphs(path):
        line = clean_line(raw_line)

        if skip_line(line) or line == ".":
            continue

        if line.lower().startswith(("respuestas:", "opciones:")):
            collecting_options = True
            options = []
            continue

        if collecting_options:
            option = clean_option(line.lstrip("-").strip())

            if option:
                options.append(option)

            if len(options) >= 4:
                finish_question()

            continue

        if looks_like_new_question(line) and question_lines and not collecting_options:
            # Defensive reset for malformed blocks that never reached four options.
            question_lines = []

        question_lines.append(line)

    return questions


def clean_meductor_line(line: str) -> str:
    line = clean_line(line)
    line = re.sub(r"^o\s+", "", line, flags=re.IGNORECASE).strip()
    return clean_option(line)


def meductor_skip_line(line: str) -> bool:
    lower = line.lower()

    if skip_line(line):
        return True

    skip_exact = {
        "educación médica, del futuro.",
        "justificación:",
        "bibliografía:",
    }

    is_spaced_heading = bool(re.search(r"(?:[A-ZÁÉÍÓÚÑ]\s+){6,}", line))

    return (
        lower in skip_exact
        or lower.startswith("componente ")
        or lower.startswith("subcomponente:")
        or lower.startswith("tema:")
        or lower == "estructura"
        or is_spaced_heading
        or lower.startswith("potter & perry")
        or lower.startswith("brunner & suddarth")
        or lower.startswith("normas msp")
        or lower.startswith("cie ")
        or lower.startswith("alligood")
    )


def normalized_answer(value: str) -> str:
    return re.sub(r"\W+", "", clean_option(value).lower())


def option_index_for_answer(options: list[str], answer: str) -> int | None:
    normalized = normalized_answer(answer)

    if not normalized:
        return None

    for index, option in enumerate(options):
        option_normalized = normalized_answer(option)

        if option_normalized == normalized:
            return index

    for index, option in enumerate(options):
        option_normalized = normalized_answer(option)

        if normalized in option_normalized or option_normalized in normalized:
            return index

    return None


class GoogleDocTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = clean_line(data)

        if value:
            self.parts.append(value)


def google_doc_lines(doc_id: str) -> list[str]:
    url = f"https://docs.google.com/document/d/{doc_id}/mobilebasic"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", "replace")

    parser = GoogleDocTextParser()
    parser.feed(html)
    lines = [clean_line(line) for line in parser.parts if clean_line(line)]
    start_index = next(
        (
            index
            for index, line in enumerate(lines)
            if "preguntas referenciales" in line.lower()
        ),
        0,
    )

    return lines[start_index:]


def clean_google_line(line: str) -> str:
    line = clean_line(line)
    line = line.replace("✅", "").strip()
    return line


def is_google_block_start(line: str) -> bool:
    return bool(
        re.fullmatch(r"Caso(?:\s+Clínico)?\s+\d+", line, flags=re.IGNORECASE)
        or re.fullmatch(r"Pregunta\s+\d+", line, flags=re.IGNORECASE)
    )


def google_option_match(line: str) -> re.Match[str] | None:
    return re.match(r"^([A-Da-d])[\.)]\s*(.*)$", clean_google_line(line))


def collect_google_options(lines: list[str]) -> dict[str, str]:
    options: dict[str, str] = {}
    current_letter: str | None = None

    for raw_line in lines:
        line = clean_google_line(raw_line)
        match = google_option_match(line)

        if match:
            current_letter = match.group(1).upper()
            options[current_letter] = clean_option(match.group(2))
            continue

        if current_letter and line:
            options[current_letter] = clean_line(f"{options[current_letter]} {line}")

    return options


def google_answer_letter(answer: str, options: dict[str, str]) -> str | None:
    answer = clean_google_line(answer)
    match = google_option_match(answer)

    if match:
        return match.group(1).upper()

    index = option_index_for_answer(
        [options[letter] for letter in OPTION_LETTERS],
        answer,
    )

    if index is None:
        return None

    return OPTION_LETTERS[index]


def parse_google_doc_block(
    block: list[str],
    source: str,
) -> dict[str, object] | None:
    lines = [clean_google_line(line) for line in block if clean_google_line(line)]

    if not lines:
        return None

    answer_marker = next(
        (
            index
            for index, line in enumerate(lines)
            if line.lower().rstrip(":") == "respuesta correcta"
        ),
        None,
    )

    if answer_marker is None:
        return None

    explicit_question_marker = next(
        (
            index
            for index, line in enumerate(lines)
            if line.lower().rstrip(":") == "pregunta"
        ),
        None,
    )
    explicit_options_marker = next(
        (
            index
            for index, line in enumerate(lines)
            if line.lower().rstrip(":") == "opciones"
        ),
        None,
    )

    if explicit_options_marker is not None:
        options_start = explicit_options_marker + 1
        question_start = (
            explicit_question_marker + 1
            if explicit_question_marker is not None
            else 1
        )
        question_stop = explicit_options_marker
        context_lines = lines[1:explicit_question_marker or 1]
    else:
        options_start = next(
            (
                index
                for index, line in enumerate(lines)
                if google_option_match(line)
            ),
            None,
        )

        if options_start is None:
            return None

        question_start = 1
        question_stop = options_start
        context_lines = []

    if options_start >= answer_marker:
        return None

    question_lines = [
        line
        for line in [*context_lines, *lines[question_start:question_stop]]
        if line.lower() not in {"caso clínico", "opciones", "pregunta"}
        and not line.lower().startswith("sección:")
    ]
    question_text = clean_question_text(" ".join(question_lines))
    options = collect_google_options(lines[options_start:answer_marker])

    if set(options) != set(OPTION_LETTERS):
        return None

    answer_line = next(
        (
            line
            for line in lines[answer_marker + 1 :]
            if line
            and line.lower().rstrip(":")
            not in {"justificación", "fundamento", "bibliografía", "referencia bibliográfica"}
        ),
        "",
    )
    correct_option = google_answer_letter(answer_line, options)

    if correct_option not in set(OPTION_LETTERS):
        return None

    explanation_start = next(
        (
            index
            for index, line in enumerate(lines)
            if line.lower().rstrip(":") in {"justificación", "fundamento"}
        ),
        None,
    )
    reference_start = next(
        (
            index
            for index, line in enumerate(lines)
            if line.lower().rstrip(":")
            in {"referencia bibliográfica", "bibliografía"}
        ),
        None,
    )
    explanation = EXPLANATION

    if explanation_start is not None:
        explanation_lines = lines[
            explanation_start + 1 : reference_start or len(lines)
        ]
        explanation_text = clean_line(" ".join(explanation_lines))

        if explanation_text:
            explanation = explanation_text

    option_values = [options[letter] for letter in OPTION_LETTERS]

    if (
        not 12 < len(question_text) <= 2500
        or not all(0 < len(option) <= 900 for option in option_values)
        or not is_question_usable(question_text, option_values)
    ):
        return None

    return {
        "question_text": question_text,
        "option_a": options["A"],
        "option_b": options["B"],
        "option_c": options["C"],
        "option_d": options["D"],
        "correct_option": correct_option,
        "explanation": explanation,
        "area": classify_nursing_area(question_text),
        "source": source,
    }


def parse_google_doc(doc_id: str, source: str) -> list[dict[str, object]]:
    lines = google_doc_lines(doc_id)
    starts = [
        index for index, line in enumerate(lines) if is_google_block_start(line)
    ]
    questions: list[dict[str, object]] = []

    for position, start in enumerate(starts):
        stop = starts[position + 1] if position + 1 < len(starts) else len(lines)
        question = parse_google_doc_block(lines[start:stop], source)

        if question:
            questions.append(question)

    return questions


def parse_explicit_answer_pdf(path: Path, source: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    # The first pages are cover/marketing/index material; questions start on page 5.
    text = "\n".join((page.extract_text() or "") for page in reader.pages[4:])
    chunks = re.split(r"\n\s*PREGUNTA\s+\d+\s+-\s+CACES\s+2025\s*\n", text)
    questions: list[dict[str, object]] = []

    for chunk in chunks:
        lines = [clean_line(line) for line in chunk.splitlines()]
        lines = [line for line in lines if line and not meductor_skip_line(line)]

        answer_marker = next(
            (
                index
                for index, line in enumerate(lines)
                if line.lower().startswith("respuesta correcta")
            ),
            None,
        )

        if answer_marker is None:
            continue

        before_answer = lines[:answer_marker]
        after_answer = lines[answer_marker + 1 :]
        option_lines: list[str] = []
        question_lines: list[str] = []
        reading_options = False

        for line in before_answer:
            if re.match(r"^o\s+", line, flags=re.IGNORECASE):
                reading_options = True
                option_lines.append(clean_meductor_line(line))
                continue

            if reading_options and option_lines:
                option_lines[-1] = clean_line(f"{option_lines[-1]} {line}")
                continue

            if not reading_options:
                question_lines.append(line)

        answer_parts: list[str] = []
        for line in after_answer:
            if line.lower().startswith(("justificación", "bibliografía")):
                break

            if meductor_skip_line(line):
                continue

            answer_parts.append(clean_meductor_line(line))

            if answer_parts:
                break

        question_text = clean_question_text(" ".join(question_lines))
        options = [clean_option(option) for option in option_lines[:4]]
        answer_text = clean_option(" ".join(answer_parts))
        correct_index = option_index_for_answer(options, answer_text)

        if (
            correct_index is None
            or len(options) != 4
            or not 12 < len(question_text) <= 2500
            or not all(0 < len(option) <= 900 for option in options)
            or not is_question_usable(question_text, options)
        ):
            continue

        arranged = [options[correct_index]] + [
            option for index, option in enumerate(options) if index != correct_index
        ]

        questions.append(
            {
                "question_text": question_text,
                "option_a": arranged[0],
                "option_b": arranged[1],
                "option_c": arranged[2],
                "option_d": arranged[3],
                "area": classify_nursing_area(question_text),
                "source": source,
            }
        )

    return questions


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def question_key(question: dict[str, object]) -> str:
    text = " ".join(
        str(question[key])
        for key in ["question_text", "option_a", "option_b", "option_c", "option_d"]
    )
    normalized = re.sub(r"\W+", "", text.lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def build_answer_layout(question: dict[str, object]) -> dict[str, str]:
    """Keep the first PDF answer as correct, but distribute it across A-D."""

    if "correct_option" in question:
        return {
            "option_a": str(question["option_a"]),
            "option_b": str(question["option_b"]),
            "option_c": str(question["option_c"]),
            "option_d": str(question["option_d"]),
            "correct_option": str(question["correct_option"]),
        }

    key = str(question["key"])
    correct_index = int(key[:8], 16) % 4
    distractors = [
        str(question["option_b"]),
        str(question["option_c"]),
        str(question["option_d"]),
    ]
    rotation = int(key[8:10], 16) % len(distractors)
    distractors = distractors[rotation:] + distractors[:rotation]

    if int(key[10:12], 16) % 2 == 1:
        distractors = list(reversed(distractors))

    arranged: list[str | None] = [None, None, None, None]
    arranged[correct_index] = str(question["option_a"])

    distractor_index = 0
    for index in range(len(arranged)):
        if arranged[index] is None:
            arranged[index] = distractors[distractor_index]
            distractor_index += 1

    return {
        "option_a": arranged[0] or "",
        "option_b": arranged[1] or "",
        "option_c": arranged[2] or "",
        "option_d": arranged[3] or "",
        "correct_option": OPTION_LETTERS[correct_index],
    }


def load_questions() -> list[dict[str, object]]:
    deduped: list[dict[str, object]] = []
    seen: set[str] = set()
    seen_questions: set[str] = set()

    sources = [
        *(
            (pdf_path, source, parse_pdf)
            for pdf_path, source in PDFS
        ),
        *(
            (docx_path, source, parse_first_option_docx)
            for docx_path, source in DOCX_FIRST_OPTION_IS_CORRECT
        ),
        *(
            (pdf_path, source, parse_explicit_answer_pdf)
            for pdf_path, source in PDFS_WITH_EXPLICIT_ANSWER
        ),
    ]

    for source_path, source, parser in sources:
        for question in parser(source_path, source):
            key = question_key(question)
            question_text_key = re.sub(
                r"\W+", "", str(question["question_text"]).lower()
            )

            if key in seen or question_text_key in seen_questions:
                continue

            seen.add(key)
            seen_questions.add(question_text_key)
            question["key"] = key
            deduped.append(question)

    for doc_id, source in GOOGLE_DOCS:
        for question in parse_google_doc(doc_id, source):
            key = question_key(question)
            question_text_key = re.sub(
                r"\W+", "", str(question["question_text"]).lower()
            )

            if key in seen or question_text_key in seen_questions:
                continue

            seen.add(key)
            seen_questions.add(question_text_key)
            question["key"] = key
            deduped.append(question)

    return deduped


def build_sql(questions: list[dict[str, object]]) -> str:
    header = f"""-- Generated by scripts/extract_enfermeria_questions.py
-- Source: local PDFs in Base de Caces
-- Questions: {len(questions)}

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text check (role in ('student', 'teacher')),
  career text,
  created_at timestamp with time zone default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  category text,
  difficulty text,
  created_at timestamp with time zone default now()
);

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  total_questions integer,
  correct_answers integer,
  incorrect_answers integer,
  score numeric,
  time_used_seconds integer,
  status text,
  created_at timestamp with time zone default now()
);

create table if not exists public.simulation_answers (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  answered_at timestamp with time zone
);

create unique index if not exists questions_seed_hash_idx
on public.questions ((md5(question_text || option_a || option_b || option_c || option_d)));

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_answers enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "Teachers can read profiles" on public.profiles;
create policy "Teachers can read profiles"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or public.current_profile_role() = 'teacher'
);

drop policy if exists "Students can update own profile" on public.profiles;
create policy "Students can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id and role = 'student')
with check (auth.uid() = id and role = 'student');

drop policy if exists "Authenticated users can read questions" on public.questions;
create policy "Authenticated users can read questions"
on public.questions for select to authenticated
using (true);

drop policy if exists "Students can read own simulations" on public.simulations;
create policy "Students can read own simulations"
on public.simulations for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own simulations" on public.simulations;
create policy "Students can insert own simulations"
on public.simulations for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can read simulations" on public.simulations;
create policy "Teachers can read simulations"
on public.simulations for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

drop policy if exists "Students can read own simulation answers" on public.simulation_answers;
create policy "Students can read own simulation answers"
on public.simulation_answers for select to authenticated
using (
  exists (
    select 1 from public.simulations
    where simulations.id = simulation_answers.simulation_id
      and simulations.student_id = auth.uid()
  )
);

drop policy if exists "Students can insert own simulation answers" on public.simulation_answers;
create policy "Students can insert own simulation answers"
on public.simulation_answers for insert to authenticated
with check (
  exists (
    select 1 from public.simulations
    where simulations.id = simulation_answers.simulation_id
      and simulations.student_id = auth.uid()
  )
);

drop policy if exists "Teachers can read simulation answers" on public.simulation_answers;
create policy "Teachers can read simulation answers"
on public.simulation_answers for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'teacher'
  )
);

insert into public.questions (
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
"""

    rows = []
    for question in questions:
        layout = build_answer_layout(question)
        rows.append(
            "("
            + ", ".join(
                [
                    sql_literal(str(question["question_text"])),
                    sql_literal(layout["option_a"]),
                    sql_literal(layout["option_b"]),
                    sql_literal(layout["option_c"]),
                    sql_literal(layout["option_d"]),
                    sql_literal(layout["correct_option"]),
                    sql_literal(str(question.get("explanation", EXPLANATION))),
                    sql_literal(f"Enfermería - {question['area']}"),
                    sql_literal(str(question["source"])),
                ]
            )
            + ")"
        )

    return header + ",\n".join(rows) + "\non conflict do nothing;\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("supabase/caces_schema_and_enfermeria_seed.sql"),
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path("src/data/enfermeriaQuestions.json"),
    )
    args = parser.parse_args()

    questions = load_questions()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_sql(questions), encoding="utf-8")

    local_questions = []
    for index, question in enumerate(questions, start=1):
        layout = build_answer_layout(question)
        local_questions.append(
            {
                "id": f"local-enfermeria-{index:04d}-{str(question['key'])[:12]}",
                "question_text": question["question_text"],
                "option_a": layout["option_a"],
                "option_b": layout["option_b"],
                "option_c": layout["option_c"],
                "option_d": layout["option_d"],
                "correct_option": layout["correct_option"],
                "explanation": question.get("explanation", EXPLANATION),
                "category": f"Enfermería - {question['area']}",
                "difficulty": question["source"],
                "created_at": None,
            }
        )

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(local_questions, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"Generated {args.output} and {args.json_output} with {len(questions)} questions"
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
QUESTION_JSON = ROOT / "src/data/enfermeriaQuestions.json"
SEED_SQL = ROOT / "supabase/enfermeria_aiepi_seed.sql"
OPTION_LETTERS = ("A", "B", "C", "D")
ID_NAMESPACE = uuid.UUID("c011b1ec-1b47-4742-8b5b-c2c99b6e7fce")
CATEGORY = "Enfermería - Cuidados de la Mujer, Recién Nacido, Niño y Adolescente"


@dataclass(frozen=True)
class Bank:
    slug: str
    path: Path
    expected_count: int
    difficulty: str
    heading_pattern: re.Pattern[str]


BANKS = (
    Bank(
        slug="aiepi-casos-uees",
        path=Path("/Users/Apple/Downloads/UEES_Prueba_AIEPI_20Casos_ClaveRespuestas (2).docx"),
        expected_count=20,
        difficulty="AIEPI Clínico MSP Ecuador 2017 — Casos UEES",
        heading_pattern=re.compile(r"^Caso\s+(\d+)\b", re.I),
    ),
    Bank(
        slug="aiepi-docente-100",
        path=Path("/Users/Apple/Downloads/AIEPI_100preguntas_Docente.docx"),
        expected_count=100,
        difficulty="AIEPI Clínico MSP Ecuador 2017 — Banco Docente",
        heading_pattern=re.compile(r"^Pregunta\s+(\d+)\b", re.I),
    ),
)

# Correcciones de redacción aplicadas únicamente al banco del simulador. El
# contenido clínico y la clave se mantienen fieles a los documentos de origen.
EDITORIAL_REPAIRS = {
    ("aiepi-casos-uees", 5): (
        "Caso clínico: Niño de 4 años en zona de riesgo de dengue, fiebre de "
        "3 días, hoy con vómito persistente y dolor abdominal intenso continuo. "
        "¿Cuál es el manejo correcto?"
    ),
    ("aiepi-casos-uees", 13): (
        "Caso clínico: Niño de 4 años con sangre en heces, fiebre y cólicos "
        "abdominales. ¿Cuál es la conducta correcta antes de referir?"
    ),
    ("aiepi-docente-100", 25): (
        "Caso clínico: Una niña de 4 años que vive en zona de riesgo de dengue "
        "presenta fiebre de 3 días y hoy inicia con dolor abdominal intenso y "
        "continuo, y vómito persistente. ¿Cuál es la clasificación correcta según "
        "la guía?"
    ),
    ("aiepi-docente-100", 33): (
        "Caso clínico: Un niño de 4 años presenta fiebre de 38.5 °C, amígdalas "
        "eritematosas con exudado purulento, ganglios cervicales anteriores "
        "crecidos y dolorosos, y ausencia de tos. ¿Cuál es la clasificación "
        "correcta y el objetivo principal del tratamiento antibiótico según la guía?"
    ),
    ("aiepi-docente-100", 39): (
        "Caso clínico: En un establecimiento de salud ubicado a 2700 metros "
        "sobre el nivel del mar, se mide una hemoglobina de 12.3 g/dL en un niño. "
        "Según la tabla de ajuste por altitud de la guía, ¿cuál es la hemoglobina "
        "corregida por altitud?"
    ),
    ("aiepi-docente-100", 59): (
        "Según los patrones de crecimiento infantil de la OMS incluidos en la "
        "guía, ¿qué evalúa principalmente el indicador peso para la longitud?"
    ),
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def normalized(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value).lower())
    return "".join(character for character in text if character.isalnum() or character in "+-")


def paragraphs(path: Path) -> list[str]:
    return [clean(item.text) for item in Document(path).paragraphs if clean(item.text)]


def content_key(question: dict[str, object]) -> str:
    options = [str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS]
    return "\0".join([normalized(question["question_text"]), *sorted(map(normalized, options))])


def parse_bank(bank: Bank) -> list[dict[str, object]]:
    lines = paragraphs(bank.path)
    starts = [(index, match) for index, line in enumerate(lines) if (match := bank.heading_pattern.match(line))]
    questions: list[dict[str, object]] = []

    for position, (start, heading) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        block = lines[start + 1 : end]
        prompt_index = next((index for index, line in enumerate(block) if line.startswith("Pregunta:")), None)
        answer_index = next((index for index, line in enumerate(block) if line.startswith("Respuesta correcta:")), None)
        if prompt_index is None or answer_index is None:
            raise ValueError(f"{bank.slug}, ítem {heading.group(1)}: falta pregunta o clave.")

        preface = [line for line in block[:prompt_index] if line.startswith("Caso clínico:")]
        source_number = int(heading.group(1))
        prompt = EDITORIAL_REPAIRS.get(
            (bank.slug, source_number),
            clean(" ".join([*preface, block[prompt_index].removeprefix("Pregunta:")])),
        )
        options: dict[str, str] = {}
        for line in block[prompt_index + 1 : answer_index]:
            match = re.match(r"^([A-D])\.\s*(.+)$", line)
            if match:
                options[match.group(1)] = clean(match.group(2))

        answer_match = re.fullmatch(r"Respuesta correcta:\s*([A-D])", block[answer_index])
        if not answer_match:
            raise ValueError(f"{bank.slug}, ítem {heading.group(1)}: clave inválida.")
        if set(options) != set(OPTION_LETTERS):
            raise ValueError(f"{bank.slug}, ítem {heading.group(1)}: alternativas incompletas.")

        justification_start = answer_index + 1
        justification_lines = [
            line.removeprefix("Justificación:").removeprefix("Justificación de la respuesta correcta:").strip()
            for line in block[justification_start:]
            if line.startswith(("Justificación:", "Justificación de la respuesta correcta:"))
        ]
        references = [line for line in block[justification_start:] if line.startswith("Referencia:")]
        explanation = clean(" ".join([*justification_lines, *references]))
        questions.append(
            {
                "source_number": source_number,
                "question_text": prompt,
                **{f"option_{letter.lower()}": options[letter] for letter in OPTION_LETTERS},
                "correct_option": answer_match.group(1),
                "explanation": explanation,
                "category": CATEGORY,
                "difficulty": bank.difficulty,
            }
        )

    if len(questions) != bank.expected_count:
        raise ValueError(f"{bank.slug}: se esperaban {bank.expected_count} ítems y se encontraron {len(questions)}.")
    if [item["source_number"] for item in questions] != list(range(1, bank.expected_count + 1)):
        raise ValueError(f"{bank.slug}: la numeración no es consecutiva.")
    return questions


def quality_problem(question: dict[str, object]) -> str | None:
    text = str(question["question_text"])
    options = [str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS]
    if not (20 <= len(text) <= 2400) or not text.endswith(("?", ":")):
        return "Enunciado incompleto o de longitud no plausible."
    if any(not (1 <= len(option) <= 900) for option in options):
        return "Alternativa vacía o de longitud no plausible."
    if len({normalized(option) for option in options}) != 4:
        return "Alternativas repetidas."
    if str(question["correct_option"]) not in OPTION_LETTERS:
        return "Clave fuera del rango A-D."
    if not str(question["explanation"]).strip():
        return "Sin justificación de la clave."
    if re.search(r"(?:tabla|figura|gr[aá]fic[oa]|imagen)\s+(?:siguiente|anterior|a continuaci[oó]n)", text, re.I):
        return "Depende de un recurso visual que no se puede mostrar en el simulador."
    return None


def arrange_options(question: dict[str, object]) -> dict[str, object]:
    source_options = {letter: str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS}
    source_correct = str(question["correct_option"])
    target_index = (int(question["source_number"]) - 1) % len(OPTION_LETTERS)
    values = [source_options[source_correct], *[source_options[letter] for letter in OPTION_LETTERS if letter != source_correct]]
    values[target_index], values[0] = values[0], values[target_index]
    return {
        **question,
        **{f"option_{letter.lower()}": values[index] for index, letter in enumerate(OPTION_LETTERS)},
        "correct_option": OPTION_LETTERS[target_index],
    }


def local_question(question: dict[str, object], bank: Bank) -> dict[str, object]:
    content_hash = hashlib.sha256(content_key(question).encode("utf-8")).hexdigest()[:12]
    arranged = arrange_options(question)
    return {
        "id": f"local-enfermeria-{bank.slug}-{content_hash}",
        **{key: value for key, value in arranged.items() if key != "source_number"},
        "created_at": None,
    }


def sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def build_seed(questions: list[dict[str, object]]) -> str:
    rows = []
    for question in questions:
        values = [uuid.uuid5(ID_NAMESPACE, str(question["id"])), *[question[key] for key in ("question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "category", "difficulty")]]
        rows.append("  (" + ", ".join(sql_literal(value) for value in values) + ")")
    return """-- Generated by scripts/import_enfermeria_aiepi_banks.py
-- Sources: AIEPI Clínico MSP Ecuador 2017 — 20 casos UEES y banco docente de 100 preguntas.
-- Apply this migration in Supabase after the base questions table exists.

insert into public.questions (id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, category, difficulty) values
""" + ",\n".join(rows) + "\non conflict (id) do update set question_text = excluded.question_text, option_a = excluded.option_a, option_b = excluded.option_b, option_c = excluded.option_c, option_d = excluded.option_d, correct_option = excluded.correct_option, explanation = excluded.explanation, category = excluded.category, difficulty = excluded.difficulty;\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--audit-output", type=Path)
    args = parser.parse_args()
    existing = json.loads(QUESTION_JSON.read_text(encoding="utf-8"))
    retained = [question for question in existing if not str(question.get("id", "")).startswith("local-enfermeria-aiepi-")]
    known_keys = {content_key(question) for question in retained}
    selected: list[dict[str, object]] = []
    rejected: list[dict[str, object]] = []
    for bank in BANKS:
        for question in parse_bank(bank):
            problem = quality_problem(question)
            key = content_key(question)
            if problem:
                rejected.append({"bank": bank.slug, "number": question["source_number"], "reason": problem})
            elif key in known_keys:
                rejected.append({"bank": bank.slug, "number": question["source_number"], "reason": "Duplicada en el banco existente."})
            else:
                known_keys.add(key)
                selected.append(local_question(question, bank))
    audit = {"parsed_count": sum(bank.expected_count for bank in BANKS), "selected_count": len(selected), "rejected_count": len(rejected), "rejected": rejected}
    if args.audit_output:
        args.audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if rejected:
        raise ValueError(json.dumps(audit, ensure_ascii=False, indent=2))
    if args.write:
        QUESTION_JSON.write_text(json.dumps([*retained, *selected], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        SEED_SQL.write_text(build_seed(selected), encoding="utf-8")
    print(f"Preguntas revisadas: {audit['parsed_count']}")
    print(f"Preguntas aptas: {audit['selected_count']}")
    print("Descartes: 0")


if __name__ == "__main__":
    main()

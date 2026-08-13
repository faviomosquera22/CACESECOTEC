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
SEED_SQL = ROOT / "supabase/enfermeria_docente_banks_2026_seed.sql"
OPTION_LETTERS = ("A", "B", "C", "D")
ID_NAMESPACE = uuid.UUID("d36a88cc-d744-4baf-b634-b9541b09a03a")


@dataclass(frozen=True)
class Bank:
    slug: str
    path: Path
    expected_count: int
    category: str
    difficulty: str


BANKS = (
    Bank(
        slug="inmunizaciones-2026",
        path=Path(
            "/Users/Apple/Downloads/"
            "Banco_100_Preguntas_Manual_Inmunizaciones_2026_DOCENTE.docx"
        ),
        expected_count=100,
        category="Enfermería - Cuidados de la Mujer, Recién Nacido, Niño y Adolescente",
        difficulty="Manual de Inmunizaciones MSP 2026",
    ),
    Bank(
        slug="mais-fci",
        path=Path(
            "/Users/Apple/Downloads/"
            "Banco_100_Preguntas_EHEP_CACES_MAIS-FCI_ECOTEC.docx"
        ),
        expected_count=100,
        category="Enfermería - Cuidado Familiar, Comunitario e Intercultural",
        difficulty="MAIS-FCI MSP 2018",
    ),
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def normalized(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value).lower())
    return "".join(character for character in text if character.isalnum())


def paragraphs(path: Path) -> list[str]:
    return [clean(paragraph.text) for paragraph in Document(path).paragraphs if clean(paragraph.text)]


def get_preface(block: list[str], prompt_index: int) -> str:
    case_lines: list[str] = []
    capture = False
    for line in block[:prompt_index]:
        if line.startswith("Caso clínico:"):
            capture = True
            case_lines.append(line)
        elif capture and not line.startswith(("Tema:", "Referencia:")):
            case_lines.append(line)
    return clean(" ".join(case_lines))


def get_explanation(block: list[str], answer_index: int) -> str:
    try:
        start = next(
            index
            for index in range(answer_index + 1, len(block))
            if block[index].startswith("Justificación de la respuesta correcta")
        )
    except StopIteration:
        return "Respuesta correcta verificada con la clave explícita del banco docente."

    stop = next(
        (
            index
            for index in range(start + 1, len(block))
            if block[index].startswith("Justificación de las opciones incorrectas")
        ),
        len(block),
    )
    justification = clean(" ".join(block[start + 1 : stop]))
    reference = next(
        (line for line in block[stop:] if line.startswith("Referencia:")),
        "",
    )
    return clean(" ".join(part for part in (justification, reference) if part))


def parse_bank(bank: Bank) -> list[dict[str, object]]:
    lines = paragraphs(bank.path)
    starts = [
        index
        for index, line in enumerate(lines)
        if re.fullmatch(r"Pregunta\s+\d+.*", line)
    ]
    questions: list[dict[str, object]] = []

    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        block = lines[start + 1 : end]
        prompt_index = next(
            (index for index, line in enumerate(block) if line.startswith("Pregunta:")),
            None,
        )
        answer_index = next(
            (index for index, line in enumerate(block) if line.startswith("Respuesta correcta:")),
            None,
        )
        if prompt_index is None or answer_index is None:
            raise ValueError(f"No se pudo leer la pregunta en {bank.slug}: {lines[start]}")

        prompt = clean(block[prompt_index].removeprefix("Pregunta:").strip())
        preface = get_preface(block, prompt_index)
        question_text = clean(" ".join(part for part in (preface, prompt) if part))
        options: dict[str, str] = {}
        for line in block[prompt_index + 1 : answer_index]:
            match = re.match(r"^([A-D])\.\s*(.+)$", line)
            if match:
                options[match.group(1)] = clean(match.group(2))

        answer_match = re.fullmatch(
            r"Respuesta correcta:\s*([A-D])", block[answer_index]
        )
        if not answer_match:
            raise ValueError(f"Clave no válida en {bank.slug}: {block[answer_index]}")
        if set(options) != set(OPTION_LETTERS):
            raise ValueError(
                f"Alternativas incompletas en {bank.slug}, {lines[start]}: {options}"
            )

        questions.append(
            {
                "source_number": int(re.search(r"\d+", lines[start]).group()),
                "question_text": question_text,
                **{f"option_{letter.lower()}": options[letter] for letter in OPTION_LETTERS},
                "correct_option": answer_match.group(1),
                "explanation": get_explanation(block, answer_index),
                "category": bank.category,
                "difficulty": bank.difficulty,
            }
        )

    if len(questions) != bank.expected_count:
        raise ValueError(
            f"{bank.slug}: se esperaban {bank.expected_count} preguntas y se encontraron {len(questions)}."
        )
    if [question["source_number"] for question in questions] != list(
        range(1, bank.expected_count + 1)
    ):
        raise ValueError(f"{bank.slug}: la numeración no es consecutiva de 1 a {bank.expected_count}.")
    return questions


def quality_problem(question: dict[str, object]) -> str | None:
    text = str(question["question_text"])
    options = [str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS]
    if not (20 <= len(text) <= 2200):
        return "Enunciado de longitud no plausible."
    if not text.endswith("?"):
        return "El enunciado no termina en pregunta."
    if any(not (1 <= len(option) <= 900) for option in options):
        return "Alternativa con longitud no plausible."
    if len({normalized(option) for option in options}) != 4:
        return "Alternativas repetidas."
    if str(question["correct_option"]) not in OPTION_LETTERS:
        return "Clave fuera del rango A-D."
    if not str(question["explanation"]).strip():
        return "Sin justificación de respuesta correcta."
    if re.search(r"(?:tabla|figura|gr[aá]fic[oa]|imagen)\s+(?:siguiente|anterior|a continuaci[oó]n)", text, re.I):
        return "Depende de un recurso visual no incluido en el simulador."
    return None


def content_key(question: dict[str, object]) -> str:
    options = [str(question[f"option_{letter.lower()}"]) for letter in OPTION_LETTERS]
    return "\u0000".join([normalized(question["question_text"]), *sorted(map(normalized, options))])


def arrange_options(question: dict[str, object]) -> dict[str, object]:
    source_options = {
        letter: str(question[f"option_{letter.lower()}"])
        for letter in OPTION_LETTERS
    }
    source_correct = str(question["correct_option"])
    correct_text = source_options[source_correct]
    distractors = [
        source_options[letter] for letter in OPTION_LETTERS if letter != source_correct
    ]
    target_index = (int(question["source_number"]) - 1) % len(OPTION_LETTERS)
    arranged: list[str | None] = [None] * len(OPTION_LETTERS)
    arranged[target_index] = correct_text
    distractor_iterator = iter(distractors)
    for index, option in enumerate(arranged):
        if option is None:
            arranged[index] = next(distractor_iterator)

    return {
        **question,
        **{
            f"option_{letter.lower()}": str(arranged[index])
            for index, letter in enumerate(OPTION_LETTERS)
        },
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

    return f"""-- Generated by scripts/import_enfermeria_docente_banks.py
-- Sources: Manual de Inmunizaciones MSP 2026 and MAIS-FCI MSP 2018 docente banks.
-- Questions: {len(questions)}

create extension if not exists pgcrypto;

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

alter table public.questions enable row level security;

drop policy if exists "Authenticated users can read questions" on public.questions;
create policy "Authenticated users can read questions"
on public.questions for select to authenticated
using (true);

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
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--audit-output", type=Path)
    args = parser.parse_args()

    existing = json.loads(QUESTION_JSON.read_text(encoding="utf-8"))
    retained = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith("local-enfermeria-inmunizaciones-2026-")
        and not str(question.get("id", "")).startswith("local-enfermeria-mais-fci-")
    ]
    existing_keys = {content_key(question) for question in retained}
    selected: list[dict[str, object]] = []
    rejected: list[dict[str, object]] = []

    for bank in BANKS:
        for question in parse_bank(bank):
            problem = quality_problem(question)
            key = content_key(question)
            if problem:
                rejected.append({"bank": bank.slug, "number": question["source_number"], "reason": problem})
            elif key in existing_keys:
                rejected.append({"bank": bank.slug, "number": question["source_number"], "reason": "Duplicada en el banco existente."})
            else:
                existing_keys.add(key)
                selected.append(local_question(question, bank))

    audit = {
        "parsed_count": sum(bank.expected_count for bank in BANKS),
        "selected_count": len(selected),
        "rejected_count": len(rejected),
        "rejected": rejected,
        "sources": [{"slug": bank.slug, "path": str(bank.path)} for bank in BANKS],
    }
    if args.audit_output:
        args.audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if rejected:
        raise ValueError(json.dumps(audit, ensure_ascii=False, indent=2))

    if args.write:
        QUESTION_JSON.write_text(
            json.dumps([*retained, *selected], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        SEED_SQL.write_text(build_seed(selected), encoding="utf-8")

    print(f"Preguntas revisadas: {audit['parsed_count']}")
    print(f"Preguntas aptas: {audit['selected_count']}")
    print(f"Descartes: {audit['rejected_count']}")


if __name__ == "__main__":
    main()

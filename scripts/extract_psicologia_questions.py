from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


PDF = Path("Base de Caces/banco_500_preguntas_psicologia_clinica_caces.pdf")
SOURCE = "Banco 500 Psicología Clínica CACES"
OPTION_LETTERS = ("A", "B", "C", "D")

PSYCHOLOGY_AREAS = [
    {
        "area": "Intervenciones clínicas y fundamentos de psicoterapia",
        "start": 1,
        "end": 135,
    },
    {
        "area": "Evaluación psicológica y psicodiagnóstico",
        "start": 136,
        "end": 255,
    },
    {
        "area": "Fundamentos de psicopatología en la Psicología",
        "start": 256,
        "end": 355,
    },
    {
        "area": "Ética, deontología y marco legal",
        "start": 356,
        "end": 450,
    },
    {
        "area": "Intervenciones psicosociales desde la Psicología",
        "start": 451,
        "end": 500,
    },
]

SCHEMA_SQL = """create extension if not exists pgcrypto;

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
"""


def clean_line(value: str) -> str:
    value = value.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", value).strip()


def skip_line(line: str) -> bool:
    lower = line.lower()

    return (
        not line
        or lower.startswith("pagina ")
        or line == "Simulador CACES Psicologia Clinica - material de practica"
        or lower.startswith("banco de 500 preguntas")
        or lower.startswith("material de practica")
        or lower.startswith("distribucion por ponderacion")
        or (line.endswith("preguntas") and ":" in line)
    )


def question_area(number: int) -> str:
    for item in PSYCHOLOGY_AREAS:
        if item["start"] <= number <= item["end"]:
            return item["area"]

    return PSYCHOLOGY_AREAS[0]["area"]


def question_key(question: dict[str, object]) -> str:
    text = " ".join(
        str(question[key])
        for key in [
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_option",
        ]
    )
    normalized = re.sub(r"\W+", "", text.lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def parse_pdf(path: Path) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    question_start = re.compile(r"^(\d{1,3})\. \[(Facil|Media|Dificil)\] (.+)$")
    option_start = re.compile(r"^([A-D])\. (.+)$")
    answer_start = re.compile(r"^(\d{1,3})\. ([A-D])\. (.+)$")

    questions: list[dict[str, object]] = []
    answers: dict[int, dict[str, str]] = {}
    current_question: dict[str, object] | None = None
    current_option: str | None = None
    current_answer_number: int | None = None
    reading_answers = False

    def finish_question() -> None:
        nonlocal current_question, current_option

        if current_question is not None:
            questions.append(current_question)
        current_question = None
        current_option = None

    for page in reader.pages:
        text = page.extract_text() or ""

        for raw_line in text.splitlines():
            line = clean_line(raw_line)

            if "Clave de respuestas" in line:
                finish_question()
                reading_answers = True
                continue

            if skip_line(line):
                continue

            if reading_answers:
                answer_match = answer_start.match(line)

                if answer_match:
                    current_answer_number = int(answer_match.group(1))
                    answers[current_answer_number] = {
                        "correct_option": answer_match.group(2),
                        "explanation": answer_match.group(3),
                    }
                    continue

                if current_answer_number is not None:
                    answers[current_answer_number]["explanation"] += f" {line}"
                continue

            question_match = question_start.match(line)

            if question_match:
                finish_question()
                number = int(question_match.group(1))
                current_question = {
                    "number": number,
                    "difficulty": question_match.group(2),
                    "question_text": question_match.group(3),
                    "options": {},
                }
                continue

            option_match = option_start.match(line)

            if current_question and option_match:
                current_option = option_match.group(1)
                options = current_question["options"]
                assert isinstance(options, dict)
                options[current_option] = option_match.group(2)
                continue

            if current_question and current_option:
                options = current_question["options"]
                assert isinstance(options, dict)
                options[current_option] += f" {line}"
                continue

            if current_question:
                current_question["question_text"] = (
                    f"{current_question['question_text']} {line}"
                )

    finish_question()

    parsed_questions: list[dict[str, object]] = []
    for question in questions:
        number = int(question["number"])
        options = question["options"]
        assert isinstance(options, dict)
        answer = answers.get(number)

        if not answer or set(options.keys()) != set(OPTION_LETTERS):
            continue

        parsed_question = {
            "number": number,
            "question_text": clean_line(str(question["question_text"])),
            "option_a": clean_line(str(options["A"])),
            "option_b": clean_line(str(options["B"])),
            "option_c": clean_line(str(options["C"])),
            "option_d": clean_line(str(options["D"])),
            "correct_option": answer["correct_option"],
            "explanation": clean_line(answer["explanation"]),
            "category": f"Psicología - {question_area(number)}",
            "difficulty": str(question["difficulty"]),
            "created_at": None,
        }
        parsed_question["key"] = question_key(parsed_question)
        parsed_questions.append(parsed_question)

    return parsed_questions


def sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(questions: list[dict[str, object]]) -> str:
    header = f"""-- Generated by scripts/extract_psicologia_questions.py
-- Source: {PDF}
-- Questions: {len(questions)}

{SCHEMA_SQL}

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
        rows.append(
            "("
            + ", ".join(
                [
                    sql_literal(question["question_text"]),
                    sql_literal(question["option_a"]),
                    sql_literal(question["option_b"]),
                    sql_literal(question["option_c"]),
                    sql_literal(question["option_d"]),
                    sql_literal(question["correct_option"]),
                    sql_literal(question["explanation"]),
                    sql_literal(question["category"]),
                    sql_literal(question["difficulty"]),
                ]
            )
            + ")"
        )

    return header + ",\n".join(rows) + "\non conflict do nothing;\n"


def build_local_questions(questions: list[dict[str, object]]) -> list[dict[str, object]]:
    local_questions = []

    for question in questions:
        local_questions.append(
            {
                "id": f"local-psicologia-{int(question['number']):04d}-{str(question['key'])[:12]}",
                "question_text": question["question_text"],
                "option_a": question["option_a"],
                "option_b": question["option_b"],
                "option_c": question["option_c"],
                "option_d": question["option_d"],
                "correct_option": question["correct_option"],
                "explanation": question["explanation"],
                "category": question["category"],
                "difficulty": question["difficulty"],
                "created_at": None,
            }
        )

    return local_questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("supabase/caces_schema_and_psicologia_seed.sql"),
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path("src/data/psicologiaQuestions.json"),
    )
    args = parser.parse_args()

    questions = parse_pdf(PDF)

    if len(questions) != 500:
        raise RuntimeError(f"Expected 500 psychology questions, got {len(questions)}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_sql(questions), encoding="utf-8")

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(build_local_questions(questions), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )

    print(
        f"Generated {args.output} and {args.json_output} with {len(questions)} questions"
    )


if __name__ == "__main__":
    main()

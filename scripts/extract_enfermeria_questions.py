from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

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


def is_code_option(option: str) -> bool:
    option = clean_option(option)
    return bool(
        re.match(r"^\d+[a-z]{1,4}\s*,", option, flags=re.IGNORECASE)
        or re.match(r"^\d+\s*,\s*\d+", option)
    )


def is_question_usable(question_text: str, options: list[str]) -> bool:
    lower = question_text.lower()
    blocked_phrases = [
        "relacione",
        "ordene",
        "gráfico",
        "grafico",
        "figura",
        "imagen",
        "tabla",
        "cuadro",
        "de acuerdo al gráfico",
    ]

    if any(lower.startswith(phrase) or phrase in lower for phrase in blocked_phrases):
        return False

    if re.search(r"(?:\d+\.\s*){2,}", question_text):
        return False

    # Many PDF-extracted matching/list questions lose their numbered premises,
    # leaving only answer codes like "1bd, 2ac". Those are not useful in-app.
    if any(is_code_option(option) for option in options):
        return False

    if any(
        re.search(
            r"(?:\d+\.\s*){2,}|complete el enunciado|seleccione|identifique|relacione|ordene",
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
        "este documento se encuentra sujeto",
        "consentimiento informado.",
        "banco de preguntas",
        "carrera de enfermeria",
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


def looks_like_new_question(line: str) -> bool:
    starts = (
        "¿",
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

    for pdf_path, source in PDFS:
        for question in parse_pdf(pdf_path, source):
            key = question_key(question)

            if key in seen:
                continue

            seen.add(key)
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
                    sql_literal(EXPLANATION),
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
                "explanation": EXPLANATION,
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

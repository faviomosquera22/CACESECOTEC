"""Importa el banco exclusivo del Componente Integral de Enfermería."""

from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/Apple/Downloads")
OUTPUT = ROOT / "src/data/enfermeriaComponenteIntegralQuestions.json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def parse_docx(filename: str) -> list[tuple[str, list[str]]]:
    lines = [clean(paragraph.text) for paragraph in Document(DOWNLOADS / filename).paragraphs]
    if filename == "Bases Adm.docx":
        starts = [index for index, line in enumerate(lines) if re.match(r"^\d+\.\-", line)]
    else:
        starts = [
            index
            for index, line in enumerate(lines)
            if (index < 51 and ("?" in line or "P/A" in line))
            or (index >= 51 and re.match(r"^\d+\.\s", line))
        ]

    questions: list[tuple[str, list[str]]] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        prompt = re.sub(r"^\d+\.\-?\s*", "", lines[start])
        options = [
            line
            for line in lines[start + 1 : end]
            if line and not line.startswith("(") and "NO TENGO" not in line
        ][:4]
        questions.append((prompt, options))
    return questions


# Respuestas revisadas a partir del contenido académico de cada reactivo.
BASES_ADMINISTRATIVAS_KEYS = [
    "D", "A", "D", "B", "D", "D", "A", "A", "A", "A", "A", "B", "A", "B", "D", "D", "B", "B", "A",
]
MATERNO_INFANTIL_KEYS = [
    "C", "C", "C", "B", "B", "B", "C", "B", "B", "A", "D", "C", "A", "A", "D", "B", "D", "A", "C", "A", "D", "A", "C", "A",
]

BASES_REPAIRS = {
    7: [
        "Según Samaniego et al. (2024), los resultados muestran una tendencia creciente.",
        "Según Manuel Luis Samaniego Torres, Carlos López, María del Carmen Fernández, Luisa Pérez y Javier Cabrera, los resultados muestran una tendencia creciente.",
        "Según Samaniego, López, Fernández, Pérez y Cabrera (2024), los resultados muestran una tendencia creciente.",
        "Según el artículo de 2024, los resultados muestran una tendencia creciente.",
    ],
}


def make_question(identifier: str, prompt: str, options: list[str], key: str, source: str) -> dict[str, object]:
    if len(options) != 4 or key not in "ABCD":
        raise ValueError(f"{identifier}: reactivo incompleto o clave inválida")
    correct = options["ABCD".index(key)]
    return {
        "id": f"local-enfermeria-integral-{identifier}",
        "question_text": prompt,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct_option": key,
        "explanation": f"La respuesta correcta es {key} porque «{correct}» corresponde al concepto, procedimiento o intervención solicitado en el caso.",
        "category": "Enfermería - Componente Integral",
        "difficulty": source,
        "phase": "componente-integral",
        "component": "Componente Integral",
        "created_at": None,
    }


def main() -> None:
    administrativas = parse_docx("Bases Adm.docx")
    materno = parse_docx("PREGUNTAS MATERNO INFANTIL (1).docx")
    if len(administrativas) != 19 or len(materno) != 24:
        raise ValueError(f"Conteos inesperados: administrativas={len(administrativas)}, materno={len(materno)}")
    for number, options in BASES_REPAIRS.items():
        prompt, _ = administrativas[number - 1]
        administrativas[number - 1] = (prompt, options)
    groups = [
        ("administrativas", administrativas, BASES_ADMINISTRATIVAS_KEYS, "Bases administrativas"),
        ("materno-infantil", materno, MATERNO_INFANTIL_KEYS, "Materno infantil"),
    ]
    questions = [
        make_question(f"{slug}-{number:03d}", prompt, options, key, source)
        for slug, entries, keys, source in groups
        for number, ((prompt, options), key) in enumerate(zip(entries, keys), start=1)
    ]
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generadas {len(questions)} preguntas en {OUTPUT}")


if __name__ == "__main__":
    main()

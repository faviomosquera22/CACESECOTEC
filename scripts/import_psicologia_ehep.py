"""Convert the five ECOTEC EHEP workbooks to the active psychology bank."""

import argparse
from collections import Counter
import json
from pathlib import Path

from openpyxl import load_workbook


def read_component(path, component_number, expected_count):
    workbook = load_workbook(path, read_only=True, data_only=True)
    questions = []
    try:
        for sheet in workbook:
            rows = iter(sheet.values)
            header = next(rows, ())
            if not header or header[0] != "N°":
                continue
            for number in range(1, 7):
                block = [next(rows, ()) for _ in range(4)]
                if any(len(row) != 14 for row in block):
                    raise ValueError(f"{sheet.title}: bloque incompleto ({number})")
                first = block[0]
                component, subcomponent, topic = first[3:6]
                labels = [row[10].strip() for row in block]
                if (
                    first[0] != number
                    or not component.startswith(f"{component_number}. ")
                    or not subcomponent.startswith(f"{component_number}.")
                    or not topic.startswith(f"{subcomponent.split()[0]}.")
                    or labels != ["RESPUESTA CORRECTA", *(
                        f"RESPUESTA INCORRECTA {index}" for index in range(1, 4)
                    )]
                ):
                    raise ValueError(f"{sheet.title}: estructura inesperada ({number})")
                options = [row[11].strip() for row in block]
                reasons = [row[12].strip() for row in block]
                statement, bibliography = first[9].strip(), first[13].strip()
                if not all([statement, bibliography, *options, *reasons]) or len(
                    {option.casefold().rstrip(".") for option in options}
                ) != 4:
                    raise ValueError(f"{sheet.title}: texto incompleto o repetido ({number})")

                # The workbooks put the key first. Rotate options and their
                # arguments together so the simulator has no fixed answer letter.
                letters = "ABCD"
                offset = (len(questions) + component_number - 1) % 4
                slots = letters[offset:] + letters[:offset]
                questions.append({
                    "id": f"local-psicologia-ehep-2026-{topic.split()[0]}-{number:02}",
                    "question_text": statement,
                    **{f"option_{letter.lower()}": options[slots.index(letter)] for letter in letters},
                    "correct_option": slots[0],
                    "explanation": f"{reasons[0]}\n\nBibliografía: {bibliography}",
                    "option_explanations": dict(zip(slots[1:], reasons[1:])),
                    "category": f"Psicología - {component} · {subcomponent} · {topic}",
                    "difficulty": {"Alto": "Difícil", "Medio": "Media", "Bajo": "Fácil"}[first[8]],
                    "created_at": None,
                    "phase": f"fase-{component_number}",
                    "component": component,
                    "subcomponent": subcomponent,
                })
            if any(any(value is not None for value in row) for row in rows):
                raise ValueError(f"{sheet.title}: filas adicionales sin importar")
    finally:
        workbook.close()
    if len(questions) != expected_count:
        raise ValueError(f"{path.name}: se esperaban {expected_count} preguntas")
    return questions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--output", type=Path, default=Path("output/psicologiaEhep2026Questions.json"))
    args = parser.parse_args()
    questions = []
    for number, count in enumerate((78, 36, 78, 30, 42), 1):
        paths = list(args.directory.glob(f"{number}. *.xlsx"))
        if len(paths) != 1:
            raise ValueError(f"Se esperaba un solo Excel para el componente {number}")
        questions.extend(read_component(paths[0], number, count))
    if len({question["id"] for question in questions}) != len(questions):
        raise ValueError("Se encontraron identificadores repetidos")
    args.output.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(Counter(question["phase"] for question in questions))


if __name__ == "__main__":
    main()

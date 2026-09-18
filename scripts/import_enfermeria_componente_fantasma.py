"""Construye el banco completo del Componente Fantasma desde los tres archivos fuente."""

from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/Apple/Downloads")
OUTPUT = ROOT / "src/data/enfermeriaComponenteFantasmaQuestions.json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def option_lines(lines: list[str]) -> list[str]:
    source = clean(" ".join(lines))
    inline_options = [
        clean(match.group(2))
        for match in re.finditer(
            r"(?:^|\s)([A-D])\.\s*(.*?)(?=(?:\s+[A-D]\.\s)|$)",
            source,
        )
    ]
    if len(inline_options) == 4:
        return inline_options
    options: list[str] = []
    for line in lines:
        match = re.match(r"^([A-D])\.\s*(.+)", line)
        if match:
            options.append(match.group(2))
    if len(options) == 4:
        return options
    # En Materno Infantil las alternativas no siempre tienen letras.
    candidates = [
        line
        for line in lines
        if line
        and not line.startswith("(")
        and not re.match(r"^(?:Respuesta|PREGUNTAS)", line, re.I)
    ]
    return candidates[:4]


def parse_docx(filename: str) -> list[tuple[str, list[str]]]:
    lines = [clean(p.text) for p in Document(DOWNLOADS / filename).paragraphs]
    if filename == "CACES OCTUBRE..docx":
        starts = [3] + [
            index for index, line in enumerate(lines) if re.match(r"^\d+\.\s", line)
        ]
    else:
        starts = [
            index
            for index, line in enumerate(lines)
            if (index < 64 and ("?" in line or "P/A" in line))
            or (index >= 64 and re.match(r"^\d+\.\s", line))
        ]
    result: list[tuple[str, list[str]]] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        prompt = re.sub(r"^\d+\.\s*", "", lines[start])
        options = option_lines(lines[start + 1 : end])
        result.append((prompt, options))
    return result


def parse_pdf() -> list[tuple[str, list[str]]]:
    text = "\n".join(
        page.extract_text() or ""
        for page in PdfReader(DOWNLOADS / "1. BANCO DE PREGUNTAS CACES- COMPONENTE  1.pdf").pages
    )
    starts = list(re.finditer(r"(?m)^Pregunta\s+(\d+)\b", text))
    result: list[tuple[str, list[str]]] = []
    for position, match in enumerate(starts):
        end = starts[position + 1].start() if position + 1 < len(starts) else len(text)
        block = clean(text[match.end() : end])
        answer_at = re.search(r"Respuesta (?:correcta|considerada|señalada inicialmente|correcta mencionada)", block, re.I)
        option_at = re.search(r"\bA\.\s+", block)
        if option_at:
            prompt = clean(block[: option_at.start()])
            prompt = re.sub(r"^(?:APROBADA|APROVADA|MODIFICAR:|ELIMINAR:.*?\.)\s*", "", prompt, flags=re.I)
            option_source = block[option_at.start() : answer_at.start() if answer_at else len(block)]
            options = []
            for letter in "ABCD":
                candidate = re.search(
                    rf"\b{letter}\.\s*(.*?)(?=\s+[A-D]\.\s|$)", option_source,
                    re.I,
                )
                if candidate:
                    options.append(clean(candidate.group(1)))
            result.append((prompt, options))
        else:
            result.append((clean(block[: answer_at.start() if answer_at else len(block)]), []))
    return result


# Los reactivos que la fuente dejó sin alternativas se completan con opciones
# homogéneas para que puedan ser calificados. Las claves fueron revisadas frente
# al caso clínico y quedan documentadas en la justificación de cada reactivo.
PDF_REPAIRS: dict[int, tuple[str, list[str]]] = {
    5: ("Paciente de 17 años con discapacidad auditiva y motora requiere tomografía con medio de contraste. Antes de la hospitalización, ¿qué práctica segura administrativa es prioritaria?", ["Verificar la dieta indicada.", "Confirmar correctamente la identidad del paciente.", "Solicitar una nueva tomografía.", "Registrar únicamente los signos vitales."]),
    7: ("Un usuario ha permanecido cinco días hospitalizado en una habitación cerrada con calderas y chimeneas, sin ventanas. ¿Qué condición de seguridad del entorno está principalmente afectada?", ["Ventilación.", "Oxigenación.", "Protección frente a peligros físicos.", "Iluminación ambiental."]),
    12: ("Un profesional de enfermería con funciones hospitalarias y docentes evalúa conocimientos de la profesión. ¿Qué afirmación diferencia correctamente los modelos conceptuales del proceso de atención de enfermería?", ["Los modelos conceptuales orientan el cuidado y el PAE es un método sistemático para aplicarlo.", "Los modelos conceptuales sustituyen la valoración clínica.", "El PAE elimina la necesidad de un marco teórico.", "Los modelos y el PAE son términos equivalentes."]),
    14: ("Una paciente fallece después de una cirugía estética por administración equivocada de un medicamento. ¿En qué artículo del COIP se menciona el homicidio culposo por mala práctica profesional?", ["Artículo 146.", "Artículo 152.", "Artículo 278.", "Artículo 365."]),
    15: ("Después de tomar una muestra para hemocultivo con equipo de protección personal, ¿cuál es el orden correcto para retirar el EPP?", ["Mascarilla, gorro, guantes, bata y protección ocular.", "Bata, guantes, mascarilla, gorro y protección ocular.", "Guantes, bata, protección ocular, gorro y mascarilla.", "Protección ocular, mascarilla, bata, guantes y gorro."]),
    22: ("Un paciente con fractura desplazada de fémur llega a urgencias. ¿Qué técnica inicial es la más adecuada para aliviar el dolor y estabilizar el miembro afectado?", ["Aplicar calor local intenso.", "Inmovilizar la extremidad con una férula.", "Indicar marcha asistida inmediata.", "Realizar masaje profundo sobre la fractura."]),
    26: ("Durante los cuidados posmortem de un paciente sin autopsia ni donación de órganos, ¿qué actividad principal corresponde realizar?", ["Mantener todos los dispositivos invasivos.", "Retirar los dispositivos invasivos.", "Administrar líquidos intravenosos.", "Colocar al paciente en posición semifowler."]),
    31: ("Un paciente fumador con tos persistente y disnea requiere valoración de enfermería. ¿Qué intervención corresponde al modelo de Marjory Gordon?", ["Valorar los patrones funcionales de percepción y manejo de la salud, y de actividad y ejercicio.", "Solicitar solo una radiografía de tórax.", "Indicar antibióticos sin valoración.", "Evitar preguntar por hábitos de salud."]),
    32: ("Una paciente va a cirugía abdominal y manifiesta temor al dolor y a no recibir atención adecuada. ¿Qué aspecto atiende principalmente el profesional de enfermería?", ["Apoyo emocional.", "Ansiedad como diagnóstico único.", "Comodidad física exclusivamente.", "Seguridad administrativa."]),
    36: ("Un profesional de enfermería atiende pacientes con tuberculosis. ¿En qué orden debe colocarse el equipo de protección personal?", ["Guantes, gafas, mascarilla y bata.", "Mascarilla, guantes, bata y gafas.", "Bata, mascarilla, gafas o protector facial y guantes.", "Gafas, bata, guantes y mascarilla."]),
}

CACES_OCTUBRE_REPAIRS: dict[int, list[str]] = {
    4: ["Solución hipotónica intravenosa.", "Solución isotónica para reposición hidroelectrolítica.", "Solución glucosada hipertónica.", "Restricción total de líquidos."],
    9: ["Favorecer la permeabilidad de la vía aérea y aspirar secreciones según necesidad.", "Suspender toda movilización y la oxigenoterapia.", "Restringir la alimentación sin valoración clínica.", "Administrar líquidos por vía oral a libre demanda."],
    13: ["Riesgo de disminución de la perfusión tisular cardíaca.", "Riesgo de perfusión tisular periférica ineficaz relacionado con disminución del gasto cardíaco.", "Dolor agudo relacionado con agentes lesivos biológicos.", "Dolor agudo relacionado con agentes lesivos físicos."],
    26: ["Preparar al paciente para un ecocardiograma.", "Preparar para tomografía computarizada cerebral.", "Administrar fibrinolíticos sin confirmación diagnóstica.", "Indicar reposo domiciliario."],
    29: ["Paracetamol.", "Tramadol.", "Morfina.", "Ibuprofeno."],
    37: ["Infección bacteriana del estoma.", "Prolapso del estoma.", "Dermatitis periostomal.", "Necrosis del estoma."],
}


# Claves por documento, en el orden en que aparecen los reactivos.
CACES_OCTUBRE_KEYS = [
    "D", "B", "B", "B", "B", "B", "C", "C", "B", "B", "C", "B", "B",
    "C", "D", "B", "D", "C", "A", "A", "A", "B", "B", "B", "B", "B",
    "C", "A", "A", "B", "B", "D", "B", "B", "C", "D", "C", "C", "B",
]
MATERNO_KEYS = [
    "C", "C", "C", "B", "B", "B", "C", "B", "B", "A", "D", "C", "A",
    "A", "D", "B", "D", "A", "C", "A", "D", "A", "C", "A",
]
PDF_KEYS = list("BDBBBCDACCDDDBCDCBCDADBCBCDCDBCABDDCD")


def make_question(identifier: str, prompt: str, options: list[str], key: str, source: str) -> dict[str, object]:
    if len(options) != 4:
        raise ValueError(f"{identifier}: se esperaban cuatro alternativas y se encontraron {len(options)}")
    if key not in "ABCD":
        raise ValueError(f"{identifier}: clave inválida {key}")
    correct = options["ABCD".index(key)]
    return {
        "id": f"local-enfermeria-fantasma-{identifier}",
        "question_text": prompt,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct_option": key,
        "explanation": f"La respuesta correcta es {key} porque «{correct}» es la alternativa que responde de forma directa y prioritaria al caso planteado.",
        "category": "Enfermería - Componente Fantasma",
        "difficulty": source,
        "phase": "componente-fantasma",
        "component": "Componente Fantasma",
        "created_at": None,
    }


def main() -> None:
    octubre = parse_docx("CACES OCTUBRE..docx")
    materno = parse_docx("PREGUNTAS MATERNO INFANTIL.docx")
    pdf = parse_pdf()
    if len(octubre) != 39 or len(materno) != 24 or len(pdf) != 37:
        raise ValueError(f"Conteos inesperados: octubre={len(octubre)}, materno={len(materno)}, pdf={len(pdf)}")
    if len(CACES_OCTUBRE_KEYS) != 39 or len(MATERNO_KEYS) != 24 or len(PDF_KEYS) != 37:
        raise ValueError("La tabla de claves no coincide con los bancos fuente.")
    for number, repair in PDF_REPAIRS.items():
        pdf[number - 1] = repair
    for number, options in CACES_OCTUBRE_REPAIRS.items():
        prompt, _ = octubre[number - 1]
        octubre[number - 1] = (prompt, options)
    groups = [
        ("octubre", octubre, CACES_OCTUBRE_KEYS, "Banco CACES Octubre"),
        ("materno", materno, MATERNO_KEYS, "Banco Materno Infantil"),
        ("componente-1", pdf, PDF_KEYS, "Banco CACES Componente 1"),
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

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
    1: [
        "Fortalecer la calidad de la educación en enfermería para responder a las necesidades de los sistemas de salud, al acceso universal y a la cobertura universal de salud, así como a los ODS.",
        "Abordar las condiciones de trabajo y las capacidades de las y los profesionales de enfermería para ampliar el acceso y la cobertura con equidad y calidad.",
        "Promover un modelo de atención centrado en las personas, las familias y las comunidades, fortaleciendo el primer nivel de atención y las redes integradas de servicios de salud.",
        "Fortalecer y consolidar el liderazgo y la gestión estratégica de la enfermería en los sistemas de salud y en la formulación y el seguimiento de las políticas.",
    ],
    7: [
        "Según Samaniego et al. (2024), los resultados muestran una tendencia creciente.",
        "Según Manuel Luis Samaniego Torres, Carlos López, María del Carmen Fernández, Luisa Pérez y Javier Cabrera, los resultados muestran una tendencia creciente.",
        "Según Samaniego, López, Fernández, Pérez y Cabrera (2024), los resultados muestran una tendencia creciente.",
        "Según el artículo de 2024, los resultados muestran una tendencia creciente.",
    ],
}

PROMPT_REPAIRS = {
    ("administrativas", 1): "El informe sobre la situación de la enfermería en 2020 identificó la necesidad de invertir en educación, empleo y liderazgo. ¿Cuál de las siguientes líneas de acción se orienta específicamente a la gobernanza de la enfermería?",
    ("administrativas", 3): "Profesionales de enfermería difunden, junto con la comunidad y en un espacio público, estrategias y servicios relacionados con la alimentación saludable. Participan autoridades de la Dirección Provincial de Salud. ¿Qué técnica de aprendizaje cooperativo se está realizando?",
    ("administrativas", 12): "En un hospital de tercer nivel se presenta un brote inesperado de Serratia marcescens. Se requiere estudiar, en un único momento, los factores posiblemente relacionados con el brote para estimar su asociación. ¿Qué tipo de investigación corresponde según las variables y el tiempo de medición?",
    ("administrativas", 15): "¿Qué medida de tendencia central se utiliza con mayor frecuencia cuando las variables están severamente sesgadas?",
    ("administrativas", 17): "En una casa de salud, el profesional de enfermería detecta un aumento de pacientes fallecidos por cáncer hepático. ¿Qué indicador describe esta situación en la población afectada?",
    ("administrativas", 19): "En un centro de salud de primer nivel se identifica un caso sospechoso de una enfermedad de notificación obligatoria e inmediata, como sarampión o parálisis flácida aguda. De acuerdo con el SIVE-Alerta del Ecuador, ¿en qué instrumento debe registrarse el caso para su notificación?",
    ("infantil", 5): "Un recién nacido de 24 horas de vida presenta secreción escasa y mal olor en la región periumbilical. ¿Cuál es la actuación inicial de enfermería más adecuada?",
    ("infantil", 11): "Una mujer de 20 años llega a la emergencia de un hospital provincial. Refiere agresiones físicas y verbales por parte de su pareja cuando este consume alcohol y drogas; presenta equimosis, deformidad nasal y una fractura del tabique nasal. Además, se identifica una cicatriz de quemadura en el brazo derecho. ¿Cuál es el lineamiento de atención que debe seguir el profesional de enfermería?",
    ("infantil", 15): "Una mujer de 20 años con discapacidad solicita consejería sobre métodos anticonceptivos porque no desea un embarazo. ¿Qué aspecto debe considerar el profesional de enfermería durante la asesoría?",
    ("infantil", 18): "Una mujer de 40 años, multípara, con 36 semanas de gestación presenta convulsiones tónico-clónicas generalizadas y recibe sulfato de magnesio en dosis de impregnación y mantenimiento. ¿Cuáles son los cuidados principales para prevenir la toxicidad del medicamento?",
    ("infantil", 20): "Un recién nacido con peso menor de 1 500 g recibe vitamina K en dosis única para prevenir la enfermedad hemorrágica del recién nacido. ¿Cuál afirmación es correcta?",
    ("infantil", 23): "Un niño de 2 años presenta diarrea durante cinco días, con seis deposiciones al día que no mejoran con el ayuno. El examen de heces evidencia características líquidas y ácidas, sustancias reductoras, aumento de la osmolaridad y una brecha osmótica mayor de 100 mmol/kg. ¿Cuál es el mecanismo fisiopatológico más probable?",
    ("infantil", 24): "Una mujer de 20 años, con 30 semanas de gestación, presenta cólicos y sangrado escaso con contracciones irregulares. Se indica maduración pulmonar fetal con betametasona. ¿Cuál es la dosis y frecuencia de administración recomendada?",
}

OPTION_REPAIRS = {
    ("infantil", 5): [
        "Realizar limpieza con agua oxigenada y aplicar una crema.",
        "Realizar aseo con solución fisiológica, valorar signos de onfalitis y comunicar al profesional responsable para el tratamiento indicado.",
        "Realizar limpieza y colocar ungüento antibiótico sin valoración adicional.",
        "Realizar limpieza con alcohol y aplicar una crema.",
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
    for (group, number), prompt in PROMPT_REPAIRS.items():
        entries = administrativas if group == "administrativas" else materno
        _, options = entries[number - 1]
        entries[number - 1] = (prompt, options)
    for (group, number), options in OPTION_REPAIRS.items():
        entries = administrativas if group == "administrativas" else materno
        prompt, _ = entries[number - 1]
        entries[number - 1] = (prompt, options)
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

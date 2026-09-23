"""Importa CACES OCTUBRE..pdf conservando sus claves resaltadas, sin inventar opciones."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Base de Caces/octubre-documento/CACES OCTUBRE..pdf'
OUTPUT = ROOT / 'src/data/enfermeriaOctubreDocumentoQuestions.json'
AUDIT = ROOT / 'Base de Caces/octubre-documento/AUDITORIA.json'
REPORT = ROOT / 'Base de Caces/octubre-documento/AUDITORIA.md'
CLINICAL_PROCEDURES = {5, 10, 11, 19, 20, 23, 32, 34, 35}
CATEGORIES = {
    'fase-1': 'Cuidado y Procedimientos Clínicos de Enfermería',
    'fase-3': 'Cuidados del Adulto y Adulto Mayor',
}
MISSING = re.compile(r'no se logra definir|no se comprende|no se escuchan|alternativa relacionada|alternativa orientada', re.I)


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def highlighted(char, rectangles):
    x, y = (char['x0'] + char['x1']) / 2, (char['top'] + char['bottom']) / 2
    return any(r['x0'] <= x <= r['x1'] and r['top'] <= y <= r['bottom'] for r in rectangles)


def parse_source(source=SOURCE):
    blocks, current = [], None
    with pdfplumber.open(source) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            rectangles = [r for r in page.rects if tuple(r.get('non_stroking_color') or ()) == (1, 1, 0)]
            for line in page.extract_text_lines():
                text = clean(line['text'])
                if text.startswith(('BANCO DE PREGUNTAS', 'Voz ')):
                    continue
                start = re.match(r'^(\d+)\.\s+(.*)', text)
                if start or current is None:
                    if current is not None:
                        blocks.append(current)
                    current = {'number': int(start[1]) if start else 1, 'page': page_number, 'prompt': [], 'options': {}, 'marked': set(), 'notes': []}
                    text = start[2] if start else text
                chars = [c for c in line['chars'] if c['text'].strip()]
                is_marked = bool(chars) and sum(highlighted(c, rectangles) for c in chars) / len(chars) > 0.5
                option = re.match(r'^([A-D])\.\s*(.*)', text)
                if option:
                    if option[1] in current['options']:
                        raise ValueError(f"Opción duplicada: {current['number']} {option[1]}")
                    current['options'][option[1]] = [option[2]]
                elif text.startswith(('Respuesta:', 'NO SE ESCUCHAN')):
                    current['notes'].append(text)
                elif current['options']:
                    current['options'][next(reversed(current['options']))].append(text)
                else:
                    current['prompt'].append(text)
                if is_marked and current['options']:
                    current['marked'].add(next(reversed(current['options'])))
    if current:
        blocks.append(current)
    if [block['number'] for block in blocks] != list(range(1, 40)):
        raise ValueError('La secuencia del PDF no coincide con los 39 reactivos esperados')
    return blocks


def build():
    questions, audit = [], []
    for block in parse_source():
        number = block['number']
        prompt = clean(' '.join(block['prompt']))
        options = {letter: clean(' '.join(lines)) for letter, lines in block['options'].items()}
        marks = sorted(block['marked'])
        reason = None
        if set(options) != set('ABCD'):
            reason = f"Solo hay {len(options)} opciones; se necesitan cuatro alternativas completas."
        elif any(MISSING.search(option) for option in options.values()):
            reason = 'Una o más alternativas son notas de transcripción incompleta.'
        elif len(marks) != 1:
            reason = f'No hay una clave resaltada única: {marks}.'
        elif len(set(option.casefold().rstrip('.') for option in options.values())) != 4:
            reason = 'Hay opciones repetidas.'
        phase = 'fase-1' if number in CLINICAL_PROCEDURES else 'fase-3'
        audit.append({'number': number, 'page': block['page'], 'status': 'pendiente' if reason else 'incorporada', 'reason': reason, 'phase': phase, 'marked_options': marks, 'question_text': prompt, 'options': options, 'notes': block['notes']})
        if reason:
            continue
        key = marks[0]
        questions.append({
            'id': f'local-enfermeria-octubre-documento-{number:03}',
            'question_text': prompt,
            **{f'option_{letter.lower()}': options[letter] for letter in 'ABCD'},
            'correct_option': key,
            'explanation': f'Según la respuesta resaltada en el documento CACES OCTUBRE, pregunta {number}, página {block["page"]}, la clave es {key}: {options[key]}',
            'category': f'Enfermería - {CATEGORIES[phase]}',
            'difficulty': 'Banco CACES OCTUBRE - documento resaltado',
            'phase': phase,
            'component': 'Componente 1: Cuidado y procedimientos clínicos' if phase == 'fase-1' else 'Componente 3: Adulto y adulto mayor',
            'created_at': None,
        })
    return questions, {'source': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'total': len(audit), 'incorporated': len(questions), 'pending': len(audit) - len(questions), 'by_phase': dict(Counter(q['phase'] for q in questions)), 'items': audit}


def report(audit):
    lines = ['# Incorporación del PDF CACES OCTUBRE', '',
             f"Fuente: `{audit['source']}`. SHA-256: `{audit['sha256']}`.", '',
             f"Se revisaron {audit['total']} reactivos: {audit['incorporated']} incorporados y {audit['pending']} pendientes de completar en el documento original.", '',
             'Las claves se extraen del resaltado amarillo por la posición de los caracteres dentro de los rectángulos del PDF. Se conservan enunciados, opciones y letras de origen; solo se normalizan saltos de línea y espacios. Las explicaciones atribuyen la clave al PDF y no constituyen una validación clínica independiente.', '',
             'Clasificación por el objetivo del reactivo: componente 1 para aislamiento, procedimiento respiratorio o perioperatorio, valoración inicial del trauma, administración o identificación de fármacos; componente 3 para patologías, atención geriátrica y cuidado del adulto. No hay reactivos completos de los componentes 2, 4 o 5.', '',
             'El banco se agrega tanto a las cargas desde Supabase como a la carga local. Participa en los componentes normales habilitados; no se mezcla con el Componente Integral exclusivo.', '',
             '| Reactivo | Página | Estado | Componente | Clave marcada | Motivo si queda pendiente |',
             '| --- | --- | --- | --- | --- | --- |']
    for row in audit['items']:
        lines.append(f"| {row['number']} | {row['page']} | {row['status']} | {row['phase']} | {', '.join(row['marked_options']) or 'Sin letra marcada'} | {row['reason'] or '—'} |")
    lines += ['', 'Los pendientes conservan el texto completo disponible en `AUDITORIA.json`, incluida la respuesta abierta «Morfina» del reactivo 29. No se inventaron distractores para convertirlos en preguntas completas.', '',
              'Reproducir con Python y pdfplumber: `python3 scripts/import_enfermeria_octubre_documento.py --check`.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, audit = build()
    outputs = {OUTPUT: json.dumps(questions, ensure_ascii=False, indent=2) + '\n', AUDIT: json.dumps(audit, ensure_ascii=False, indent=2) + '\n', REPORT: report(audit)}
    for path, content in outputs.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'El archivo no coincide con la fuente: {path}')
        else:
            path.write_text(content)
    print(f"{len(questions)} incorporadas; {audit['pending']} pendientes; componentes: {audit['by_phase']}")


if __name__ == '__main__':
    main()

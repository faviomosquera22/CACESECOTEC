"""Importa el PDF de Fundamentos; excluye solo los reactivos marcados ELIMINAR."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'Base de Caces/fundamentos-documento'
SOURCE = DIRECTORY / '1. BANCO DE PREGUNTAS CACES- COMPONENTE  1.pdf'
OUTPUT = ROOT / 'src/data/enfermeriaFundamentosDocumentoQuestions.json'
PREFIX = 'local-enfermeria-fundamentos-documento-'


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def parse_source(source=SOURCE):
    blocks = []
    current = None
    with pdfplumber.open(source) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for line in page.extract_text_lines():
                text = clean(line['text'])
                if text.startswith('BANCO DE PREGUNTAS COMPONENTE 1'):
                    continue
                start = re.fullmatch(r'Pregunta (\d+)', text)
                if start:
                    current = {'number': int(start[1]), 'page': page_number, 'lines': []}
                    blocks.append(current)
                    continue
                if current is None:
                    raise ValueError(f'Texto sin reactivo: {text}')
                # Check the actual red highlight, not a manually supplied exclusion list.
                red_mark = any(
                    tuple(rect.get('non_stroking_color') or ()) == (1, 0, 0)
                    and rect['x0'] <= line['x0'] + 10 <= rect['x1']
                    and rect['top'] <= (line['top'] + line['bottom']) / 2 <= rect['bottom']
                    for rect in page.rects
                )
                current['lines'].append({
                    'text': text, 'page': page_number, 'top': line['top'],
                    'bottom': line['bottom'], 'red_mark': red_mark,
                })
    if [block['number'] for block in blocks] != list(range(1, 38)):
        raise ValueError('Se esperaban los 37 reactivos consecutivos del PDF revisado')
    return blocks


def build(source=SOURCE):
    questions, items = [], []
    for block in parse_source(source):
        lines = block['lines']
        first = lines[0]
        status = re.match(r'^(ELIMINAR|MODIFICAR|APROBADA|APROBADO|APROVADA)\b', first['text'])
        if not status:
            raise ValueError(f"Falta estado editorial: {block['number']}")
        excluded = status[1] == 'ELIMINAR'
        if excluded != first['red_mark']:
            raise ValueError(f"La marca roja no coincide con ELIMINAR: {block['number']}")
        # Editorial comments form their own paragraph, separated from the prompt.
        index = 1
        while index < len(lines) and lines[index]['page'] == lines[index - 1]['page'] and lines[index]['top'] - lines[index - 1]['bottom'] < 6:
            index += 1
        editorial_note = clean(' '.join(line['text'] for line in lines[:index]))
        prompt, options, answer_lines = [], {}, []
        active_option = None
        for line in lines[index:]:
            text = line['text']
            option = re.match(r'^([A-D])\.\s*(.*)', text)
            if text.startswith('Respuesta ') or answer_lines:
                answer_lines.append(text)
            elif option:
                if option[1] in options:
                    raise ValueError(f"Opción duplicada: {block['number']} {option[1]}")
                active_option = option[1]
                options[active_option] = [option[2]]
            elif active_option:
                options[active_option].append(text)
            else:
                prompt.append(text)
        prompt = clean(' '.join(prompt))
        options = {key: clean(' '.join(value)) for key, value in options.items()}
        answer_line = clean(' '.join(answer_lines))
        item = {
            'number': block['number'], 'page': block['page'],
            'end_page': lines[-1]['page'], 'editorial_status': status[1],
            'editorial_note': editorial_note, 'red_highlight': first['red_mark'],
            'status': 'excluida' if excluded else 'incorporada',
            'question_text': prompt, 'options': options, 'source_answer': answer_line,
        }
        items.append(item)
        if excluded:
            continue
        answer = re.fullmatch(r'Respuesta (?:correcta(?: mencionada)?|considerada)[:.]\s*(.*)', answer_line)
        if not prompt or not answer or not answer[1]:
            raise ValueError(f"Enunciado o respuesta ausente: {block['number']}")
        lettered = re.fullmatch(r'([A-D])\.\s*(.+)', answer[1])
        source_letter = lettered[1] if lettered else None
        answer_text = lettered[2] if lettered else answer[1]
        answer_only = not options
        if answer_only:
            key = source_letter or 'A'  # Storage letter; the UI requests a written answer.
            published_options = {key: answer_text}
        else:
            key = source_letter
            published_options = options
            if set(options) != set('ABCD') or key not in options:
                raise ValueError(f"Opciones o clave inválidas: {block['number']}")
            if options[key].casefold().rstrip('.') != answer_text.casefold().rstrip('.'):
                raise ValueError(f"La letra y el texto de la respuesta difieren: {block['number']}")
        item.update(source_letter=source_letter, correct_option=key, source_format='answer-only' if answer_only else 'multiple-choice')
        questions.append({
            'id': f"{PREFIX}{block['number']:03}", 'question_text': prompt,
            **{f'option_{letter.lower()}': published_options.get(letter, '') for letter in 'ABCD'},
            'correct_option': key,
            'explanation': f"Según el PDF Banco de preguntas Componente 1 Fundamentos, pregunta {block['number']}, página {block['page']}: {answer_line}",
            **({'source_format': 'answer-only'} if answer_only else {}),
            'category': 'Enfermería - Cuidado y Procedimientos Clínicos de Enfermería',
            'difficulty': 'Banco CACES - Componente 1 Fundamentos - documento',
            'phase': 'componente-integral', 'component': 'Componente Integral', 'created_at': None,
        })
    return questions, {
        'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'total': len(items), 'incorporated': len(questions),
        'excluded': sum(item['status'] == 'excluida' for item in items),
        'answer_only': sum(question.get('source_format') == 'answer-only' for question in questions),
        'items': items,
    }


def report(audit):
    lines = [
        '# Incorporación del banco Componente 1 Fundamentos al Componente Integral', '',
        f"Fuente: `{audit['source']}`. SHA-256: `{audit['sha256']}`.", '',
        f"{audit['total']} reactivos revisados: {audit['incorporated']} incorporados y {audit['excluded']} excluidos.", '',
        'Por instrucción del usuario se excluyen únicamente las preguntas con ELIMINAR resaltado en rojo: 7, 9, 12, 16, 31 y 32. Las preguntas marcadas MODIFICAR se incorporan sin reescribirlas; esa etiqueta no se ejecuta como instrucción.', '',
        'Se conservan los enunciados, las alternativas y las respuestas explícitas del PDF. Solo se normalizan espacios y saltos de línea. Los rótulos editoriales y sus comentarios se registran en la auditoría, separados del enunciado. Se revisaron visualmente las 13 páginas. Las respuestas se atribuyen al documento y no se sustituyen por otras claves.', '',
        'Los reactivos 5, 14, 15, 22, 26 y 36 carecen de alternativas: se integran como respuesta escrita, conservando la respuesta completa, sin inventar distractores. Las letras B (5) y C (36) se conservan internamente; los demás usan A solo como almacenamiento. La interfaz no presenta esas letras como alternativas.', '',
        'Las 31 preguntas se agregan únicamente al Componente Integral, que pasa de 81 a 112 preguntas de documentos (más las manuales del docente), manteniendo el orden aleatorio de cada intento.', '',
        '| Pregunta | Página | Rótulo del PDF | Estado | Clave / formato |',
        '| --- | --- | --- | --- | --- |',
    ]
    for item in audit['items']:
        key = 'Respuesta escrita' if item.get('source_format') == 'answer-only' else item.get('correct_option', '-')
        lines.append(f"| {item['number']} | {item['page']} | {item['editorial_status']} | {item['status']} | {key} |")
    lines += ['', 'Reproducir: `python3 scripts/import_enfermeria_fundamentos_documento.py --check` (requiere pdfplumber).', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, audit = build()
    outputs = {
        OUTPUT: json.dumps(questions, ensure_ascii=False, indent=2) + '\n',
        DIRECTORY / 'AUDITORIA.json': json.dumps(audit, ensure_ascii=False, indent=2) + '\n',
        DIRECTORY / 'AUDITORIA.md': report(audit),
    }
    for path, content in outputs.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'El archivo no coincide con la fuente: {path}')
        else:
            path.write_text(content)
    print(f"{audit['incorporated']} incorporadas; {audit['excluded']} excluidas; {audit['answer_only']} de respuesta escrita")


if __name__ == '__main__':
    main()

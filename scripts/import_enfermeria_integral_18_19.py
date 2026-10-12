"""Import only CACES 18/19, using option geometry and the explicit answer key."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'src/data/enfermeriaIntegral18And19Questions.json'
AUDIT = ROOT / 'src/data/enfermeriaIntegral18And19Audit.json'
PREFIX = 'local-enfermeria-integral-18-19-'


def clean(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', value)).strip()


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).casefold()
                   if c.isalnum() and not unicodedata.combining(c))


def extract_text(chars):
    return clean(pdfplumber.utils.extract_text(chars, x_tolerance=2, y_tolerance=3))


def extract_source(path):
    items = []
    with pdfplumber.open(path) as document:
        for page_number, page in enumerate(document.pages, 1):
            lines = page.extract_text_lines()
            headers = [line for line in lines if re.fullmatch(r'Pregunta \d+', line['text'])]
            for index, header in enumerate(headers):
                number = int(header['text'].split()[1])
                bottom = headers[index + 1]['top'] if index + 1 < len(headers) else 810
                region = [line for line in lines if header['top'] < line['top'] < bottom]
                score = next(line for line in region if line['text'].startswith('Se puntúa'))
                feedback = next(line for line in region if re.fullmatch(
                    r'Respuesta (correcta|incorrecta\.)', line['text']))
                # Each radio button has one stroked outer circle. Its position
                # gives a real option boundary, even when the text wraps.
                circles = sorted([curve for curve in page.curves
                    if curve['stroke'] and 56 < curve['x0'] < 57 and 63 < curve['x1'] < 64
                    and score['top'] < curve['top'] < feedback['top']], key=lambda c: c['top'])
                if len(circles) != 4:
                    raise ValueError(f'{path.name}/{number}: expected four radio buttons')
                chars = [c for c in page.chars
                         if score['bottom'] + 1 < c['top'] < feedback['top'] and c['x0'] >= 50]
                prompt = extract_text([c for c in chars if c['top'] < circles[0]['top'] - 4])
                options, selected = [], None
                for option_index, circle in enumerate(circles):
                    low = circle['top'] - 4
                    high = circles[option_index + 1]['top'] - 4 if option_index < 3 else feedback['top']
                    row = [c for c in chars if low < c['top'] < high]
                    marks = [c for c in row if c['text'] in ('\uf00c', '\uf00d')]
                    if len(marks) > 1:
                        raise ValueError(f'{path.name}/{number}: ambiguous selection')
                    # The feedback column starts to the right of the check/cross;
                    # exclude that column rather than guessing by sentence case.
                    cutoff = marks[0]['x0'] - 1 if marks else 560
                    options.append(extract_text([c for c in row if c['x0'] >= 69 and c['x1'] < cutoff]))
                    if marks:
                        selected = 'ABCD'[option_index]
                answer = extract_text([c for c in page.chars
                    if feedback['bottom'] < c['top'] < bottom - 4 and c['x0'] >= 50])
                if not answer.startswith('La respuesta correcta es:'):
                    raise ValueError(f'{path.name}/{number}: missing explicit answer')
                answer = answer.removeprefix('La respuesta correcta es:').strip()
                keys = [i for i, option in enumerate(options) if normalized(option) == normalized(answer)]
                if not prompt or not all(options) or len(set(map(normalized, options))) != 4 or len(keys) != 1:
                    raise ValueError(f'{path.name}/{number}: incomplete content or answer mismatch')
                items.append({'number': number, 'page': page_number, 'prompt': prompt,
                              'options': options, 'answer': answer, 'key': 'ABCD'[keys[0]],
                              'selected_option': selected})
    if [item['number'] for item in items] != list(range(1, 101)):
        raise ValueError(f'{path.name}: expected the complete sequence 1–100')
    return items


def build(source_dir):
    questions, audit, seen = [], {'sources': [], 'items': []}, {}
    for source in (18, 19):
        path = source_dir / f'CACES {source}.pdf'
        items = extract_source(path)
        audit['sources'].append({'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                 'total': len(items)})
        for item in items:
            question_id = f'{PREFIX}{source}-{item["number"]:03}'
            record = {'id': question_id, 'source': path.name, 'number': item['number'],
                      'page': item['page'], 'correct_option': item['key'],
                      'explicit_answer': item['answer'], 'selected_option': item['selected_option']}
            # Reordered options do not make a second question. Conflicting keys
            # or differing alternatives must be reviewed instead of discarded.
            fingerprint = (normalized(item['prompt']), tuple(sorted(map(normalized, item['options']))))
            if fingerprint in seen:
                original_id, original_answer = seen[fingerprint]
                if normalized(original_answer) != normalized(item['answer']):
                    raise ValueError(f'{path.name}/{item["number"]}: conflicting duplicate key')
                record.update(status='duplicate', duplicate_of=original_id)
            else:
                seen[fingerprint] = (question_id, item['answer'])
                record['status'] = 'imported'
                questions.append({
                    'id': question_id, 'question_text': item['prompt'],
                    **{f'option_{letter}': option for letter, option in zip('abcd', item['options'])},
                    'correct_option': item['key'],
                    'explanation': f'Según la clave explícita de {path.name}, pregunta {item["number"]}, '
                                   f'página {item["page"]}: {item["key"]}. {item["answer"]}',
                    'category': 'Enfermería - Componente Integral',
                    'difficulty': f'Banco CACES - Integral - CACES {source}',
                    'phase': 'componente-integral', 'component': 'Componente Integral', 'created_at': None,
                })
            audit['items'].append(record)
    audit['imported'] = len(questions)
    audit['duplicates'] = sum(item['status'] == 'duplicate' for item in audit['items'])
    return questions, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=Path.home() / 'Downloads')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, audit = build(args.source_dir)
    for path, data in ((OUTPUT, questions), (AUDIT, audit)):
        content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'Source/output mismatch: {path}')
        else:
            path.write_text(content)
    print(f'{len(questions)} preguntas incorporadas; {audit["duplicates"]} duplicada.')


if __name__ == '__main__':
    main()

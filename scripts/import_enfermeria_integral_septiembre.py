"""Import source-marked PDF questions, with a local audit of exclusions and duplicates."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import re
import unicodedata
from pathlib import Path

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [('actualizado', 'CACES actualizado.pdf'), ('cac', 'PREGUNTAS CAC.pdf'), ('ehep', 'PREGUNTAS EHEP.pdf')]
OUTPUT = ROOT / 'src/data/enfermeriaIntegralSeptiembreQuestions.json'
AUDIT = ROOT / 'tmp/integral-pdfs'
PREFIX = 'local-enfermeria-integral-septiembre-'


def clean(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text).replace('ﬁ', 'fi').replace('ﬂ', 'fl')).strip()


def normalized(text):
    text = unicodedata.normalize('NFKD', text.casefold())
    return re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in text if not unicodedata.combining(c))).strip()


def readable_pdf(path):
    """Restore missing ToUnicode ligatures verified against the rendered EHEP pages.

    Map only absent glyph codes in the embedded font, never replace punctuation
    or letters in extracted strings. The original PDF remains untouched.
    """
    if path.name != 'PREGUNTAS EHEP.pdf':
        return path
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    reader = PdfReader(path)
    repairs = {'/AAAAAC+Calibri-Bold': {'44': 'ti'}, '/AAAAAG+Calibri': {'2e': 'ti', '4a': 'fí', '64': 'tf'}, '/AAAAAI+Calibri-Italic': {'2a': 'ti'}}
    seen = set()
    for page in reader.pages:
        for ref in page['/Resources']['/Font'].values():
            font = ref.get_object()
            name = str(font['/BaseFont'])
            if name in seen or name not in repairs:
                continue
            seen.add(name)
            cmap = font['/ToUnicode'].get_data().decode()
            for code in repairs[name]:
                if re.search(rf'<{code}>\s*<{code}>', cmap, re.I):
                    raise ValueError(f'Glyph already mapped: {name} {code}')
            addition = '\n' + str(len(repairs[name])) + ' beginbfchar\n'
            addition += '\n'.join(f'<{code}><{value.encode("utf-16-be").hex()}>' for code, value in repairs[name].items()) + '\nendbfchar\n'
            stream = DecodedStreamObject()
            stream.set_data(cmap.replace('endcmap', addition + 'endcmap').encode())
            font[NameObject('/ToUnicode')] = stream
    writer = PdfWriter()
    writer.append(reader)
    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def highlighted(line, rectangles):
    return any(
        r['x0'] <= (c['x0'] + c['x1']) / 2 <= r['x1'] and
        r['top'] <= (c['top'] + c['bottom']) / 2 <= r['bottom']
        for c in line['chars'] if c['text'].strip() for r in rectangles
    )


def extract_blocks(path, slug):
    blocks, current = [], None
    with pdfplumber.open(readable_pdf(path)) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            yellow = [r for r in page.rects if tuple(r.get('non_stroking_color') or ()) == (1, 1, 0)]
            for raw in page.extract_text_lines():
                text = clean(raw['text'])
                line = {'text': text, 'page': page_number, 'top': raw['top'], 'bottom': raw['bottom'], 'x0': raw['x0'], 'marked': highlighted(raw, yellow)}
                if slug == 'ehep':
                    if text in ('PREGUNTAS', 'COMPONENTE 5', 'ESCALA DE ASA'):
                        continue
                    start = text.lower() in ('pregunta', 'preguntas', 'caso clínico')
                    if start and text.lower() == 'pregunta' and current and current.get('case'):
                        current['case'] = False
                        continue
                    if start:
                        current = {'number': len(blocks) + 1, 'page': page_number, 'lines': [], 'case': text.lower() == 'caso clínico'}
                        blocks.append(current)
                        continue
                    if current and not current['lines']:
                        line['text'] = re.sub(r'^1\.\s*', '', text)
                else:
                    start = re.match(r'^(\d{1,2})\.(?!\d)\s*(.*)', text)
                    if start:
                        current = {'number': int(start[1]), 'page': page_number, 'lines': []}
                        blocks.append(current)
                        line['text'] = start[2]
                if current is None:
                    raise ValueError(f'Unassigned source text: {path.name}: {text}')
                current['lines'].append(line)
    expected = 28 if slug == 'ehep' else 20
    if len(blocks) != expected or [b['number'] for b in blocks] != list(range(1, expected + 1)):
        raise ValueError(f'Unexpected source inventory: {slug}: {len(blocks)}')
    return blocks


def parse_block(block, slug):
    prompt, options, answer, explanation = [], {}, [], []
    marks, active, mode = set(), None, 'prompt'
    # CAC uses unlabeled, indented alternatives on these visually checked items.
    unlabeled = slug == 'cac' and block['number'] in (1, 2, 3, 4, 6)
    previous = None
    for line in block['lines']:
        text = line['text']
        if text.startswith('Respuesta'):
            mode = 'answer'
            answer.append(re.sub(r'^Respuesta(?: correcta)?\s*:\s*', '', text))
            continue
        if text.startswith('Justificación'):
            mode = 'explanation'
            continue
        if mode == 'explanation':
            explanation.append(text)
            continue
        if mode == 'answer':
            answer.append(text)
            continue
        option = re.match(r'^([A-Ea-e])[.)]\s*(.*)', text)
        if option:
            active = option[1].upper()
            if active in options:
                raise ValueError(f'Duplicate option in {slug} {block["number"]}')
            options[active] = [option[2]]
            mode = 'options'
        elif unlabeled and (line['x0'] > 130 or (block['number'] == 4 and (mode == 'options' or (prompt and prompt[-1].endswith('?'))))):
            # Source alternatives are separate paragraphs; wrapped lines have no gap.
            new_paragraph = previous is None or line['page'] != previous['page'] or line['top'] - previous['bottom'] > 5
            if active is None or new_paragraph:
                active = 'ABCDE'[len(options)]
                options[active] = []
            options[active].append(text)
            mode = 'options'
        elif mode == 'options':
            options[active].append(text)
        else:
            prompt.append(text)
        if mode == 'options' and line['marked']:
            marks.add(active)
        previous = line
    options = {k: clean(' '.join(v)) for k, v in options.items()}
    answer_text = clean(' '.join(answer))
    explicit = re.fullmatch(r'([A-E])\.\s*(.+)', answer_text)
    reason = None
    if len(options) < 2:
        reason = 'Sin alternativas de opción múltiple'
    elif set(options) != set('ABCDE'[:len(options)]) or any(not v for v in options.values()):
        reason = 'Alternativas incompletas'
    elif len(set(map(normalized, options.values()))) != len(options):
        reason = 'Alternativas repetidas'
    elif slug == 'actualizado' and block['number'] == 4 and options.get('A') == 'Impacto en la':
        reason = 'Alternativa A truncada en la fuente: Impacto en la'
    if explicit:
        key = explicit[1]
        if key not in options or normalized(explicit[2]) != normalized(options[key]):
            raise ValueError(f'Answer letter/text mismatch: {slug} {block["number"]}: {answer_text} {options}')
        if marks and marks != {key}:
            raise ValueError(f'Conflicting marks: {slug} {block["number"]}')
    else:
        key = next(iter(marks)) if len(marks) == 1 else None
    if not reason and key is None:
        reason = 'Sin respuesta única identificable en la fuente'
    return {
        'id': f'{PREFIX}{slug}-{block["number"]:03}', 'source': dict(SOURCES)[slug], 'number': block['number'],
        'page': block['page'], 'end_page': block['lines'][-1]['page'],
        'question_text': clean(' '.join(prompt)), 'options': options, 'correct_option': key,
        'marked_options': sorted(marks), 'explicit_answer': answer_text, 'source_explanation': clean(' '.join(explanation)),
        'status': 'excluded' if reason else 'candidate', 'reason': reason,
    }


def existing_questions():
    result = []
    for name in ('enfermeriaComponenteIntegralQuestions', 'enfermeriaOctubreDocumentoQuestions', 'enfermeriaFundamentosDocumentoQuestions'):
        result.extend(json.loads((ROOT / f'src/data/{name}.json').read_text()))
    return result


def build(source_dir):
    items, sources = [], []
    for slug, name in SOURCES:
        path = source_dir / name
        blocks = extract_blocks(path, slug)
        items.extend(parse_block(b, slug) for b in blocks)
        sources.append({'name': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'total': len(blocks)})
    return items, sources


# Source variants reviewed by meaning, case and requested answer, not merely topic.
REVIEWED_DUPLICATES = {
    'cac-005': ('local-enfermeria-integral-materno-infantil-017', 'Mismo registro del crecimiento en la libreta integral de salud; además carece de alternativas.'),
    'cac-007': ('local-enfermeria-integral-materno-infantil-004', 'Misma pregunta sobre el tiempo para pinzar y cortar el cordón; además carece de alternativas.'),
    'ehep-026': ('local-enfermeria-integral-administrativas-003', 'Misma actividad comunitaria de alimentación saludable con autoridades: feria de salud.'),
    'ehep-028': ('local-enfermeria-integral-administrativas-010', 'Variante del mismo brote de hepatitis con nueve sospechosos y cinco confirmados: búsqueda activa de casos.'),
}


def segregate(items, existing):
    by_id = {q['id']: q for q in existing}
    seen = {normalized(q['question_text']): q['id'] for q in existing}
    questions = []
    for item in items:
        short_id = item['id'].removeprefix(PREFIX)
        duplicate = REVIEWED_DUPLICATES.get(short_id)
        if duplicate:
            if duplicate[0] not in by_id:
                raise ValueError(f'Missing retained original: {duplicate[0]}')
            item.update(status='duplicate', duplicate_of=duplicate[0], reason=duplicate[1])
        elif normalized(item['question_text']) in seen:
            item.update(status='duplicate', duplicate_of=seen[normalized(item['question_text'])], reason='Enunciado repetido después de normalizar espacios, acentos y puntuación.')
        if item['status'] != 'candidate':
            continue
        seen[normalized(item['question_text'])] = item['id']
        item['status'] = 'imported'
        key, options = item['correct_option'], item['options']
        explanation = f"Según {item['source']}, reactivo {item['number']}, página {item['page']}: {key}. {options[key]}"
        if item['source_explanation']:
            explanation += ' Justificación del documento: ' + item['source_explanation']
        questions.append({
            'id': item['id'], 'question_text': item['question_text'],
            **{f'option_{letter.lower()}': options.get(letter, '') for letter in 'ABCD'},
            **({'option_e': options['E']} if 'E' in options else {}),
            **({'source_format': 'partial-options'} if len(options) < 4 else {}),
            'correct_option': key, 'explanation': explanation,
            'category': 'Enfermería - Componente Integral',
            'difficulty': f"Banco CACES - Integral septiembre - {item['source'].removesuffix('.pdf')}",
            'phase': 'componente-integral', 'component': 'Componente Integral', 'created_at': None,
        })
    return questions


def report(audit):
    counts = audit['counts']
    lines = ['# Importación al Componente Integral', '',
        f"Revisados: {sum(counts.values())}. Nuevos: {counts['imported']}. Repetidos: {counts['duplicate']}. Incompletos o sin clave: {counts['excluded']}.", '',
        'Se revisaron las 21 páginas de los tres PDF. Se conservaron los textos y las claves de origen, sin resolver preguntas ni completar alternativas. Las claves proceden del resaltado amarillo o de la respuesta explícita. Los rótulos internos del PDF no son instrucciones de importación.', '',
        'La comparación abarca los tres documentos y los 112 reactivos previos del banco Integral. La consulta de preguntas manuales publicadas en Integral devolvió cero registros. No se encontraron repeticiones entre los tres documentos; las cuatro variantes repetidas corresponden al banco anterior. Dos de ellas también carecen de alternativas.', '',
        'Se conservan cinco preguntas con tres alternativas y una con cinco; no se inventan opciones. En EHEP se reparó solo la extracción de cinco códigos de glifos ausentes en ToUnicode (ti, fí, tf); los PDF originales no se modificaron. EHEP se enumera por orden de aparición y se conserva unido el caso clínico ASA a su pregunta.', '',
        'El banco pasa de 112 a 169 preguntas. Las claves se atribuyen a los documentos; esta revisión verifica fidelidad e integridad de la importación, no certifica su vigencia clínica.', '',
        '| Archivo | Nuevas | Repetidas | Incompletas / sin clave |', '| --- | ---: | ---: | ---: |']
    for source in audit['sources']:
        subset = [i for i in audit['items'] if i['source'] == source['name']]
        lines.append(f"| {source['name']} | {sum(i['status']=='imported' for i in subset)} | {sum(i['status']=='duplicate' for i in subset)} | {sum(i['status']=='excluded' for i in subset)} |")
    for status, title in [('duplicate', 'Repetidas separadas'), ('excluded', 'Excluidas'), ('imported', 'Incorporadas')]:
        lines += ['', '## ' + title, '', '| Archivo / reactivo | Página | Clave | Motivo o referencia |', '| --- | ---: | --- | --- |']
        for item in audit['items']:
            if item['status'] == status:
                detail = item.get('reason') or f"{len(item['options'])} alternativas"
                if item.get('duplicate_of'):
                    detail += ' Conservada: ' + item['duplicate_of']
                lines.append(f"| {item['source']} / {item['number']} | {item['page']} | {item['correct_option'] or '—'} | {detail} |")
    lines += ['', '## Huellas de los archivos originales', '']
    lines += [f"- {s['name']}: `{s['sha256']}`" for s in audit['sources']]
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=Path.home() / 'Desktop')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    items, sources = build(args.source_dir)
    questions = segregate(items, existing_questions())
    audit = {'sources': sources, 'counts': {s: sum(i['status'] == s for i in items) for s in ('imported', 'duplicate', 'excluded')}, 'items': items}
    AUDIT.mkdir(parents=True, exist_ok=True)
    outputs = {OUTPUT: json.dumps(questions, ensure_ascii=False, indent=2) + '\n', AUDIT / 'AUDITORIA.json': json.dumps(audit, ensure_ascii=False, indent=2) + '\n', AUDIT / 'AUDITORIA.md': report(audit)}
    for path, content in outputs.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'Source/output mismatch: {path}')
        else:
            path.write_text(content)
    print(audit['counts'])


if __name__ == '__main__':
    main()

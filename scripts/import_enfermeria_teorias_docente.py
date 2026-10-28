"""Import the 306 teacher items, checking every key against the final table."""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Base de Caces/teorias-enfermeria/Banco_EHEP_Teorias_Enfermeria_306_DOCENTE.docx'
OUTPUT = ROOT / 'src/data/enfermeriaTeoriasDocenteQuestions.json'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def text(node):
    return ''.join(node.itertext()) if node.tag.endswith('}t') else ''.join(t.text or '' for t in node.findall('.//w:t', NS))


def build(source=SOURCE, expected=306, id_prefix="local-enfermeria-teorias-docente-", width=3):
    with ZipFile(source) as archive:
        body = ET.fromstring(archive.read('word/document.xml')).find('w:body', NS)
    paragraphs = [text(p).strip() for p in body.findall('w:p', NS)]
    keys = {}
    for cell in body.findall('.//w:tbl/w:tr/w:tc', NS):
        match = re.fullmatch(r'(\d+)\. ([ABCD])', text(cell).strip())
        if match:
            number = int(match[1])
            assert number not in keys, f'Duplicate summary key {number}'
            keys[number] = match[2]
    assert sorted(keys) == list(range(1, expected + 1))
    questions = []
    for index, paragraph in enumerate(paragraphs):
        match = re.fullmatch(r'(\d+)\. (.+)', paragraph)
        if not match:
            continue
        number = int(match[1])
        assert number == len(questions) + 1
        options = {}
        for offset, letter in enumerate('ABCD', 1):
            prefix = f'{letter}) '
            line = paragraphs[index + offset]
            assert line.startswith(prefix), (number, line)
            options[letter] = line[len(prefix):]
        answer = re.fullmatch(r'Respuesta correcta: ([ABCD])', paragraphs[index + 5])
        assert answer and answer[1] == keys[number], f'Key mismatch {number}'
        key = answer[1]
        justification = paragraphs[index + 6]
        assert justification.startswith('Justificación: ')
        explanations = {key: justification.removeprefix('Justificación: ')}
        for offset in range(7, 10):
            distractor = re.fullmatch(r'([ABCD])\) incorrecta: (.+)', paragraphs[index + offset])
            assert distractor and distractor[1] not in explanations, number
            explanations[distractor[1]] = distractor[2]
        reference = paragraphs[index + 10]
        assert reference.startswith('Referencia: Alligood (2023), cap. '), (number, reference)
        assert len(set(options.values())) == 4 and all(options.values())
        questions.append({
            'id': f'{id_prefix}{number:0{width}d}',
            'question_text': match[2],
            **{f'option_{letter.lower()}': value for letter, value in options.items()},
            'correct_option': key,
            'explanation': f'{justification}\n{reference}\nFuente: {source.name}, pregunta {number}.',
            'option_explanations': explanations,
            'category': 'Enfermería - Cuidado y Procedimientos Clínicos de Enfermería',
            'difficulty': 'Banco EHEP - Modelos y teorías de enfermería - Docente',
            'phase': 'fase-1',
            'component': 'Componente 1: Cuidado y procedimientos clínicos',
            'subcomponent': 'Modelos y teorías de enfermería',
            'created_at': None,
        })
    assert len(questions) == expected
    assert len({q['question_text'] for q in questions}) == expected
    audit = {
        'source': source.name,
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'questions': expected, 'keys_matched_to_summary': expected,
        'options': expected * 4, 'distractor_explanations': expected * 3,
        'component': 'fase-1',
        'answer_distribution': dict(sorted(Counter(q['correct_option'] for q in questions).items())),
        'verification': 'Transcripción contrastada con el DOCX y su tabla de claves; no es una revisión independiente del libro citado.',
    }
    return questions, audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, audit = build()
    for path, value in [(OUTPUT, questions), (SOURCE.parent / 'AUDITORIA.json', audit)]:
        content = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
        if args.check:
            assert path.read_text() == content, f'Source mismatch: {path}'
        else:
            path.write_text(content)
    print(json.dumps(audit, ensure_ascii=False))

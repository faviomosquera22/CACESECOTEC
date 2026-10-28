"""Import the 1,000 additional nursing theory teacher questions."""
import argparse
import json
import re
import unicodedata
from import_enfermeria_teorias_docente import ROOT, build

SOURCE = ROOT / 'Base de Caces/teorias-enfermeria-1000/Banco_EHEP_Teorias_Enfermeria_1000_DOCENTE.docx'
OUTPUT = ROOT / 'src/data/enfermeriaTeorias1000DocenteQuestions.json'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, audit = build(SOURCE, 1000, 'local-enfermeria-teorias-1000-docente-', 4)
    previous = json.loads((ROOT / 'src/data/enfermeriaTeoriasDocenteQuestions.json').read_text())
    assert not ({q['id'] for q in previous} & {q['id'] for q in questions})
    previous_by_text = {q['question_text']: q for q in previous}
    overlaps = [q for q in questions if q['question_text'] in previous_by_text]
    def answer(q):
        value = q['option_' + q['correct_option'].lower()]
        return re.sub(r'[^\w ]', '', unicodedata.normalize('NFKC', value).lower()).strip()
    assert all(answer(q) == answer(previous_by_text[q['question_text']]) for q in overlaps)
    audit['overlapping_statements_with_306_bank'] = len(overlaps)
    audit['overlapping_correct_answers_matched'] = len(overlaps)
    audit['previous_unique_questions_retained'] = len(previous) - len(overlaps)
    audit['combined_theory_questions'] = len(previous) + len(questions) - len(overlaps)
    for path, value in [(OUTPUT, questions), (SOURCE.parent / 'AUDITORIA.json', audit)]:
        content = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
        if args.check:
            assert path.read_text() == content, f'Source mismatch: {path}'
        else:
            path.write_text(content)
    print(json.dumps(audit, ensure_ascii=False))

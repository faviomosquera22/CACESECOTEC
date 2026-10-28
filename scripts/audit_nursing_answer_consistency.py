"""Reproducible candidate audit; flags require contextual/clinical review."""
import argparse
import collections
import difflib
import glob
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/nursing-answer-consistency-audit.json'

def norm(value):
    ascii_text = unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\W+', ' ', ascii_text).strip()

def audit():
    files = sorted((ROOT / 'src/data').glob('enfermeria*Questions.json'))
    questions = [q for path in files for q in json.loads(path.read_text())]
    repairs = json.loads((ROOT / 'src/data/reviewedClinicalQuestionRepairs.json').read_text())
    ids = {q['id'] for q in repairs}
    by_stem, by_options = collections.defaultdict(list), collections.defaultdict(list)
    formats, invalid = [], []
    for q in questions:
        by_stem[norm(q['question_text'])].append(q)
        options = [q.get('option_' + x, '') for x in 'abcd']
        by_options[tuple(sorted(norm(o) for o in options))].append(q)
        key = q.get('correct_option', '')
        if key not in ['A', 'B', 'C', 'D', 'E'] or not q.get('option_' + key.lower(), ''):
            invalid.append(q['id'])
        if not all(options):
            formats.append({'id': q['id'], 'source_format': q.get('source_format')})
    exact_conflicts = []
    for items in by_stem.values():
        answers = {norm(q.get('option_' + q['correct_option'].lower(), '')) for q in items}
        if len(answers) > 1:
            exact_conflicts.append({'ids': [q['id'] for q in items], 'answers': sorted(answers), 'review': 'corrected' if any(q['id'] in ids for q in items) else 'same meaning; spelling/spacing variants'})
    long_option_candidates = []
    for opts, items in by_options.items():
        if len(items) < 2 or min(map(len, opts)) < 14:
            continue
        for q in items:
            a = set(norm(q['question_text']).split())
            others = [o for o in items if norm(o['question_text']) != norm(q['question_text'])]
            if not others:
                continue
            similarity, other = min(( (len(a & set(norm(o['question_text']).split())) / max(1, len(a | set(norm(o['question_text']).split()))), o) for o in others), key=lambda pair: pair[0])
            if similarity < .13:
                long_option_candidates.append({'id': q['id'], 'comparison_id': other['id'], 'review': 'mismatched options corrected' if q['id'] == 'local-enfermeria-0916-6e0459779de3' else 'alternatives coherent with respective topic; shared set alone is not an error'})
    # Near-identical wording may differ by a clinically decisive number or word.
    # Keep all pairs as an inspection trail rather than auto-changing their keys.
    tokens = [set(norm(q['question_text']).split()) for q in questions]
    index = collections.defaultdict(list)
    for i, words in enumerate(tokens):
        for word in words:
            index[word].append(i)
    near = []
    for i, words in enumerate(tokens):
        if len(words) < 12:
            continue
        anchors = sorted(words, key=lambda w: (len(index[w]), w))[:3]
        for j in sorted({j for word in anchors for j in index[word] if j > i}):
            if len(words & tokens[j]) / max(1, len(words | tokens[j])) < .85:
                continue
            a, b = questions[i], questions[j]
            answer = lambda q: norm(q.get('option_' + q['correct_option'].lower(), ''))
            if answer(a) == answer(b) or difflib.SequenceMatcher(None, answer(a), answer(b)).ratio() > .88:
                continue
            if difflib.SequenceMatcher(None, norm(a['question_text']), norm(b['question_text'])).ratio() < .9:
                continue
            near.append({'ids': [a['id'], b['id']], 'review': 'curated correction' if a['id'] in ids or b['id'] in ids else 'reviewed in context; different numbers, concepts, wording or source variants'})
    return {
        'date': '2026-10-28',
        'scope': 'Repository nursing JSON banks, including historical/retired source banks; no live teacher overrides or imported database-only items were queried.',
        'limits': 'Targeted coherence audit and clinical review of flagged cases, not clinical certification of every answer. Similarity flags do not imply an error.',
        'source_records': len(questions), 'source_files': len(files),
        'source_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        'missing_or_invalid_correct_answer': invalid,
        'preexisting_explicit_partial_or_answer_only_formats': formats,
        'exact_stem_answer_candidates': exact_conflicts,
        'long_shared_options_dissimilar_stem_candidates': long_option_candidates,
        'near_stem_answer_candidates': near,
        'corrected_records': [{'id': q['id'], 'reason': q['reason'], 'sources': q['sources']} for q in repairs],
        'preservation': 'Raw source JSON and historical attempt snapshots are not rewritten. Corrections apply only when original wording and identity/source match; teacher revisions take precedence.',
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = audit()
    content = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        assert OUTPUT.read_text() == content, 'Audit differs from source banks'
    else:
        OUTPUT.write_text(content)
    print(json.dumps({k: (len(result[k]) if isinstance(result[k], list) else result[k]) for k in ['source_records', 'source_files', 'missing_or_invalid_correct_answer', 'exact_stem_answer_candidates', 'long_shared_options_dissimilar_stem_candidates', 'near_stem_answer_candidates', 'corrected_records']}))

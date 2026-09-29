import json
import unittest
from pathlib import Path

from import_enfermeria_integral_septiembre import (
    OUTPUT, PREFIX, build, existing_questions, highlighted, normalized, segregate,
)


class IntegralSeptemberTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.items, cls.sources = build(Path.home() / 'Desktop')
        cls.questions = segregate(cls.items, existing_questions())
        cls.by_short_id = {q['id'].removeprefix(PREFIX): q for q in cls.questions}

    def test_complete_inventory_and_source_output_equality(self):
        self.assertEqual(len(self.items), 68)
        self.assertEqual([s['total'] for s in self.sources], [20, 20, 28])
        self.assertEqual(len(self.questions), 57)
        self.assertEqual(self.questions, json.loads(OUTPUT.read_text()))
        self.assertEqual(len({q['id'] for q in self.questions}), 57)

    def test_all_visual_answer_keys(self):
        # Independent transcript of the yellow marks / explicit keys seen on pages.
        expected = {
            'actualizado': {3:'B',5:'D',6:'A',7:'C',8:'C',9:'A',10:'A',11:'C',12:'A',13:'B',14:'A',15:'A',16:'A',17:'C',18:'B',19:'A',20:'C'},
            'cac': {1:'C',2:'B',3:'A',4:'A',6:'B',8:'D',9:'B',10:'C',11:'B',12:'B',13:'D',15:'D',16:'A',17:'C',20:'A'},
            'ehep': {1:'B',2:'B',3:'D',4:'C',5:'C',6:'B',7:'D',8:'C',9:'B',10:'B',12:'B',13:'C',14:'B',15:'A',16:'B',17:'B',18:'C',19:'B',20:'A',21:'D',22:'C',23:'B',24:'A',25:'C',27:'D'},
        }
        self.assertEqual({k: q['correct_option'] for k, q in self.by_short_id.items()}, {f'{slug}-{n:03}': key for slug, keys in expected.items() for n, key in keys.items()})

    def test_exclusions_and_repetitions(self):
        self.assertEqual([i['id'].removeprefix(PREFIX) for i in self.items if i['status']=='excluded'], ['actualizado-001','actualizado-002','actualizado-004','cac-014','cac-018','cac-019','ehep-011'])
        self.assertEqual([i['id'].removeprefix(PREFIX) for i in self.items if i['status']=='duplicate'], ['cac-005','cac-007','ehep-026','ehep-028'])
        existing = {q['id'] for q in existing_questions()}
        self.assertTrue(all(i['duplicate_of'] in existing for i in self.items if i['status']=='duplicate'))

    def test_preserves_all_supplied_options_including_fifth(self):
        for q in self.questions:
            item = next(i for i in self.items if i['id'] == q['id'])
            self.assertEqual(q['question_text'], item['question_text'])
            self.assertEqual({k: q.get('option_'+k.lower()) for k in 'ABCDE' if q.get('option_'+k.lower())}, item['options'])
            self.assertTrue(q.get('option_'+q['correct_option'].lower()))
            self.assertNotEqual(q.get('source_format'), 'answer-only')
        self.assertEqual(self.by_short_id['actualizado-007']['option_e'], 'Después del contacto con el entorno del paciente')
        self.assertEqual(sum(q.get('source_format') == 'partial-options' for q in self.questions), 5)

    def test_unlabeled_wrapped_and_cross_page_text(self):
        self.assertTrue(self.by_short_id['cac-002']['option_a'].endswith('zona central del talón.'))
        self.assertTrue(self.by_short_id['cac-002']['option_d'].endswith('hiperplasia suprarrenal congénita.'))
        self.assertIn('cm. Después de una hora', self.by_short_id['cac-010']['question_text'])
        self.assertIn('en los orificios naturales', self.by_short_id['actualizado-013']['question_text'])
        self.assertTrue(self.by_short_id['ehep-010']['question_text'].startswith('Paciente masculino de 58 años'))
        self.assertIn('¿Cuál es la clasificación ASA', self.by_short_id['ehep-010']['question_text'])
        self.assertNotIn('Justificación', self.by_short_id['ehep-010']['option_d'])
        self.assertIn('metformina', self.by_short_id['ehep-010']['question_text'])
        self.assertIn('PaO₂', self.by_short_id['cac-003']['question_text'])

    def test_glyph_restoration_preserves_real_punctuation(self):
        self.assertIn('diagnosticada', self.by_short_id['ehep-001']['question_text'])
        self.assertIn('estilo', self.by_short_id['ehep-001']['option_b'])
        self.assertIn('físicos', self.by_short_id['ehep-023']['option_c'])
        self.assertEqual(self.by_short_id['ehep-004']['option_a'], 'Mosquito Aedes aegypti')
        self.assertIn('200 mg/dL.', self.by_short_id['ehep-001']['question_text'])

    def test_deduplication_ignores_accents_punctuation_and_case(self):
        self.assertEqual(normalized('¿Qué   acción?'), normalized('QUE ACCION'))
        existing = [{'id': 'previous', 'question_text': '¿Qué acción?'}]
        items = [{'id':'test', 'question_text':'QUE ACCION', 'status':'candidate'}]
        self.assertEqual(segregate(items, existing), [])
        self.assertEqual(items[0]['duplicate_of'], 'previous')

    def test_yellow_highlight_does_not_capture_adjacent_line(self):
        rect = {'x0':0,'x1':100,'top':20,'bottom':30}
        char = {'text':'A', 'x0':5,'x1':10,'top':19,'bottom':31}
        self.assertTrue(highlighted({'chars':[char]},[rect]))
        self.assertFalse(highlighted({'chars':[{**char,'top':29,'bottom':39}]},[rect]))


if __name__ == '__main__':
    unittest.main()

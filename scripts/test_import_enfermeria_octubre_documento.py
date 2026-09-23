import unittest
from import_enfermeria_octubre_documento import build, highlighted


class OctoberSourceTests(unittest.TestCase):
    def test_marks_and_missing_options_match_visual_review(self):
        questions, audit = build()
        expected = {1:'D',3:'B',5:'B',6:'B',7:'A',8:'C',10:'B',11:'C',12:'B',13:'C',14:'C',15:'D',16:'B',17:'D',18:'C',19:'A',20:'A',21:'A',22:'A',23:'B',24:'B',25:'B',28:'C',30:'D',31:'C',32:'D',33:'B',35:'C',36:'A',39:'B'}
        actual = {int(q['id'].rsplit('-',1)[1]):q['correct_option'] for q in questions}
        self.assertEqual(actual, expected)
        self.assertEqual([q['number'] for q in audit['items'] if q['status']=='pendiente'], [2,4,9,26,27,29,34,37,38])
        self.assertEqual(audit['by_phase'], {'fase-3':22,'fase-1':8})
        for question in questions:
            self.assertEqual(len({question['option_'+k] for k in 'abcd'}),4)
            self.assertNotIn('Voz ', question['question_text'])
            self.assertIn(question['option_'+question['correct_option'].lower()], question['explanation'])

    def test_highlight_does_not_capture_adjacent_line(self):
        rectangle = {'x0':0,'x1':100,'top':20,'bottom':30}
        self.assertTrue(highlighted({'x0':5,'x1':10,'top':19,'bottom':31},[rectangle]))
        self.assertFalse(highlighted({'x0':5,'x1':10,'top':29,'bottom':39},[rectangle]))


if __name__=='__main__':
    unittest.main()

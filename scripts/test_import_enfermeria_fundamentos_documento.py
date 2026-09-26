"""Verifica exclusiones, claves revisadas visualmente y texto entre páginas."""
import unittest

from import_enfermeria_fundamentos_documento import build


class FundamentosImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        questions, cls.audit = build()
        cls.questions = {int(q['id'][-3:]): q for q in questions}

    def test_editorial_marks_and_source_keys(self):
        self.assertEqual(self.audit['total'], 37)
        self.assertEqual(self.audit['incorporated'], 31)
        self.assertEqual([q['number'] for q in self.audit['items'] if q['red_highlight']], [7, 9, 12, 16, 31, 32])
        # Independent transcription of the explicit answer letters on the 13 rendered pages.
        expected = {1: 'B', 2: 'D', 3: 'B', 4: 'B', 5: 'B', 6: 'C', 8: 'D', 10: 'C', 11: 'D', 13: 'C',
                    17: 'D', 18: 'B', 19: 'C', 20: 'C', 21: 'A', 23: 'D', 24: 'C', 25: 'D', 27: 'B',
                    28: 'C', 29: 'C', 30: 'D', 33: 'C', 34: 'B', 35: 'D', 36: 'C', 37: 'D'}
        for number, letter in expected.items():
            self.assertEqual(self.questions[number]['correct_option'], letter)
        for number in [2, 3, 4, 5, 15, 22, 34]:
            self.assertIn(number, self.questions)  # MODIFICAR is not an instruction to rewrite or exclude.

    def test_answer_only_preserves_complete_source_response(self):
        expected = {
            5: 'Identificación correcta del paciente',
            14: 'Artículo 146 del Código Orgánico Integral Penal, relacionado con el homicidio culposo por mala práctica profesional.',
            15: 'Guantes, bata, protección ocular, gorro y mascarilla',
            22: 'inmovilización de la extremidad mediante una férula.',
            26: 'retirar todos los dispositivos invasivos.',
            36: 'Bata, mascarilla, Gafas o protector facial y Guantes.',
        }
        self.assertEqual(self.audit['answer_only'], len(expected))
        for number, text in expected.items():
            q = self.questions[number]
            self.assertEqual(q['source_format'], 'answer-only')
            self.assertEqual([q[f'option_{letter}'] for letter in 'abcd' if q[f'option_{letter}']], [text])

    def test_page_continuations_and_editorial_boundaries(self):
        self.assertIn('adecuada expansión pulmonar y optimizar', self.questions[21]['question_text'])
        self.assertIn('zona afectada. Después de 20 minutos', self.questions[24]['question_text'])
        self.assertIn('lo que impide la evacuación.', self.questions[27]['question_text'])
        self.assertTrue(self.questions[35]['question_text'].startswith('Al paciente se le realizará una colelap'))
        self.assertEqual(self.questions[18]['option_b'], 'Aislamiento por gotas.')
        self.assertEqual(self.questions[34]['option_b'], 'Consultar con el equipo de atención médica y tomar una decisión conjunta sobre cómo manejar la situación.')
        for q in self.questions.values():
            self.assertNotRegex(q['question_text'], r'ELIMINAR|MODIFICAR|APROBADA|pseudopregunta|Respuesta correcta')


if __name__ == '__main__':
    unittest.main()

"""Run with: python -m unittest scripts/test_convert_legacy.py"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import convert_legacy as c  # noqa: E402


class ConvertTests(unittest.TestCase):
    def write(self, name: str, text: str) -> Path:
        path = Path(self.tmp.name) / name
        path.write_text(text, encoding="utf-8")
        return path

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_questions_json_first_answer_is_correct(self) -> None:
        path = self.write(
            "a.json",
            json.dumps({"name": "Sample", "questions": [{"question": "Q1  two spaces", "answers": ["Right", "W1", "W2", "W3"]}]}),
        )
        quiz, warnings = c.convert(path, None, None)
        self.assertEqual(quiz["id"], "sample")
        self.assertEqual(quiz["title"], "Sample")
        self.assertEqual(quiz["questions"], [{"q": "Q1 two spaces", "answer": "Right", "distractors": ["W1", "W2", "W3"]}])
        self.assertEqual(warnings, [])

    def test_quiz_dict_shape(self) -> None:
        path = self.write("b.json", json.dumps({"name": "N", "quiz": {"Q": ["A", "B"]}}))
        quiz, _ = c.convert(path, "custom-id", "Custom Title")
        self.assertEqual(quiz["id"], "custom-id")
        self.assertEqual(quiz["title"], "Custom Title")
        self.assertEqual(quiz["questions"][0]["distractors"], ["B"])

    def test_blank_and_none_of_these_answers_dropped_with_warning(self) -> None:
        path = self.write("c.json", json.dumps({"name": "N", "questions": [{"question": "Q", "answers": ["A", " ", "(none of these)", "B"]}]}))
        quiz, warnings = c.convert(path, None, None)
        self.assertEqual(quiz["questions"][0]["distractors"], ["B"])
        self.assertEqual(len(warnings), 2)

    def test_question_without_correct_answer_skipped(self) -> None:
        path = self.write("d.json", json.dumps({"name": "N", "questions": [{"question": "Q", "answers": [" ", "B"]}]}))
        quiz, warnings = c.convert(path, None, None)
        self.assertEqual(quiz["questions"], [])
        self.assertEqual(len(warnings), 1)

    def test_duplicate_question_keeps_first(self) -> None:
        path = self.write("e.json", json.dumps({"name": "N", "questions": [{"question": "Q", "answers": ["A"]}, {"question": "q ", "answers": ["Z"]}]}))
        quiz, warnings = c.convert(path, None, None)
        self.assertEqual([q["answer"] for q in quiz["questions"]], ["A"])
        self.assertEqual(len(warnings), 1)

    def test_tsv_has_no_distractors(self) -> None:
        path = self.write("f.tsv", "O\tOxygen\n\nNa\tSodium\nbad line\n")
        quiz, warnings = c.convert(path, None, "Elements")
        self.assertEqual(quiz["questions"], [{"q": "O", "answer": "Oxygen"}, {"q": "Na", "answer": "Sodium"}])
        self.assertEqual(len(warnings), 1)

    def test_merge_pools_wrong_answers_first_file_first(self) -> None:
        a = {"id": "x", "title": "X", "version": 1, "questions": [{"q": "Q1", "answer": "A", "distractors": ["a1", "a2"]}, {"q": "Q2", "answer": "B", "distractors": ["b1"]}]}
        b = {"id": "x", "title": "X", "version": 1, "questions": [{"q": "q1", "answer": "a", "distractors": ["A2", "a3"]}, {"q": "Q3", "answer": "C"}]}
        merged, warnings = c.merge([a, b])
        self.assertEqual(warnings, [])
        self.assertEqual(merged["questions"][0]["distractors"], ["a1", "a2", "a3"])
        self.assertEqual(merged["questions"][1]["distractors"], ["b1"])
        self.assertEqual([q["q"] for q in merged["questions"]], ["Q1", "Q2", "Q3"])
        self.assertEqual(a["questions"][0]["distractors"], ["a1", "a2"])  # inputs untouched

    def test_merge_warns_when_correct_answers_differ(self) -> None:
        a = {"id": "x", "title": "X", "version": 1, "questions": [{"q": "Q", "answer": "A", "distractors": ["a1"]}]}
        b = {"id": "x", "title": "X", "version": 1, "questions": [{"q": "Q", "answer": "Z", "distractors": ["z1"]}]}
        merged, warnings = c.merge([a, b])
        self.assertEqual(merged["questions"][0], {"q": "Q", "answer": "A", "distractors": ["a1"]})
        self.assertEqual(len(warnings), 1)

    def test_slugify(self) -> None:
        self.assertEqual(c.slugify("Hunger Games Quiz 2020!"), "hunger-games-quiz-2020")
        self.assertEqual(c.slugify("!!!"), "quiz")


if __name__ == "__main__":
    unittest.main()

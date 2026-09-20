"""Convert old quiz files to QuizMe's JSON format (see QUIZ-GAME.md section 4.1).

Supported inputs, chosen by file extension:

  .json      {"name": ..., "questions": [{"question": ..., "answers": [...]}]}
             {"name": ..., "quiz": {"question": [...answers...]}}
             In both, the FIRST answer is the correct one.
  .yaml/.yml A list of {Q, A, B, C, D}; A is the correct answer. Needs PyYAML.
  .tsv/.txt  One "question<TAB>answer" per line. No wrong answers are produced;
             QuizMe draws them from the other questions' answers.

Usage:
  python scripts/convert_legacy.py OLD.json --id hunger-games --title "Hunger Games" -o quizzes
  python scripts/convert_legacy.py a.json b.json -o quizzes      (ids/titles derived)
  python scripts/convert_legacy.py v2.yaml v1.yaml --merge --id biology-1 --title "Biology 1"
      Several versions of one quiz (same questions, different wrong answers)
      become a single quiz with a larger pool of wrong answers per question.

Public repo: give quizzes neutral titles and ids (no personal names). The title
inside an old file is used unless you pass --title.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

NONE_OF_THESE = "(none of these)"


def clean(text: object) -> str:
    """Trim and collapse runs of whitespace."""
    return " ".join(str(text).split())


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "quiz"


def make_question(q: object, answers: list[object], warnings: list[str]) -> dict | None:
    """First answer is correct, the rest are wrong answers. Blanks are dropped."""
    text = clean(q)
    cleaned = [clean(a) for a in answers]
    if not text:
        warnings.append("skipped a question with no text")
        return None
    if not cleaned or not cleaned[0] or cleaned[0] == NONE_OF_THESE:
        warnings.append(f'skipped "{text[:50]}": no usable correct answer')
        return None
    answer = cleaned[0]
    wrong: list[str] = []
    for a in cleaned[1:]:
        if not a or a == NONE_OF_THESE:
            warnings.append(f'"{text[:50]}": dropped a blank or "(none of these)" answer')
        elif a.lower() != answer.lower() and a.lower() not in (w.lower() for w in wrong):
            wrong.append(a)
    question: dict = {"q": text, "answer": answer}
    if wrong:
        question["distractors"] = wrong
    return question


def read_pairs(path: Path, warnings: list[str]) -> tuple[str | None, list[tuple[str, list[object]]]]:
    """Return (title found in file or None, [(question, [answers...])])."""
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        title = data.get("name") if isinstance(data, dict) else None
        if isinstance(data, dict) and isinstance(data.get("questions"), list):
            return title, [(item["question"], list(item["answers"])) for item in data["questions"]]
        if isinstance(data, dict) and isinstance(data.get("quiz"), dict):
            return title, [(q, list(a)) for q, a in data["quiz"].items()]
        raise ValueError(f"{path}: unrecognized JSON shape (expected 'questions' or 'quiz')")
    if suffix in (".yaml", ".yml"):
        import yaml  # imported here so JSON/TSV conversion works without PyYAML

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return None, [(item["Q"], [item["A"], item["B"], item["C"], item["D"]]) for item in data]
    if suffix in (".tsv", ".txt"):
        pairs: list[tuple[str, list[object]]] = []
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                warnings.append(f"line {number}: no tab separator, skipped")
                continue
            pairs.append((parts[0], [parts[1]]))
        return None, pairs
    raise ValueError(f"{path}: unsupported file type {suffix!r}")


def convert(path: Path, quiz_id: str | None, title: str | None) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    found_title, pairs = read_pairs(path, warnings)

    questions: list[dict] = []
    seen: set[str] = set()
    for q, answers in pairs:
        question = make_question(q, answers, warnings)
        if question is None:
            continue
        key = question["q"].lower()
        if key in seen:
            warnings.append(f'"{question["q"][:50]}": duplicate question, kept the first')
            continue
        seen.add(key)
        questions.append(question)

    final_title = clean(title or found_title or path.stem)
    quiz = {
        "id": quiz_id or slugify(final_title),
        "title": final_title,
        "version": 1,
        "questions": questions,
    }
    return quiz, warnings


def merge(quizzes: list[dict]) -> tuple[dict, list[str]]:
    """Combine several conversions of the same quiz into one.

    Questions are matched by text. Wrong answers are pooled (first file's first),
    which gives each question more wrong answers than are shown at once, so
    repeat rounds vary. A question whose correct answer differs between files is
    kept as in the first file, with a warning; questions missing from the first
    file are appended.
    """
    warnings: list[str] = []
    merged = {**quizzes[0], "questions": [dict(q) for q in quizzes[0]["questions"]]}
    by_key = {q["q"].lower(): q for q in merged["questions"]}

    for other in quizzes[1:]:
        for q in other["questions"]:
            mine = by_key.get(q["q"].lower())
            if mine is None:
                copy = dict(q)
                merged["questions"].append(copy)
                by_key[q["q"].lower()] = copy
                continue
            if mine["answer"].lower() != q["answer"].lower():
                warnings.append(f'"{q["q"][:50]}": correct answer differs between files, kept the first')
                continue
            pool = list(mine.get("distractors", []))
            seen = {mine["answer"].lower(), *(d.lower() for d in pool)}
            for d in q.get("distractors", []):
                if d.lower() not in seen:
                    seen.add(d.lower())
                    pool.append(d)
            if pool:
                mine["distractors"] = pool
    return merged, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="+", type=Path, help="old quiz files")
    parser.add_argument("-o", "--outdir", type=Path, default=Path("quizzes"), help="output folder (default: quizzes)")
    parser.add_argument("--id", help="quiz id (single input only); default: slug of the title")
    parser.add_argument("--title", help="quiz title (single quiz only); default: title in the file")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="treat all inputs as versions of ONE quiz and pool their wrong answers (first file wins on conflicts)",
    )
    args = parser.parse_args(argv)

    if (len(args.inputs) > 1 and not args.merge) and (args.id or args.title):
        parser.error("--id and --title with several inputs need --merge")

    args.outdir.mkdir(parents=True, exist_ok=True)
    results: list[tuple[str, dict, list[str]]] = []
    if args.merge:
        converted = [convert(path, args.id, args.title) for path in args.inputs]
        quiz, merge_warnings = merge([quiz for quiz, _ in converted])
        warnings = [w for _, ws in converted for w in ws] + merge_warnings
        results.append((" + ".join(p.name for p in args.inputs), quiz, warnings))
    else:
        for path in args.inputs:
            quiz, warnings = convert(path, args.id, args.title)
            results.append((path.name, quiz, warnings))

    for source, quiz, warnings in results:
        out = args.outdir / f"{quiz['id']}.json"
        out.write_text(json.dumps(quiz, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{source} -> {out} ({len(quiz['questions'])} questions)")
        for warning in warnings:
            print(f"  warning: {warning}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# QuizMe

Multiple-choice study quizzes that run in the browser. Static site, no accounts, no server; progress is kept in your own browser.

Live site: https://jffordem.github.io/QuizMe/

The design is in [QUIZ-GAME.md](QUIZ-GAME.md).

## Adding a quiz

A quiz is one JSON file in `quizzes/`, named after its `id`:

```json
{
  "id": "capitals",
  "title": "Capitals",
  "version": 1,
  "questions": [
    {
      "q": "Capital of France?",
      "answer": "Paris",
      "distractors": ["Lyon", "Nice", "Lille", "Nantes", "Toulouse"],
      "group": "france"
    }
  ]
}
```

- `distractors` (wrong answers) is optional and can hold any number; three are picked at random each time the question is shown, so a longer list means more variety. With fewer than three, the rest are borrowed from other questions' answers.
- `group` is optional. When set, borrowed wrong answers come only from questions in the same group.
- Bump `version` when a change would make saved progress misleading (progress for that quiz then starts fresh).
- Keep personal names out of ids, titles, and file names; the repo and site are public.

The build validates every quiz and fails, naming the file and question, if one is bad.

To convert an old quiz (YAML `Q/A/B/C/D`, older JSON, or tab-separated `question<TAB>answer`):

```bash
python scripts/convert_legacy.py old.yaml --id biology-2 --title "Biology 2" -o quizzes
```

Several versions of the same quiz (same questions, different wrong answers) can be pooled into one with `--merge`. Reading YAML needs `pip install pyyaml`.

## Development

Needs Node 22 or newer.

```bash
npm install
npm run dev       # dev server at http://localhost:4081
npm test          # unit tests
npm run build     # type-check, validate quizzes, build into dist/
npm run preview   # serve the production build locally
```

Every change goes through a branch and pull request; merging to `main` deploys to GitHub Pages.

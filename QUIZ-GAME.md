# Quiz Game — Design

A study-quiz web app the kids can open with a link. No install, no server, no accounts. Plain text interface, keyboard-first.

**Status:** Draft 5. All questions resolved. Items marked **OPEN** still need a decision.

---

## 1. Goals and non-goals

### Goals

- **Open a URL and study.** Works in any modern browser: laptop first, phone fine.
- **Same learning loop as the current Python app:** multiple choice, and a question is retired once answered correctly twice in a row.
- **Adding a quiz means adding a file.** No code changes, no database.
- **Better wrong answers.** Each question can carry a pool of wrong answers larger than the number shown, so repeat rounds don't show the same four choices (§4.2).
- **Same tooling and deploy as MorseGames.** Vite + TypeScript, GitHub Actions publishing to Pages.

### Non-goals

- Accounts, logins, leaderboards, or anything needing a backend.
- Gamification: no points, badges, sounds, animations, or celebration screens. Users are college students studying for tests.
- Question types other than multiple choice. No images.
- In-browser quiz editor.
- Tuning the mastery rule or difficulty before anyone has used it. We ship the shape and adjust after real use.

---

## 2. What exists today

Three generations of quiz code in `python-examples` and `untracked_python`, plus a pile of quiz data:

| Source | Format | Notes |
|---|---|---|
| `untracked_python/quiz_app.py` (Textual) | YAML list of `{Q, A, B, C, D}`; `A` is correct, choices shuffled at load | The current app. Source of the "correct twice in a row" rule. |
| `apps/HelloRedisOM/data/*.json` | `{name, questions: [{question, answers: [...]}]}`; first answer is correct | Hunger Games, Middle East quizzes, etc. |
| `games/quizme.py` (Tk) | `{name, quiz: {question: [answers]}}`; first answer is correct | Older. |
| `sandbox/study_guide.py` | TSV, `question<TAB>answer` | Pairs only, no distractors. |

The design keeps the two-in-a-row rule and picks one canonical format. A converter script brings the old files across.

---

## 3. Architecture

**A static single-page app. All logic runs in the browser. The quiz files are bundled into the build.**

```
private repo ──(merge to main)──▶ GitHub Actions ──▶ GitHub Pages (public site)
  quizzes/*.json                    validate, build      ├─ app + all quizzes, static
  src/                                                   └─ progress in browser localStorage
```

### Decisions

| Topic | Decision | Why |
|---|---|---|
| Repo / site | Public repo, public Pages site, deployed by an Actions workflow | Free on GitHub Free, same as MorseGames. Kids just need a link. See the note below. |
| Stack | TypeScript (strict) + Vite, no UI framework | Same as MorseGames, so `deploy.yml`, `vite.config.ts` (`base: "./"`) and `tsconfig.json` can be copied. The UI is a handful of text screens. |
| Quiz data | JSON files in `quizzes/`, imported at build time (`import.meta.glob`) | The build produces the quiz list automatically and can **validate every quiz, failing the deploy on a bad one**. No hand-maintained index. |
| Progress | `localStorage` per device | No backend, no privacy concerns. Per-device is acceptable. |
| Styling | One small CSS file, system fonts, respects light/dark, no animation | Text interface. Readable on a phone, but tuned for a laptop keyboard. |
| Tests | Vitest on the pure logic (`session.ts`, choice selection, validation) | Vitest is the natural pairing with Vite, and the logic has no DOM dependency. |
| Workflow | Branch + PR for every change; deploy on merge to `main` | `main` is protected in all repos. |

### Note: everything is public

- Both the source and the quiz files are readable by anyone, including the git history. Nothing about the kids (names, grades, school) should go into quiz content, file names, commit messages, or PRs.
- The existing quiz files have a child's name in the file name, so the converter must produce neutral ids and titles, and those old files must not be committed as-is.
- The app is for family use and is public only for convenience. `index.html` carries `<meta name="robots" content="noindex">` so search engines skip it. That is a request, not access control.
- If we ever want to hide quizzes, the fallback is a private repo that pushes its built site to a public one (or a paid GitHub plan, which allows Pages on private repos). Not needed now.

### Alternatives considered for the UI layer

| Option | Verdict |
|---|---|
| **Textual** (current apps) | Ruled out. `textual serve` and `textual-web` both need a running Python process (a server, or a machine tunneling out), which can't be hosted on static GitHub Pages. That is the "needs my computer" problem this project exists to remove. Running Textual in the browser via Pyodide isn't a supported path. |
| **TypeScript + Vite, no framework** (MorseGames' approach; it has no UI framework, only TypeScript and Vite) | **Chosen for v1.** Four plain text screens don't need a framework, and the setup is copied from MorseGames. |
| **React + TypeScript + Vite** | Reasonable, not needed. The app is deliberately plain text, so React's extra UI options go unused, and it adds a dependency and JSX. The pure logic (`session.ts`, `choices.ts`, validation) is framework-independent, so switching later would only rewrite `src/screens/`. Worth choosing up front if you want the practice or expect the UI to grow. |

### Repo layout (proposed)

```
QuizMe/
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── .github/workflows/deploy.yml     # copied from MorseGames
├── src/
│   ├── main.ts             # screen switching
│   ├── screens/            # terms.ts, list.ts, question.ts, done.ts (each builds its own DOM)
│   ├── session.ts          # pure: pool, streaks, next question
│   ├── choices.ts          # pure: build the 2-4 choices for a question
│   ├── quiz.ts             # types + validation
│   ├── storage.ts          # localStorage wrapper, tolerant of it being unavailable
│   └── style.css
├── quizzes/
│   └── hunger-games.json
├── scripts/
│   └── convert_legacy.py   # old JSON/YAML/TSV -> canonical JSON
├── test/
├── TERMS.md                # terms text; rendered by the app, so the only copy
├── QUIZ-GAME.md
└── README.md               # how to add a quiz
```

---

## 4. Data

### 4.1 Quiz file format

```json
{
  "id": "hunger-games",
  "title": "Hunger Games",
  "version": 1,
  "questions": [
    {
      "q": "Male tribute from District 11. Strong and resourceful.",
      "answer": "Thresh",
      "group": "tributes",
      "distractors": ["Rue", "Cato", "Foxface", "Peeta", "Marvel", "Glimmer"]
    },
    {
      "q": "Katniss' sister, who was selected as District 12's tribute.",
      "answer": "Prim",
      "group": "tributes"
    }
  ]
}
```

- `id` is stable and is the progress key. `version` is bumped when changes would make old progress misleading.
- Progress for a question is keyed by a hash of its text, so reordering the file doesn't scramble progress. Editing a question's text resets its streak, which is the right behavior.
- `distractors` is optional, and **may hold any number of wrong answers** (see 4.2).
- `group` is optional. It says which other questions' answers make plausible wrong answers (names with names, dates with dates).

### 4.2 How choices are built

Each time a question is shown, the app picks up to **3** wrong answers, then shuffles them with the correct one.

1. **Candidates:** the question's own `distractors`, however many there are.
2. **Top-up:** if there are fewer than 3, add the `answer`s of other questions with the same `group`. If there is no `group`, use all other answers in the quiz.
3. Remove duplicates and anything equal to the correct answer, then **sample uniformly at random**.
4. If fewer than 3 wrong answers exist at all, show fewer choices (minimum 2).

So a curated list of six wrong answers means a kid who sees the same question three times will get different combinations. Quizzes with no distractors at all still work: this is what makes TSV-style term/definition decks usable as-is.

`group` is in v1 and stays optional. It avoids nonsense choices ("1066" offered for "Who wrote Hamlet?") and costs authors nothing when they don't use it.

### 4.3 Progress (localStorage)

```json
{
  "hunger-games": {
    "version": 1,
    "questions": {
      "a1b2c3": { "streak": 1, "seen": 4, "missed": 2, "retired": false }
    }
  }
}
```

- One key per quiz, written after every answer, so closing the tab loses nothing.
- If the stored `version` doesn't match the quiz, progress for that quiz is discarded with a visible "quiz was updated, starting fresh" line, not silently.
- All storage access is in `try/catch`. If storage is blocked (private window, managed device), the app still works and just doesn't remember.

---

## 5. Gameplay and interface

The interface is plain text on a plain page. No icons, colors that carry meaning only by hue, or motion.

### 5.1 Screens

0. **Terms notice** (first visit only, see §5.4). A single page of text and one button. Nothing else is usable until it's accepted.
1. **Quiz list.** Titles as a plain list, each with a status line ("12 of 30 mastered"). Click, or press the number, to start. A "Terms" link in the footer reopens the notice.
2. **Question.**
   ```
   Hunger Games                        Mastered 12/30
   
   Male tribute from District 11. Strong and resourceful.
   
   1. Rue
   2. Thresh
   3. Cato
   4. Foxface
   
   Streak on this question: 1/2
   ```
3. **Feedback,** inline on the same screen.
   - Right: one line ("Correct."), then auto-advance after about a second.
   - Wrong: mark the correct answer and wait for Enter/Space/click.
4. **Done.** "All 30 questions mastered." A list of the questions missed most often, then "Study again" (clears that quiz's progress) or "Back to list". No fanfare.

No tutorial or rules text. The streak line teaches the mechanic by playing.

### 5.2 Mastery rule

Carried over from `quiz_app.py`:

- Every question starts in the pool with a streak of 0.
- Correct: streak +1. At 2, the question is **retired**.
- Wrong: streak resets to 0, the question stays in the pool, and the correct answer is shown.
- The quiz ends when the pool is empty.
- The next question is random from the pool, never the same question twice in a row (unless it's the last one).

The required streak is a constant, not a setting. Adjust after real use.

### 5.3 Input

- Keyboard: `1`–`4` to answer, Enter/Space to continue, `Esc` back to the list.
- Click/tap also works. Answers are full-width buttons so phones are usable.

### 5.4 Terms notice (one-time)

Modeled on MorseGames (`TERMS.md`, `src/terms.ts`), with one simplification.

**Behavior**
- On first visit, before the quiz list, show the terms as a full-page text screen (not a modal overlay; it fits the plain text interface and needs no extra CSS) with one button: **"I understand — continue"**. Enter also accepts.
- Acceptance is stored in `localStorage` as `quiz-game.termsAccepted = "<terms version>"`. Later visits skip the screen.
- The terms carry a version number. Bumping it after a material change re-prompts everyone once.
- If storage is unavailable, the screen appears on every visit (the same `try/catch` fallback as progress, §4.3). That's the safe direction to fail.
- The footer "Terms" link reopens the same text with a "Close" button.
- No decline path. If you don't want to accept, close the tab.

**Single source of truth.** MorseGames keeps the text in `TERMS.md` *and* duplicates it in `terms.ts` with a "keep in sync" comment. Here, `TERMS.md` is imported at build time (`import terms from "../TERMS.md?raw"`) and rendered as text, so there is one copy.

**Draft text** (short enough to read in one screen; it becomes `TERMS.md`):

> **Quiz Game: Terms & Disclaimer**
>
> 1. **Entertainment only.** This is a free hobby project made for fun. It is not intended for instruction, tutoring, or test preparation, and it is not a substitute for your course materials, textbooks, or instructors.
> 2. **No guarantee of correctness.** Quiz questions and answers may be wrong, incomplete, out of date, or badly worded. Check anything that matters against an authoritative source.
> 3. **No warranty; use at your own risk.** The app is provided "as is" and "as available," without warranties of any kind, including accuracy, fitness for a particular purpose, or uninterrupted availability. The creator is not liable for any damages, direct or indirect, from using it, including any grade or result you get after using it.
> 4. **No data collection.** There are no accounts and no login. Your progress is stored only in your own browser and never leaves your device. The app uses no cookies, analytics, or tracking. (The hosting provider may keep its own standard access logs, which are outside the app's control.)
> 5. **Not affiliated.** This project is not affiliated with or endorsed by any school, publisher, author, or rights holder. Titles and names appear only to identify what a question is about.
> 6. **Changes.** These terms may change. Continued use after an update means you accept the revised terms.
>
> [ I understand — continue ]

I'm not a lawyer, and this is a plain hobby-project disclaimer, not legal advice. MorseGames made the same call to ship without legal review.

---

## 6. Authoring workflow

1. Write or convert a quiz as JSON in `quizzes/` on a branch. Plausible wrong answers (`distractors`) can be drafted with Claude; the author reviews the file for correctness before committing.
2. Open a PR. CI runs the validator and the tests.
3. Merge to `main`. The site redeploys in a minute or two.

Validation runs at build time and names the file and question at fault: missing `answer`, duplicate questions, an `answer` also listed in `distractors`, fewer than two possible choices, duplicate quiz `id`. A bad quiz fails the build instead of reaching the kids.

`scripts/convert_legacy.py` handles the old formats (YAML `Q/A/B/C/D`, both legacy JSON shapes, TSV), so the existing collection can be brought over once. Converted quizzes get neutral ids and titles (the current file names include a child's name).

Later possibility: the kids write their own quizzes, either as PRs against the repo or through a paste-in importer. Not v1.

---

## 7. Known limitations

| Issue | Impact | Mitigation |
|---|---|---|
| Progress is per browser | Switching devices starts over. Clearing site data wipes it. | Accepted. Optional export/import in a later phase. |
| Repo and quizzes are public | Anyone can read the source, quizzes and history. | Keep names and personal details out of everything committed (§3 note). |
| Users can edit their own `localStorage` | Could fake progress | Not a concern: it's a study aid, not a test. |
| Managed devices may block storage | App loads but doesn't remember | Storage fallback in §4.3. |

---

## 8. Phases

### v1: playable
- Repo, Vite/TS scaffold, deploy workflow copied from MorseGames.
- Terms notice (§5.4), before anything else is usable.
- Quiz list, question flow, mastery rule, choice building (4.2), local progress, done screen.
- Build-time validation, and tests for session, choices and validation.
- Legacy converter, and the existing quizzes imported.

### v2: if wanted
- Installable/offline (service worker).
- Progress export / import.
- "Review only what I've missed" mode.

### v3: ideas, not commitments
- Paste-in quiz importer for the kids.
- Other question types (typed answer, flashcard).

---

## 9. Resolved and open

### Resolved
| Question | Decision |
|---|---|
| Repo visibility | Public repo, public Pages site (same as MorseGames). Keep personal details out of everything committed. |
| Cross-device progress | Per-device `localStorage` is fine. |
| Question types | Multiple choice only, with a larger wrong-answer pool for variety. |
| Audience / style | College students. Plain text interface, no gamification. |
| Images | Out of scope (text only). |
| Quiz index | Generated by the build; no hand-maintained file. |
| UI framework | Whatever MorseGames uses: TypeScript + Vite, no framework. Textual can't be hosted on static Pages; React isn't needed for a plain text multiple-choice UI (§3). |
| Repo name | **QuizMe** (`jffordem/QuizMe`, site at `https://jffordem.github.io/QuizMe/`). Chosen over QuizGame to avoid looking like MorseGames. |
| `group` field | In v1, optional. |
| Wrong-answer authoring | Drafted with Claude, reviewed by the author before committing. |
| Feedback link | None. Family-only, public for convenience, not commerce or feedback. Terms need no feedback clause. |
| Shared devices / profiles | Dropped; users are adults on their own devices. |
| Terms / disclaimer | One-time acceptance screen: entertainment only, no guarantee of correctness, no warranty, no data collection. Text in `TERMS.md`, rendered by the app (§5.4). |

### Open
None. Ready to scaffold v1.

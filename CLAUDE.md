# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

QuizMe is a static, browser-only multiple-choice study app (TypeScript strict + Vite, no UI framework, no backend) deployed to GitHub Pages at https://jffordem.github.io/QuizMe/. [QUIZ-GAME.md](QUIZ-GAME.md) is the design reference; where it disagrees with the code, the code wins (e.g. storage keys are prefixed `quizme.`, not `quiz-game.`). [README.md](README.md) documents the quiz file format for authors.

## Commands

Node 22+.

```bash
npm install
npm run dev                         # dev server on http://localhost:4081 (host: true, reachable on LAN)
npm test                            # vitest run, all tests
npx vitest run test/session.test.ts # one test file
npx vitest run -t "retires"         # tests whose name matches
npm run build                       # tsc type-check + validate every quiz + vite build into dist/
npm run preview                     # serve dist/
python -m unittest scripts/test_convert_legacy.py   # converter tests (CI runs these too)
```

There is no linter; `tsc` (run by `npm run build`, with `noUnusedLocals`/`noUnusedParameters`) is the static check. CI (`.github/workflows/ci.yml`, on PRs) runs `npm test`, `npm run build`, and the Python tests. Merging to `main` deploys via `deploy.yml`. `main` is protected: every change goes through a branch and PR.

## Architecture

**Pure logic vs. DOM.** `session.ts` (mastery rule, question selection, progress serialization), `choices.ts` (building 2–4 shuffled choices), `quiz.ts` (types + validation), and `text.ts` (normalization, question keys) have no DOM or storage access and take an injectable `Rng`. Keep them that way; tests use `seeded()` from `test/helpers.ts` for determinism.

**Screens.** `app.ts` provides a tiny screen system: a `Screen` is `(ctx) => void` that builds its own DOM into `ctx.root`. `ctx.show()` swaps screens and bumps an epoch, so timers registered via `ctx.later()` and the single key handler set via `ctx.keys()` are automatically dropped on every switch. Always use `ctx.later`/`ctx.keys` in screens rather than raw `setTimeout`/`addEventListener`, or stale callbacks will fire on the wrong screen. Screens receive callbacks (e.g. `{ play, reset }`) and don't know about each other; `flow.ts` wires them together (terms gate → list → question → done, plus reset confirmation and the footer Terms link that returns to the current screen). `main.ts` only finds `#screen`/`#terms-link` and calls `startApp`, so tests can start the app on any element.

**Quiz loading and validation.** `library.ts` bundles `quizzes/*.json` via `import.meta.glob` (no index file to maintain). `parseLibrary` in `quiz.ts` is run twice: by the `validate-quizzes` plugin in `vite.config.ts` at build time (fails the build, naming file and question), and at load time for typed data (the dev server doesn't run the build check). Quiz ids must be unique across files; by convention the filename matches the `id` (not enforced).

**Progress.** Stored in `localStorage` under `quizme.progress.<quizId>` as `{ version, questions: { [questionKey]: {streak, seen, missed, retired} } }`. `questionKey` is an FNV-1a hash of the normalized question text, so reordering a file keeps progress but editing a question's text resets that question. Progress whose `version` doesn't match the quiz's `version` is ignored. Stored data is treated as untrusted (`sanitize` in `session.ts`). All storage access in `storage.ts` is wrapped in try/catch; the app must keep working when storage is unavailable.

**Mastery rule.** `REQUIRED_STREAK = 2` consecutive correct answers retires a question; a miss resets the streak. Next question is random from the unretired pool, never the same one twice in a row unless it's the last.

**Choices.** Up to 3 wrong answers sampled from the question's `distractors`; if fewer than 3, topped up from other questions' answers in the same `group` (or the whole quiz if no group). Minimum 2 choices total, enforced by validation.

**Terms.** `TERMS.md` is the only copy of the terms text; `screens/terms.ts` imports it with `?raw` and renders it as text (only `# ` headings and `**bold**` are interpreted, no innerHTML). Bump `TERMS_VERSION` there after a material change to re-prompt everyone.

## Tests

- `session`, `choices`, `quiz` tests: unit tests on the pure modules.
- `quizzes.test.ts`: validates every shipped quiz file.
- `app.test.ts`: `// @vitest-environment happy-dom` screen-level tests that drive the real UI through `startApp` (clicks, key events, timers, storage). Add coverage here for wiring changes (keys, screen transitions, auto-advance).

## Content rules

The repo and site are public (the site has `noindex`, which is not access control). Keep personal names and details out of quiz ids, titles, file names, commit messages, and PRs. Bump a quiz's `version` when a change would make saved progress misleading. The UI is deliberately plain text: no gamification, animation, sounds, or color-only meaning.

`scripts/convert_legacy.py` converts old quiz formats (YAML `Q/A/B/C/D`, legacy JSON, TSV) to the canonical JSON; `--merge` pools wrong answers from several versions of one quiz. YAML input needs `pyyaml`.

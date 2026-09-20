# QuizMe

Multiple-choice study quizzes that run in the browser. Static site, no accounts, no server; progress is kept in your own browser.

Live site: https://jffordem.github.io/QuizMe/

The design is in [QUIZ-GAME.md](QUIZ-GAME.md).

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

import { el, type Screen } from "../app";

/** Placeholder until the quiz engine lands. */
export const listScreen: Screen = (ctx) => {
  ctx.root.append(el("p", undefined, "No quizzes yet."));
};

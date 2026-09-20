// Mastery logic for one quiz. Pure: no DOM, no storage. Rule (QUIZ-GAME.md 5.2):
// answer a question right twice in a row and it is retired; a miss resets the
// streak and keeps it in the pool. The quiz is done when the pool is empty.
import { buildChoices, type Rng } from "./choices.ts";
import type { Question, Quiz } from "./quiz.ts";
import { questionKey } from "./text.ts";

/** Consecutive correct answers needed to retire a question. */
export const REQUIRED_STREAK = 2;

export interface QuestionProgress {
  streak: number;
  seen: number;
  missed: number;
  retired: boolean;
}

export interface QuizProgress {
  version: number;
  questions: Record<string, QuestionProgress>;
}

export interface AnswerResult {
  chosen: string;
  correct: boolean;
  correctAnswer: string;
  /** True if this answer retired the question. */
  retired: boolean;
}

function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Stored data is untrusted (it can be hand-edited or from an older build). */
function sanitize(stored: unknown): QuestionProgress {
  const s = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const retired = s.retired === true;
  return {
    streak: retired ? REQUIRED_STREAK : Math.min(count(s.streak), REQUIRED_STREAK - 1),
    seen: count(s.seen),
    missed: count(s.missed),
    retired,
  };
}

/** Stored progress only applies to the quiz version it was recorded against. */
function applicable(quiz: Quiz, stored: QuizProgress | null): QuizProgress | null {
  return stored !== null && stored.version === quiz.version ? stored : null;
}

/** True if there is saved progress that no longer applies because the quiz changed. */
export function progressIsStale(quiz: Quiz, stored: QuizProgress | null): boolean {
  return stored !== null && stored.version !== quiz.version;
}

/** True if the saved progress records any answers for this version of the quiz. */
export function hasProgress(quiz: Quiz, stored: QuizProgress | null): boolean {
  const progress = applicable(quiz, stored);
  if (!progress) return false;
  return quiz.questions.some((q) => {
    const p = sanitize(progress.questions[questionKey(q.q)]);
    return p.seen > 0 || p.retired;
  });
}

/** How many of a quiz's questions are retired in the given saved progress. */
export function masteredCount(quiz: Quiz, stored: QuizProgress | null): number {
  const progress = applicable(quiz, stored);
  if (!progress) return 0;
  return quiz.questions.filter((q) => sanitize(progress.questions[questionKey(q.q)]).retired).length;
}

export class Session {
  readonly quiz: Quiz;
  /** The question being asked, or null before next() / after the pool is empty. */
  current: Question | null = null;
  /** Shuffled choices for the current question. */
  choices: string[] = [];
  /** Result of the current question once answered; cleared by next(). */
  last: AnswerResult | null = null;

  private readonly state = new Map<Question, QuestionProgress>();
  private readonly rng: Rng;

  constructor(quiz: Quiz, stored: QuizProgress | null = null, rng: Rng = Math.random) {
    this.quiz = quiz;
    this.rng = rng;
    const progress = applicable(quiz, stored);
    for (const q of quiz.questions) {
      this.state.set(q, sanitize(progress?.questions[questionKey(q.q)]));
    }
  }

  get total(): number {
    return this.quiz.questions.length;
  }

  get mastered(): number {
    let n = 0;
    for (const p of this.state.values()) if (p.retired) n++;
    return n;
  }

  /** Streak of the current question (0 if none). */
  get streak(): number {
    return this.current ? this.progressOf(this.current).streak : 0;
  }

  /** Advance to a random unretired question, never the same one twice in a row. */
  next(): Question | null {
    this.last = null;
    const remaining = this.quiz.questions.filter((q) => !this.progressOf(q).retired);
    if (remaining.length === 0) {
      this.current = null;
      this.choices = [];
      return null;
    }
    const others = remaining.filter((q) => q !== this.current);
    const pool = others.length > 0 ? others : remaining;
    const picked = pool[Math.floor(this.rng() * pool.length)];
    this.current = picked;
    this.choices = buildChoices(picked, this.quiz.questions, this.rng);
    return picked;
  }

  /** Record an answer to the current question. Answering twice returns the first result. */
  answer(chosen: string): AnswerResult {
    if (this.last) return this.last;
    const question = this.current;
    if (!question) throw new Error("answer() called with no current question");

    const p = this.progressOf(question);
    const correct = chosen === question.answer;
    p.seen++;
    if (correct) {
      p.streak++;
      if (p.streak >= REQUIRED_STREAK) p.retired = true;
    } else {
      p.streak = 0;
      p.missed++;
    }

    this.last = { chosen, correct, correctAnswer: question.answer, retired: correct && p.retired };
    return this.last;
  }

  /** Questions missed at least once, most-missed first. */
  mostMissed(limit: number): { question: Question; missed: number }[] {
    return this.quiz.questions
      .map((question) => ({ question, missed: this.progressOf(question).missed }))
      .filter((entry) => entry.missed > 0)
      .sort((a, b) => b.missed - a.missed)
      .slice(0, limit);
  }

  toProgress(): QuizProgress {
    const questions: Record<string, QuestionProgress> = {};
    for (const q of this.quiz.questions) {
      questions[questionKey(q.q)] = { ...this.progressOf(q) };
    }
    return { version: this.quiz.version, questions };
  }

  private progressOf(question: Question): QuestionProgress {
    const p = this.state.get(question);
    if (!p) throw new Error("question does not belong to this quiz");
    return p;
  }
}

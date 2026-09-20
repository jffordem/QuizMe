// Thin wrapper over localStorage. Every access is wrapped in try/catch because
// storage can be missing or throw (private windows, managed devices). The app
// must keep working without it; it just won't remember anything.
import type { QuizProgress } from "./session.ts";

const PREFIX = "quizme.";

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage unavailable or full: carry on without persisting.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

export function getTermsAccepted(): string | null {
  return read("termsAccepted");
}

export function setTermsAccepted(version: string): void {
  write("termsAccepted", version);
}

/** Saved progress for a quiz, or null if none (or unreadable). */
export function loadProgress(quizId: string): QuizProgress | null {
  const raw = read(`progress.${quizId}`);
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as QuizProgress).version === "number" &&
      typeof (data as QuizProgress).questions === "object" &&
      (data as QuizProgress).questions !== null
    ) {
      return data as QuizProgress;
    }
  } catch {
    // Corrupt entry: treat as no progress.
  }
  return null;
}

export function saveProgress(quizId: string, progress: QuizProgress): void {
  write(`progress.${quizId}`, JSON.stringify(progress));
}

export function clearProgress(quizId: string): void {
  remove(`progress.${quizId}`);
}

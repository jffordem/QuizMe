// Thin wrapper over localStorage. Every access is wrapped in try/catch because
// storage can be missing or throw (private windows, managed devices). The app
// must keep working without it; it just won't remember anything.

const PREFIX = "quizme.";

export function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage unavailable or full: carry on without persisting.
  }
}

export function remove(key: string): void {
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

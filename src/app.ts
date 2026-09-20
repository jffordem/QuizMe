// Minimal screen plumbing. A screen is a function that builds its own DOM into
// ctx.root. ctx.show() swaps screens; anything scheduled with ctx.later() or
// registered with ctx.keys() is dropped when the screen changes, so a stale
// timer or key handler can never act on a screen that is no longer showing.

export type KeyHandler = (e: KeyboardEvent) => void;
export type Screen = (ctx: Ctx) => void;

export interface Ctx {
  root: HTMLElement;
  show(screen: Screen): void;
  keys(handler: KeyHandler | null): void;
  later(fn: () => void, ms: number): void;
}

export function createApp(root: HTMLElement): { ctx: Ctx; current(): Screen | null; dispose(): void } {
  let epoch = 0;
  let currentScreen: Screen | null = null;
  let keyHandler: KeyHandler | null = null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    keyHandler?.(e);
  };
  window.addEventListener("keydown", onKeyDown);

  const ctx: Ctx = {
    root,
    show(screen) {
      epoch++;
      keyHandler = null;
      currentScreen = screen;
      root.replaceChildren();
      screen(ctx);
    },
    keys(handler) {
      keyHandler = handler;
    },
    later(fn, ms) {
      const mine = epoch;
      window.setTimeout(() => {
        if (mine === epoch) fn();
      }, ms);
    },
  };

  return { ctx, current: () => currentScreen, dispose: () => window.removeEventListener("keydown", onKeyDown) };
}

/** Small DOM helper: element with optional class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

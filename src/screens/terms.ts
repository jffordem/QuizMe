// Terms & Disclaimer. TERMS.md is the single source of the text; it is imported
// at build time and rendered as plain text (no innerHTML).
import terms from "../../TERMS.md?raw";
import { el, type Screen } from "../app";
import { getTermsAccepted, setTermsAccepted } from "../storage";

/** Bump when TERMS.md changes materially, so everyone is asked to accept again. */
export const TERMS_VERSION = "1";

export function termsAccepted(): boolean {
  return getTermsAccepted() === TERMS_VERSION;
}

/** Render a line, turning **bold** into <strong>. Nothing else is interpreted. */
function inline(parent: HTMLElement, text: string): void {
  text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (i % 2 === 1) parent.append(el("strong", undefined, part));
    else if (part) parent.append(part);
  });
}

function renderText(parent: HTMLElement): void {
  for (const block of terms.trim().split(/\n\s*\n/)) {
    if (block.startsWith("# ")) {
      parent.append(el("h2", undefined, block.slice(2)));
    } else {
      const p = el("p");
      inline(p, block);
      parent.append(p);
    }
  }
}

/** First-visit gate: nothing else is usable until the terms are accepted. */
export function acceptTermsScreen(onAccepted: Screen): Screen {
  return (ctx) => {
    const box = el("section", "terms");
    renderText(box);

    const accept = el("button", "primary", "I understand — continue");
    const proceed = () => {
      setTermsAccepted(TERMS_VERSION);
      ctx.show(onAccepted);
    };
    accept.addEventListener("click", proceed);
    ctx.keys((e) => {
      // A focused button handles Enter itself via its click event.
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) proceed();
    });

    ctx.root.append(box, accept);
    accept.focus();
  };
}

/** Footer re-read: same text, with a Close button back to where you were. */
export function readTermsScreen(back: Screen): Screen {
  return (ctx) => {
    const box = el("section", "terms");
    renderText(box);

    const close = el("button", "primary", "Close");
    const leave = () => ctx.show(back);
    close.addEventListener("click", leave);
    ctx.keys((e) => {
      if (e.key === "Escape") leave();
    });

    ctx.root.append(box, close);
    close.focus();
  };
}

import "./styles.css";
import { createApp } from "./app";
import { listScreen } from "./screens/list";
import { acceptTermsScreen, readTermsScreen, termsAccepted } from "./screens/terms";

const root = document.getElementById("screen");
if (!root) throw new Error("#screen missing from index.html");

const { ctx, current } = createApp(root);

// Footer link reopens the terms, then returns to whatever screen was showing.
document.getElementById("terms-link")?.addEventListener("click", () => {
  const back = current();
  if (back) ctx.show(readTermsScreen(back));
});

ctx.show(termsAccepted() ? listScreen : acceptTermsScreen(listScreen));

import "./styles.css";
import { startApp } from "./flow.ts";
import { loadLibrary } from "./library.ts";

const root = document.getElementById("screen");
if (!root) throw new Error("#screen missing from index.html");

startApp(root, document.getElementById("terms-link"), loadLibrary());

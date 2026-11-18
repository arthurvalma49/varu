import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/familjen-grotesk/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./index.css";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Offline support. Fails quietly where service workers aren't allowed (e.g. embedded previews).
if ("serviceWorker" in navigator) {
  try {
    registerSW({ immediate: true, onRegisterError: () => {} });
  } catch {
    /* ignore */
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

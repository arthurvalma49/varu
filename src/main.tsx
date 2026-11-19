import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { applyAccent } from "./ui/accent";

applyAccent();
import { registerSW } from "virtual:pwa-register";

// Offline support. Fails quietly where service workers aren't allowed (e.g. embedded previews).
if ("serviceWorker" in navigator) {
  try {
    registerSW({ immediate: true, onRegisterError: () => {} });
  } catch {
    /* ignore */
  }
}

// iOS Safari only applies :active (touch highlight) when a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

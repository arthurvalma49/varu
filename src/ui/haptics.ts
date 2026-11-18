/**
 * A light tap of haptic feedback, the web's closest thing to iOS UIImpactFeedbackGenerator.
 * Android: Vibration API. iOS (18+): toggling a hidden native switch makes Safari play the
 * system switch haptic. Must run inside a user gesture; silently does nothing elsewhere.
 */
let label: HTMLLabelElement | null = null;

export function haptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
      return;
    }
    if (typeof document === "undefined") return;
    if (!label) {
      label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      label.appendChild(input);
      document.body.appendChild(label);
    }
    label.click();
  } catch {
    /* no haptics here */
  }
}

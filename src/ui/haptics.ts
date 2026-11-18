/**
 * A light haptic tap. Android: Vibration API. iOS 18+: Safari has no vibration API, but it plays
 * the system haptic when a native switch (<input type="checkbox" switch>) is toggled through its
 * label, so we create one, click it and remove it (the approach of the ios-haptics library).
 * Only works inside a tap or click handler. The app's own switches are real native switches,
 * so they get the haptic directly.
 */
const isIOS =
  typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function haptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
      return;
    }
    if (!isIOS || typeof document === "undefined") return;
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    document.head.removeChild(label);
  } catch {
    /* no haptics here */
  }
}

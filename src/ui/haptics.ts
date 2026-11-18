/**
 * Haptics.
 * iOS Safari has no vibration API. It does play the system haptic when the user's own tap flips a
 * native switch (<input type="checkbox" switch>), so `HapticButton` in kit.tsx hides one inside
 * the tapped element. Flipping it from code does not work (tested on device).
 * Android: the Vibration API, called from here.
 */
export function haptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(10);
  } catch {
    /* no haptics here */
  }
}

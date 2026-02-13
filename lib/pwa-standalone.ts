/**
 * Detect if the app is running as an installed PWA (standalone).
 * Used to hide install prompts and show correct UI.
 * iOS: navigator.standalone is true when launched from home screen (Safari).
 * Android/Desktop: display-mode: standalone.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Standard PWA display mode (Android, desktop, some iOS)
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari: standalone is true when opened from home screen
  const nav = window.navigator as unknown as Record<string, unknown>;
  if (nav["standalone"] === true) return true;
  const n = window.navigator as unknown as { standalone?: boolean };
  if (n && n.standalone === true) return true;
  return false;
}

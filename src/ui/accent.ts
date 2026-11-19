/** App accent colour. Stored per device; cyan is the one being tried now. */
export const ACCENTS = [
  { id: "blue", name: "Sinine", swatch: "#0a84ff" },
  { id: "cyan", name: "Tsüaan", swatch: "#3cd3fe" },
  { id: "mint", name: "Münt", swatch: "#63e6e2" },
  { id: "indigo", name: "Indigo", swatch: "#7d7aff" },
  { id: "purple", name: "Lilla", swatch: "#bf5af2" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

const KEY = "varu:accent";
export const DEFAULT_ACCENT: AccentId = "cyan";

export function getAccent(): AccentId {
  try {
    const v = localStorage.getItem(KEY);
    if (ACCENTS.some((a) => a.id === v)) return v as AccentId;
  } catch {
    /* default */
  }
  return DEFAULT_ACCENT;
}

export function applyAccent(id: AccentId = getAccent()) {
  if (id === "blue") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = id;
}

export function setAccent(id: AccentId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* still applies for this session */
  }
  applyAccent(id);
}

const SMALL = new Set(["and", "or", "of", "the", "a", "an", "to", "in", "for", "on", "at", "by"]);
/** Turns ALL-CAPS Drive names into Title Case; other names are left untouched. */
export function niceName(name: string): string {
  if (!/[A-Z]/.test(name) || name !== name.toUpperCase()) return name;
  return name.toLowerCase().split(/(\s+)/).map((w, i) =>
    /^\s+$/.test(w) || (i > 0 && SMALL.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

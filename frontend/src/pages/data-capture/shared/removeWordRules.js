// One word of Remove Word: upper case, Excel's quotes dropped. A leading "=" (exact mode: only a whole word that equals
// it is removed) is kept in front.
function cleanWord(part) {
  let w = part.trim().replace(/^'+|'+$/g, "").trim();
  const exact = w.startsWith("=");
  if (exact) w = w.slice(1).trim().replace(/^'+|'+$/g, "").trim();
  return w ? (exact ? "=" : "") + w.toUpperCase() : "";
}

/** "free; bonus,,Free" -> "FREE,BONUS": words split on comma / semicolon, upper case, no empty ones, no repeats. */
export function normalizeRemoveWords(value) {
  return [...new Set(String(value ?? "").split(/[,;]+/).map(cleanWord).filter(Boolean))].join(",");
}

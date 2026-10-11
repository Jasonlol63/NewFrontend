// Limits and labels of the sheet. Plain module (no aliases), so the paste modules and their tests run in Node too.
export const MAX_GRID_ROWS = 702; // A..ZZ
export const MAX_GRID_COLS = 50;

// Row letters: 0 -> A ... 25 -> Z, 26 -> AA ... 701 -> ZZ
export function rowLetter(i) {
  let out = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) out = String.fromCharCode(65 + (n % 26)) + out;
  return out;
}

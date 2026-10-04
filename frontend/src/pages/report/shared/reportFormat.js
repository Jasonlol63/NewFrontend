// Report amounts: 2 decimals (half up), thousands separators, and anything below 0.005 shows as 0.00.
// Works on the decimal string so large amounts keep every digit.
export function formatAmount(value) {
  let raw = String(value ?? "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return "0.00";
    raw = n.toFixed(8);
  }
  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace("-", "").split(".");
  let cents = BigInt(whole + (fraction + "00").slice(0, 2));
  if (fraction.length > 2 && fraction[2] >= "5") cents += 1n;
  if (cents === 0n) return "0.00";
  const digits = cents.toString().padStart(3, "0");
  const grouped = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${digits.slice(-2)}`;
}

export const WIN_CLASS = "font-bold text-[#172a9f]";
export const LOSE_CLASS = "font-bold text-[#b91c1c]";

// Win/Lose column: blue when above 0, red when below, plain at 0.
export function signClass(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "font-bold";
  return n > 0 ? WIN_CLASS : LOSE_CLASS;
}

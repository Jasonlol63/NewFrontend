import { formatMoney } from "@/lib/money";

// Report amounts: 2 decimals (half up) with thousands separators, worked on the decimal string.
export const formatAmount = formatMoney;

export const WIN_CLASS = "font-semibold text-[#172a9f]";
export const LOSE_CLASS = "font-semibold text-[#b91c1c]";

// Win/Lose column: blue when above 0, red when below, plain at 0.
export function signClass(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "font-semibold";
  return n > 0 ? WIN_CLASS : LOSE_CLASS;
}

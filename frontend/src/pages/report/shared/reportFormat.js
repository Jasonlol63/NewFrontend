import { formatMoney, moneySign } from "@/lib/money";

// Report amounts: 2 decimals (half up) with thousands separators, worked on the decimal string.
export const formatAmount = formatMoney;

export const WIN_CLASS = "font-semibold text-[#172a9f]";
export const LOSE_CLASS = "font-semibold text-[#b91c1c]";

// Win/Lose column: blue when above 0, red when below, plain only at a real 0. The raw value decides (like Transaction
// Payment): 0.002586 shows 0.00 but stays blue.
export function signClass(value) {
  const sign = moneySign(value);
  return sign > 0 ? WIN_CLASS : sign < 0 ? LOSE_CLASS : "font-semibold";
}

import { useMemo } from "react";
import { useSavedOrder } from "@/hooks/useSavedState";

/**
 * Currency chips in the order the user dragged them into, kept in the browser and shared by every
 * page with a Currency row (Dashboard, Customer Report). Returns [options, setOrder]:
 *  - options: [{ value, label }] for SegmentGroup, dragged order first; currencies that were never
 *    dragged keep their default order after it;
 *  - setOrder: pass it to SegmentGroup's onReorder.
 */
export function useOrderedCurrencies(codes) {
  // Same key the Dashboard has always used, so an order dragged there carries over.
  const [order, setOrder] = useSavedOrder("dashboard.currencyOrder");
  const options = useMemo(() => {
    const ordered = [...order.filter((code) => codes.includes(code)), ...codes.filter((code) => !order.includes(code))];
    return ordered.map((code) => ({ value: code, label: code }));
  }, [codes, order]);
  return [options, setOrder];
}

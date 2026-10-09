import { useState } from "react";
import { useListScope } from "@/components/shared/list/useListScope";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { toIsoDate } from "@/lib/date";
import { useCurrencyOptions } from "@/pages/dashboard/useDashboardData";

/**
 * Filters of the Maintenance pages that have a Currency row (Payment, Bank Process): Group / Company,
 * Date Range (today), search text, and the Currency: "ALL" or one code, with the chips in the order
 * the user dragged them into (shared with the Dashboard). Starts on MYR when the company has it,
 * else its first currency. onChange runs after any filter change, e.g. to clear a row selection.
 */
export function useCurrencyFilters({ onChange } = {}) {
  const [currencyPick, setCurrencyPick] = useState(null);
  const [search, setSearch] = useState("");
  const [range, setRangeState] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope({ onChange });
  const { tenantId } = scope;

  const currencyCodes = useCurrencyOptions(tenantId ? [tenantId] : []);
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(currencyCodes);
  const currency =
    currencyPick === "ALL" || currencyCodes.includes(currencyPick)
      ? currencyPick
      : currencyCodes.includes("MYR")
        ? "MYR"
        : (currencyCodes[0] ?? null);

  return {
    scope,
    tenantId,
    search,
    setSearch,
    range,
    setRange: (value) => {
      setRangeState(value);
      onChange?.();
    },
    currency,
    currencyCodes,
    currencyOptions,
    setCurrencyOrder,
    setCurrency: (value) => {
      setCurrencyPick(value);
      onChange?.();
    },
  };
}

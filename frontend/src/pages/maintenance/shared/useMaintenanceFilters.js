import { useMemo, useState } from "react";
import { useListScope } from "@/components/shared/list/useListScope";
import { toIsoDate } from "@/lib/date";
import { processOptions } from "@/pages/report/domain/domainReportRules";
import { useProcesses } from "@/pages/report/domain/useProcesses";

// The Maintenance API words the categories "games" / "bank".
export function buildMaintenanceRequest({ tenantId, dateFrom, dateTo, processId, isGroupOwn }) {
  return {
    tenantId,
    ...(dateFrom ? { dateFrom, dateTo } : {}),
    process: processId === "" ? null : String(processId),
    category: isGroupOwn ? "bank" : "games",
  };
}

/**
 * Filters shared by the Maintenance pages: Group / Company, Process, Date Range and the search text.
 * `request` is the body of the list call (null until there is something to ask).
 * dated: false drops the Date Range (config lists such as Formula): no `range`, no dates in the request.
 * onChange runs when Group / Company, Process or the dates change, e.g. to clear a row selection.
 */
export function useMaintenanceFilters(storageKey, { onChange, dated = true } = {}) {
  const [processPick, setProcessPick] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRangeState] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope(storageKey, {
    onChange: () => {
      setProcessPick("");
      onChange?.();
    },
  });
  const { tenantId } = scope;
  // company null = the Group's own data.
  const isGroupOwn = Boolean(tenantId) && scope.company === null;

  const { processes, error: processError } = useProcesses(tenantId);
  const processChoices = useMemo(() => processOptions(processes, isGroupOwn), [processes, isGroupOwn]);
  // A Group has no "All Process": it starts on its first process.
  const processId = processChoices.some((o) => o.value === processPick) ? processPick : (processChoices[0]?.value ?? "");

  const request = useMemo(
    () =>
      tenantId && (processId !== "" || !isGroupOwn)
        ? buildMaintenanceRequest({
            tenantId,
            dateFrom: dated ? range.from : null,
            dateTo: dated ? range.to : null,
            processId,
            isGroupOwn,
          })
        : null,
    [tenantId, dated, range, processId, isGroupOwn]
  );

  return {
    scope,
    isGroupOwn,
    processChoices,
    processId,
    setProcessPick: (value) => {
      setProcessPick(value);
      onChange?.();
    },
    search,
    setSearch,
    range: dated ? range : null,
    setRange: (value) => {
      setRangeState(value);
      onChange?.();
    },
    request,
    error: scope.error || processError,
  };
}

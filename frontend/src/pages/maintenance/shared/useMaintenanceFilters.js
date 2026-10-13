import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useListScope } from "@/components/shared/list/useListScope";
import { useSession } from "@/context/session";
import { BANK_PROCESSES, usesBankForm } from "@/pages/data-capture/shared/dataCaptureRules";
import { toIsoDate } from "@/lib/date";
import { processOptions } from "@/pages/report/domain/domainReportRules";
import { useProcesses } from "@/pages/report/domain/useProcesses";

// The Maintenance API words the categories "games" / "bank". A process is sent as its code ("PROFIT") or its id.
export function buildMaintenanceRequest({ tenantId, dateFrom, dateTo, processId, bankForm }) {
  return {
    tenantId,
    ...(dateFrom ? { dateFrom, dateTo } : {}),
    process: processId === "" ? null : String(processId),
    category: bankForm ? "bank" : "games",
  };
}

/**
 * Filters shared by the Maintenance pages: Group / Company, Process, Date Range and the search text.
 * Process: a Bank-form scope (Group own data, C168, a company with a Bank: the same rule as Data Capture) always offers
 * All Process and the four fixed codes PROFIT / SALARY / COMMISSION / BONUS, whether or not any capture exists yet, and asks
 * for category "bank". Any other company lists the processes the backend has for it.
 * `request` is the body of the list call (null until there is something to ask).
 * dated: false drops the Date Range (config lists such as Formula): no `range`, no dates in the request.
 * onChange runs when Group / Company, Process or the dates change, e.g. to clear a row selection.
 */
export function useMaintenanceFilters({ onChange, dated = true } = {}) {
  const { t } = useTranslation("report");
  // null = nothing picked yet: the user chooses All Process or one process before any list loads.
  const [processPick, setProcessPick] = useState(null);
  const [search, setSearch] = useState("");
  const [range, setRangeState] = useState(() => {
    const today = toIsoDate(new Date());
    return { from: today, to: today };
  });

  const scope = useListScope({
    onChange: () => {
      setProcessPick(null);
      onChange?.();
    },
  });
  const { tenantId } = scope;
  // usesBankForm reads the c168 / bank flags that only the raw session user carries (useCurrentUser strips them).
  const { user } = useSession();
  // company null = the Group's own data.
  const isGroupOwn = Boolean(tenantId) && scope.company === null;
  const bankForm = Boolean(tenantId) && usesBankForm(user, scope);

  const { processes, error: processError } = useProcesses(tenantId);
  const processChoices = useMemo(
    () => (bankForm ? [{ value: "", label: t("allProcess") }, ...BANK_PROCESSES] : processOptions(processes, false, t("allProcess"))),
    [bankForm, processes, t]
  );
  // A pick that no longer exists (other Group / Company) counts as none.
  const processSelected = processChoices.some((o) => o.value === processPick);
  const processId = processSelected ? processPick : null;

  const request = useMemo(
    () =>
      tenantId && processSelected
        ? buildMaintenanceRequest({
            tenantId,
            dateFrom: dated ? range.from : null,
            dateTo: dated ? range.to : null,
            processId,
            bankForm,
          })
        : null,
    [tenantId, dated, range, processId, processSelected, bankForm]
  );

  return {
    scope,
    isGroupOwn,
    bankForm,
    processChoices,
    processId,
    processSelected,
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

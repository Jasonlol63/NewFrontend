import { useMemo } from "react";
import { useSavedState } from "@/hooks/useSavedState";
import { useTenantDirectory } from "@/pages/dashboard/useDashboardData";

// Companies that belong to no Group are listed under this pseudo-group.
const INDEPENDENT = "__independent__";

function companiesOf(directory, group) {
  if (!directory) return [];
  return directory.companies.filter((c) => (group === INDEPENDENT ? !c.groupCode : c.groupCode === group));
}

function groupTenantId(directory, group) {
  return directory?.groups.find((g) => g.code === group)?.tenantId ?? null;
}

// company null = the Group's own data, only offered when allowGroupItself and the Group can be opened.
function canUseGroupItself(directory, group, allowGroupItself) {
  return allowGroupItself && Boolean(groupTenantId(directory, group));
}

function defaultCompany(directory, group, allowGroupItself) {
  const first = companiesOf(directory, group)[0]?.code;
  if (first) return first;
  return canUseGroupItself(directory, group, allowGroupItself) ? null : undefined;
}

// The saved Group / Company are used only while they still exist for this login.
function resolveSelection(directory, saved, allowGroupItself) {
  if (!directory) return { group: null, company: undefined };
  const groupCodes = [
    ...directory.groups.map((g) => g.code),
    ...(directory.companies.some((c) => !c.groupCode) ? [INDEPENDENT] : []),
  ];
  const group = groupCodes.includes(saved?.group) ? saved.group : (groupCodes[0] ?? null);
  const c = saved?.group === group ? saved.company : undefined;
  const companyOk =
    c === null
      ? canUseGroupItself(directory, group, allowGroupItself)
      : companiesOf(directory, group).some((x) => x.code === c);
  return { group, company: companyOk ? c : defaultCompany(directory, group, allowGroupItself) };
}

/**
 * Group / Company pickers of a list page and the tenant they point at, remembered per user.
 *  - allowGroupItself: clicking the active company again shows the Group's own data (Admin users).
 *    Pages whose API only takes a Company tenant (Accounts) leave it off.
 *  - onChange runs after every pick, e.g. to reset paging and the selection.
 */
export function useListScope(storageKey, { allowGroupItself = false, onChange } = {}) {
  const { directory: loadedDirectory, error } = useTenantDirectory();
  const [saved, setSaved, savedReady] = useSavedState(storageKey);
  const directory = savedReady ? loadedDirectory : null;
  const { group, company } = useMemo(
    () => resolveSelection(directory, saved, allowGroupItself),
    [directory, saved, allowGroupItself]
  );

  const tenantId = company
    ? (companiesOf(directory, group).find((c) => c.code === company)?.tenantId ?? null)
    : company === null
      ? groupTenantId(directory, group)
      : null;

  const groupOptions = useMemo(() => {
    if (!directory) return [];
    const list = directory.groups.map((g) => ({ value: g.code, label: g.code }));
    if (directory.companies.some((c) => !c.groupCode)) list.push({ value: INDEPENDENT, label: "Independent" });
    return list;
  }, [directory]);
  const companyOptions = useMemo(
    () => companiesOf(directory, group).map((c) => ({ value: c.code, label: c.code })),
    [directory, group]
  );

  const save = (next) => {
    setSaved({ group, company, ...next });
    onChange?.();
  };

  return {
    tenantId,
    group,
    company: company ?? null,
    groupOptions,
    companyOptions,
    allowNoCompany: canUseGroupItself(directory, group, allowGroupItself),
    onGroupChange: (next) => save({ group: next, company: defaultCompany(directory, next, allowGroupItself) }),
    onCompanyChange: (next) => save({ company: next }),
    loading: !directory && !error,
    error,
  };
}

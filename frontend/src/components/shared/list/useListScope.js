import { useMemo } from "react";
import { currentLoginStamp, useSavedState } from "@/hooks/useSavedState";
import {
  companiesInGroup as companiesOf,
  firstOpenableGroup,
  hasIndependentCompanies,
  INDEPENDENT,
  loginSelection,
  useTenantDirectory,
} from "@/pages/dashboard/useDashboardData";

function groupTenantId(directory, group) {
  return directory?.groups.find((g) => g.code === group)?.tenantId ?? null;
}

// company null = the Group's own data, only offered when the Group can be opened.
function canUseGroupItself(directory, group) {
  return Boolean(groupTenantId(directory, group));
}

function defaultCompany(directory, group) {
  const first = companiesOf(directory, group)[0]?.code;
  if (first) return first;
  return canUseGroupItself(directory, group) ? null : undefined;
}

// A fresh login starts from the Company / Group logged in with; within the same login the saved
// Group / Company win. Either is used only while it still exists for this login.
function resolveSelection(directory, saved) {
  if (!directory) return { group: null, company: undefined };
  const pick = saved && (saved.loginStamp ?? null) === currentLoginStamp() ? saved : loginSelection(directory);
  const groupCodes = [
    ...directory.groups.map((g) => g.code),
    ...(hasIndependentCompanies(directory) ? [INDEPENDENT] : []),
  ];
  const group = groupCodes.includes(pick?.group) ? pick.group : (groupCodes[0] ?? null);
  const c = pick?.group === group ? pick.company : undefined;
  const companyOk =
    c === null ? canUseGroupItself(directory, group) : companiesOf(directory, group).some((x) => x.code === c);
  return { group, company: companyOk ? c : defaultCompany(directory, group) };
}

/**
 * Group / Company pickers of a list page (Admin users, Accounts) and the tenant they point at,
 * remembered per user. Clicking the active chip again switches:
 *  - active Group -> the independent companies (companies in no Group), when there are any;
 *  - active company in a Group -> the Group's own data;
 *  - active independent company -> the first Group this login can open, on its own data.
 * onChange runs after every pick, e.g. to reset paging and the selection.
 */
export function useListScope(storageKey, { onChange } = {}) {
  const { directory: loadedDirectory, error } = useTenantDirectory();
  const [saved, setSaved, savedReady] = useSavedState(storageKey);
  const directory = savedReady ? loadedDirectory : null;
  const { group, company } = useMemo(() => resolveSelection(directory, saved), [directory, saved]);

  const tenantId = company
    ? (companiesOf(directory, group).find((c) => c.code === company)?.tenantId ?? null)
    : company === null
      ? groupTenantId(directory, group)
      : null;

  const hasIndependent = hasIndependentCompanies(directory);
  const switchGroup = group === INDEPENDENT ? firstOpenableGroup(directory) : null;
  const groupOptions = useMemo(
    () => (directory?.groups ?? []).map((g) => ({ value: g.code, label: g.code })),
    [directory]
  );
  const companyOptions = useMemo(
    () => companiesOf(directory, group).map((c) => ({ value: c.code, label: c.code })),
    [directory, group]
  );

  const save = (next) => {
    setSaved({ group, company, loginStamp: currentLoginStamp(), ...next });
    onChange?.();
  };
  const pickGroup = (picked) => {
    const next = picked ?? INDEPENDENT;
    save({ group: next, company: defaultCompany(directory, next) });
  };
  const pickCompany = (next) => {
    // The Group opens on its own data; the user picks a company from there.
    if (next === null && group === INDEPENDENT) save({ group: switchGroup, company: null });
    else save({ company: next });
  };

  return {
    tenantId,
    group,
    company: company ?? null,
    groupOptions,
    // One Group with independent companies still needs its chip, to switch between the two.
    showGroups: groupOptions.length > 1 || (groupOptions.length > 0 && hasIndependent),
    allowNoGroup: group !== INDEPENDENT && hasIndependent,
    companyOptions,
    allowNoCompany: group === INDEPENDENT ? Boolean(switchGroup) : canUseGroupItself(directory, group),
    onGroupChange: pickGroup,
    onCompanyChange: pickCompany,
    loading: !directory && !error,
    error,
  };
}

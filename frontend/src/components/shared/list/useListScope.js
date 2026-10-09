import { useMemo, useRef, useState } from "react";
import { useSession } from "@/context/session";
import {
  companiesInGroup as companiesOf,
  firstOpenableGroup,
  hasIndependentCompanies,
  INDEPENDENT,
  loginSelection,
  sessionSelection,
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

// The selection is the company the session is in right now (the one the sidebar follows). It is
// used only while it still exists for this login.
function resolveSelection(directory, tenantId) {
  if (!directory) return { group: null, company: undefined };
  const pick = sessionSelection(directory, tenantId) ?? loginSelection(directory);
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
 * Group / Company pickers of a list page (Admin users, Accounts) and the tenant they point at.
 * They show the company the session is in, and picking one switches the whole session to it
 * (/auth/switch-tenant), so the sidebar and every other page follow. Clicking the active chip
 * again switches:
 *  - active Group -> the independent companies (companies in no Group), when there are any;
 *  - active company in a Group -> the Group's own data;
 *  - active independent company -> the first Group this login can open, on its own data.
 * onChange runs after every successful pick, e.g. to reset paging and the selection.
 */
export function useListScope({ onChange } = {}) {
  const { directory: loadedDirectory, error: directoryError } = useTenantDirectory();
  const { user, switchCompany } = useSession();
  const [switchError, setSwitchError] = useState("");
  const switching = useRef(false);
  // Hold back until the session (and so its company) is known, so the defaults never flash.
  const directory = user ? loadedDirectory : null;
  const sessionTenantId = user?.tenant_id ?? null;
  const { group, company } = useMemo(
    () => resolveSelection(directory, sessionTenantId),
    [directory, sessionTenantId]
  );
  const error = directoryError || switchError;

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

  // Switch the session to the picked company, then let the page reset. The selection above
  // follows the session, so it only moves once the switch has gone through.
  const save = async (next) => {
    const target = { group, company, ...next };
    const id = target.company
      ? (companiesOf(directory, target.group).find((c) => c.code === target.company)?.tenantId ?? null)
      : target.company === null
        ? groupTenantId(directory, target.group)
        : null;
    if (!id || switching.current) return;
    if (id !== sessionTenantId) {
      switching.current = true;
      try {
        await switchCompany(id);
        setSwitchError("");
      } catch (err) {
        setSwitchError(err.message);
        return;
      } finally {
        switching.current = false;
      }
    }
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

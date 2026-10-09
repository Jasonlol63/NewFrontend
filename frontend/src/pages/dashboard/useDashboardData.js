import { useEffect, useState } from "react";
import { getJson, postForm } from "@/lib/api";
import { loadSessionUser } from "@/hooks/useSavedState";

export const ALL = "ALL";
// Companies that belong to no Group. They have no chip of their own: deselecting the active
// Group switches to them.
export const INDEPENDENT = "__independent__";

// ---------------------------------------------------------------------------
// Accessible tenants -> Group / Company directory
// ---------------------------------------------------------------------------

// loginTenant: code of the Company / Group the user logged in with, picked when nothing is saved.
function buildDirectory(rows, loginTenant) {
  const groups = new Map();
  const companies = [];
  for (const row of rows) {
    const code = row.tenant_code;
    if (!code) continue;
    if (row.tenant_type === "GROUP") {
      groups.set(code, { code, tenantId: row.tenant_id });
    } else {
      companies.push({ code, tenantId: row.tenant_id, groupCode: row.parent_tenant_code || null });
      // A company can point at a Group whose own ledger this login can't open: still list it
      // for navigation, just without a tenantId (so its "Group view" can't be requested).
      if (row.parent_tenant_code && !groups.has(row.parent_tenant_code)) {
        groups.set(row.parent_tenant_code, { code: row.parent_tenant_code, tenantId: null });
      }
    }
  }
  const byCode = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true });
  return { groups: [...groups.values()].sort(byCode), companies: companies.sort(byCode), loginTenant: loginTenant || null };
}

export function useTenantDirectory() {
  const [state, setState] = useState({ directory: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getJson("/auth/tenant-accessible", { all: 1 }, { signal: controller.signal }), loadSessionUser()])
      .then(([body, user]) => setState({ directory: buildDirectory(body.data || [], user?.tenant_code), error: "" }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ directory: null, error: err.message });
      });
    return () => controller.abort();
  }, []);

  return state;
}

export function companiesInGroup(directory, groupCode) {
  if (!directory) return [];
  if (groupCode === ALL) return directory.companies;
  if (groupCode === INDEPENDENT) return directory.companies.filter((c) => !c.groupCode);
  return directory.companies.filter((c) => c.groupCode === groupCode);
}

export function hasIndependentCompanies(directory) {
  return Boolean(directory?.companies.some((c) => !c.groupCode));
}

// The Group / Company the user logged in with, as a filter selection; null if it isn't listed.
// For a Group login only the group is set, the page picks its default company.
export function loginSelection(directory) {
  const code = directory?.loginTenant;
  if (!code) return null;
  const company = directory.companies.find((c) => c.code === code);
  if (company) return { group: company.groupCode ?? INDEPENDENT, company: company.code };
  return directory.groups.some((g) => g.code === code) ? { group: code } : null;
}

// The Group / Company the session is in right now (the one the sidebar follows), as a filter
// selection. company null = a Group's own view. Null if the session tenant isn't listed.
export function sessionSelection(directory, tenantId) {
  if (!directory || !tenantId) return null;
  const company = directory.companies.find((c) => c.tenantId === tenantId);
  if (company) return { group: company.groupCode ?? INDEPENDENT, company: company.code };
  const group = directory.groups.find((g) => g.tenantId === tenantId);
  return group ? { group: group.code, company: null } : null;
}

// First Group this login can open (owned, or granted Group access); null when there is none.
export function firstOpenableGroup(directory) {
  return directory?.groups.find((g) => g.tenantId)?.code ?? null;
}

// Whether "no company selected" (= the Group's own view) is a valid choice for this group.
export function canViewGroupItself(directory, groupCode) {
  if (!directory || groupCode === INDEPENDENT) return false;
  if (groupCode === ALL) return directory.groups.some((g) => g.tenantId);
  return Boolean(directory.groups.find((g) => g.code === groupCode)?.tenantId);
}

// ---------------------------------------------------------------------------
// Scope: which of the four Spring endpoint families the filters map to
// ---------------------------------------------------------------------------

const ENDPOINTS = {
  company: ["/api/dashboard/kpi", "/api/dashboard/chart", "/api/dashboard/kpi/currency-breakdown"],
  group: ["/api/dashboard/group-kpi", "/api/dashboard/chart-group", "/api/dashboard/group-kpi/currency-breakdown"],
  companyAll: ["/api/dashboard/kpi-all", "/api/dashboard/chart-all", "/api/dashboard/kpi-all/currency-breakdown"],
  groupAll: [
    "/api/dashboard/kpi-all-groups",
    "/api/dashboard/chart-all-groups",
    "/api/dashboard/kpi-all-groups/currency-breakdown",
  ],
};

const ids = (list) => list.map((t) => t.tenantId).filter(Boolean);

// company: null = Group's own view, ALL = every company in the group, otherwise a company code.
export function resolveScope(directory, groupCode, companyCode) {
  if (!directory) return null;
  const members = companiesInGroup(directory, groupCode);

  if (companyCode && companyCode !== ALL) {
    const company = members.find((c) => c.code === companyCode);
    if (!company) return null;
    return { kind: "company", params: { tenant_id: company.tenantId }, tenantIds: [company.tenantId] };
  }

  if (companyCode === ALL) {
    const tenantIds = ids(members);
    if (!tenantIds.length) return null;
    return { kind: "companyAll", params: { tenant_ids: tenantIds.join(",") }, tenantIds };
  }

  if (groupCode === ALL) {
    const groupIds = ids(directory.groups);
    if (!groupIds.length) return null;
    const companyIds = ids(members.filter((c) => directory.groups.some((g) => g.tenantId && g.code === c.groupCode)));
    return {
      kind: "groupAll",
      params: { group_tenant_ids: groupIds.join(","), company_tenant_ids: companyIds.join(",") },
      tenantIds: [...groupIds, ...companyIds],
    };
  }

  const group = directory.groups.find((g) => g.code === groupCode);
  if (!group?.tenantId) return null;
  const companyIds = ids(members);
  return {
    kind: "group",
    params: { group_tenant_id: group.tenantId, company_tenant_ids: companyIds.join(",") },
    tenantIds: [group.tenantId, ...companyIds],
  };
}

// ---------------------------------------------------------------------------
// Currency options: union of the ACTIVE currencies of every tenant in scope
// ---------------------------------------------------------------------------

const currencyCache = new Map();

function fetchTenantCurrencies(tenantId) {
  if (!currencyCache.has(tenantId)) {
    const request = postForm("/api/currency/list", { tenant_id: tenantId })
      .then((body) => (body.data || []).filter((c) => c.status !== "INACTIVE").map((c) => c.code))
      .catch((err) => {
        currencyCache.delete(tenantId);
        throw err;
      });
    currencyCache.set(tenantId, request);
  }
  return currencyCache.get(tenantId);
}

// Keeps the previous scope's codes while a new scope's list is loading, so the selected
// currency doesn't blink away between clicks.
export function useCurrencyOptions(tenantIds) {
  const key = (tenantIds || []).join(",");
  const [codes, setCodes] = useState([]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.allSettled(key.split(",").map((id) => fetchTenantCurrencies(id))).then((results) => {
      if (cancelled) return;
      const merged = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      setCodes([...new Set(merged)]);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return key ? codes : [];
}

// ---------------------------------------------------------------------------
// KPI + trend + currency breakdown for one scope / range / currency
// ---------------------------------------------------------------------------

const EMPTY = { kpi: null, trend: [], breakdown: [], error: "" };

// While a new request is in flight the previous result stays on screen (cards dim via `loading`).
export function useDashboardData(scope, dateFrom, dateTo, currency) {
  const requestKey =
    scope && currency && dateFrom && dateTo
      ? `${scope.kind}|${JSON.stringify(scope.params)}|${dateFrom}|${dateTo}|${currency}`
      : "";
  const [result, setResult] = useState({ key: "", ...EMPTY });

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const { signal } = controller;
    const [kpiUrl, chartUrl, breakdownUrl] = ENDPOINTS[scope.kind];
    const range = { date_from: dateFrom, date_to: dateTo };

    Promise.all([
      getJson(kpiUrl, { ...scope.params, ...range, currency }, { signal }),
      getJson(chartUrl, { ...scope.params, ...range, currency }, { signal }),
      getJson(breakdownUrl, { ...scope.params, ...range, base_currency: currency }, { signal }),
    ])
      .then(([kpi, chart, breakdown]) =>
        setResult({
          key: requestKey,
          kpi: kpi.data,
          trend: chart.data || [],
          breakdown: breakdown.data || [],
          error: "",
        })
      )
      .catch((err) => {
        if (err.name !== "AbortError") setResult({ key: requestKey, ...EMPTY, error: err.message });
      });

    return () => controller.abort();
  }, [requestKey, scope, dateFrom, dateTo, currency]);

  if (!requestKey) return { ...EMPTY, loading: false, initialLoading: false };
  // initialLoading: the very first load of this page visit (no result has arrived yet), as opposed
  // to `loading`, which is also true every time a filter change triggers a re-fetch.
  return { ...result, loading: result.key !== requestKey, initialLoading: result.key === "" };
}

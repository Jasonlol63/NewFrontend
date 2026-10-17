import { useEffect, useState } from "react";
import { getJson, postForm } from "@/lib/api";
import { REALTIME_DOMAINS, touchesLedger, useRealtime } from "@/lib/realtime/realtimeEvents";
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
      // menu: the sidebar entries this login gets inside the company (null = unknown, treated as open).
      companies.push({ code, tenantId: row.tenant_id, groupCode: row.parent_tenant_code || null, menu: row.menu ?? null });
      // A company can point at a Group whose own ledger this login can't open: still list it
      // for navigation, just without a tenantId (so its "Group view" can't be requested).
      if (row.parent_tenant_code && !groups.has(row.parent_tenant_code)) {
        groups.set(row.parent_tenant_code, { code: row.parent_tenant_code, tenantId: null });
      }
    }
  }
  const byCode = (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true });
  // Companies are kept together by Group (A-Z, independent companies last), each block sorted 1-Z.
  const byGroupThenCode = (a, b) => {
    if (a.groupCode !== b.groupCode) {
      if (!a.groupCode) return 1;
      if (!b.groupCode) return -1;
      return a.groupCode.localeCompare(b.groupCode, undefined, { numeric: true });
    }
    return byCode(a, b);
  };
  return { groups: [...groups.values()].sort(byCode), companies: companies.sort(byGroupThenCode), loginTenant: loginTenant || null };
}

// The accessible-tenant rows are the same for every page and every modal of one login, so they are fetched once and shared
// (Add User opens with its Company access already there). Kept per login and for a few minutes; a failed request is not kept.
const DIRECTORY_TTL_MS = 5 * 60_000;
let directoryRows = null; // { userKey, at, rows | null, promise }

const userKeyOf = (user) => (user ? `${user.user_type ?? "user"}:${user.user_id ?? "unknown"}` : null);

function loadDirectoryRows(user) {
  const userKey = userKeyOf(user);
  const fresh = directoryRows && directoryRows.userKey === userKey && Date.now() - directoryRows.at < DIRECTORY_TTL_MS;
  if (fresh) return directoryRows;
  const entry = { userKey, at: Date.now(), rows: null, promise: null };
  entry.promise = getJson("/auth/tenant-accessible", { all: 1 }).then(
    (body) => {
      entry.rows = body.data || [];
      return entry.rows;
    },
    (err) => {
      if (directoryRows === entry) directoryRows = null;
      throw err;
    }
  );
  directoryRows = entry;
  return entry;
}

export function useTenantDirectory() {
  const [state, setState] = useState({ directory: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    loadSessionUser()
      .then((user) => {
        const entry = loadDirectoryRows(user);
        const build = (rows) => !cancelled && setState({ directory: buildDirectory(rows, user?.tenant_code), error: "" });
        if (entry.rows) build(entry.rows);
        else return entry.promise.then(build);
      })
      .catch((err) => {
        if (!cancelled && err.name !== "AbortError") setState({ directory: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function companiesInGroup(directory, groupCode) {
  if (!directory) return [];
  if (groupCode === ALL) return directory.companies;
  if (groupCode === INDEPENDENT) return directory.companies.filter((c) => !c.groupCode);
  return directory.companies.filter((c) => c.groupCode === groupCode);
}

// Whether this login holds access to at least one Group itself. A Group that is only listed because
// one of its companies points at it (no tenantId) is not a Group permission, so a login with only
// company access gets no Group filter.
export function hasGroupAccess(directory) {
  return Boolean(directory?.groups.some((g) => g.tenantId));
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

const requestKeyOf = (scope, dateFrom, dateTo, currency) =>
  scope && currency && dateFrom && dateTo ? `${scope.kind}|${JSON.stringify(scope.params)}|${dateFrom}|${dateTo}|${currency}` : "";

// Results remembered by request (scope, dates, currency), so a company seen before shows its numbers at once while the fresh answer
// loads (it always replaces them). The three answers of a request are kept together and shown together. A request already on its
// way is shared, so a head-start prefetch and the page's own load are one request. Short-lived: it is only a head start.
// A result younger than FRESH_MS is used as it is (switching back to a company just seen asks nothing); an older one is shown and
// asked for again. The backend's ledger / data capture news empties the cache: those numbers are out of date then.
const RESULT_MS = 5 * 60 * 1000;
const FRESH_MS = 60 * 1000;
const RESULT_MAX = 30;
const results = new Map(); // key -> { value, at }
const inflight = new Map(); // key -> promise
let epoch = 0; // bumped when the cache is emptied: an answer asked for before that is not kept

function peekResult(key, maxAge = RESULT_MS) {
  const hit = results.get(key);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age > RESULT_MS) {
    results.delete(key);
    return null;
  }
  return age > maxAge ? null : hit.value;
}

function loadResult(key, scope, dateFrom, dateTo, currency) {
  if (inflight.has(key)) return inflight.get(key);
  const [kpiUrl, chartUrl, breakdownUrl] = ENDPOINTS[scope.kind];
  const range = { date_from: dateFrom, date_to: dateTo };
  const asked = epoch;
  const request = Promise.all([
    getJson(kpiUrl, { ...scope.params, ...range, currency }),
    getJson(chartUrl, { ...scope.params, ...range, currency }),
    getJson(breakdownUrl, { ...scope.params, ...range, base_currency: currency }),
  ])
    .then(([kpi, chart, breakdown]) => {
      const value = { kpi: kpi.data, trend: chart.data || [], breakdown: breakdown.data || [] };
      if (asked === epoch) {
        results.delete(key);
        results.set(key, { value, at: Date.now() });
        if (results.size > RESULT_MAX) results.delete(results.keys().next().value);
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Warms the cache for a scope the page may switch to (its currency list too). Nothing on screen changes; errors are ignored. */
export function prefetchDashboard(scope, dateFrom, dateTo, currency) {
  const key = requestKeyOf(scope, dateFrom, dateTo, currency);
  if (!key) return;
  scope.tenantIds.forEach((id) => fetchTenantCurrencies(id).catch(() => {}));
  if (peekResult(key) == null && !inflight.has(key)) loadResult(key, scope, dateFrom, dateTo, currency).catch(() => {});
}

/** Whether the scope's result for these dates and currency is remembered already. */
export const hasDashboardResult = (scope, dateFrom, dateTo, currency) => peekResult(requestKeyOf(scope, dateFrom, dateTo, currency)) != null;

// While a new request is in flight the previous result stays on screen, or the remembered one of that request when there is one.
export function useDashboardData(scope, dateFrom, dateTo, currency) {
  const requestKey = requestKeyOf(scope, dateFrom, dateTo, currency);
  const [result, setResult] = useState({ key: "", ...EMPTY });
  // Bumped by the backend's news: the remembered numbers are dropped and the current ones asked for again.
  const [pushed, setPushed] = useState(0);
  useRealtime((event) => touchesLedger(event) || event.domain === REALTIME_DOMAINS.DATACAPTURE, () => {
    results.clear();
    inflight.clear();
    epoch += 1;
    setPushed((n) => n + 1);
  });

  useEffect(() => {
    if (!requestKey) return undefined;
    let cancelled = false;
    const fresh = peekResult(requestKey, FRESH_MS);
    if (fresh) {
      setResult({ key: requestKey, ...fresh, error: "" });
      return undefined;
    }
    loadResult(requestKey, scope, dateFrom, dateTo, currency)
      .then((value) => !cancelled && setResult({ key: requestKey, ...value, error: "" }))
      .catch((err) => !cancelled && setResult({ key: requestKey, ...EMPTY, error: err.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` holds the scope, dates and currency
  }, [requestKey, pushed]);

  if (!requestKey) return { ...EMPTY, loading: false, initialLoading: false };
  const current = result.key === requestKey;
  const remembered = current ? null : peekResult(requestKey);
  const shown = remembered ? { ...remembered, error: "" } : result;
  // initialLoading: nothing to show yet (no result has arrived and none is remembered), as opposed to `loading`, which is also
  // true every time a filter change triggers a re-fetch.
  // dataKey: the request the numbers on screen belong to; requestKey: the request the user is asking for. The chart redraws when
  // the request changes and its numbers are there (dataKey === requestKey), however they got here (cache or network).
  return { ...shown, dataKey: remembered ? requestKey : result.key, requestKey, loading: !current, initialLoading: !current && !remembered && result.key === "" };
}

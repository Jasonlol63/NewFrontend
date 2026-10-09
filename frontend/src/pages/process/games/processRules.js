// Rules for the Process list (Games category). The list comes from /api/process/process-list,
// one ProcessDTO per process: { id, process: { code, category, status, ... }, currencyCode,
// processDescriptions: [{ name }], processDays: [{ dayOfWeek }] } with dayOfWeek 1 = Mon ... 7 = Sun.
import { compareText, matchesSearch, matchesStatusChips, sortRows } from "@/components/shared/list/listFormat";

export { PROCESS_LIST_URL } from "@/pages/report/domain/domainReportRules";
export const PROCESS_ADD_URL = "/api/process/add-process";
export const PROCESS_UPDATE_URL = "/api/process/update-process";
export const PROCESS_STATUS_URL = "/api/process/update-status";
export const PROCESS_DELETE_URL = "/api/process/delete-process";

export const DAYS = [
  { day: 1, short: "MO", full: "Monday" },
  { day: 2, short: "TU", full: "Tuesday" },
  { day: 3, short: "WE", full: "Wednesday" },
  { day: 4, short: "TH", full: "Thursday" },
  { day: 5, short: "FR", full: "Friday" },
  { day: 6, short: "SA", full: "Saturday" },
  { day: 7, short: "SU", full: "Sunday" },
];

export function normalizeProcessRow(dto) {
  const process = dto?.process ?? {};
  const id = dto?.id ?? process.id;
  if (id == null) return null;
  return {
    id,
    tenantId: process.tenantId,
    category: String(process.category ?? "").trim().toUpperCase(),
    code: String(process.code ?? "").trim(),
    description: (dto.processDescriptions ?? []).map((d) => d?.name).filter(Boolean).join(", "),
    status: String(process.status || "active").toLowerCase(),
    currency: String(dto.currencyCode ?? "").trim(),
    currencyId: process.currencyId ?? null,
    descriptionIds: (dto.processDescriptions ?? []).map((d) => d?.id).filter((id) => id != null),
    enableSaveDraft: Boolean(process.enableSaveDraft),
    removeWord: process.removeWord ?? "",
    replaceFrom: process.replaceWordFrom ?? "",
    replaceTo: process.replaceWordTo ?? "",
    remark: process.remark ?? "",
    createdAt: process.createdAt ?? null,
    createdBy: process.createdBy ?? "",
    updatedAt: process.updatedAt ?? null,
    updatedBy: process.updatedBy ?? "",
    days: [...new Set((dto.processDays ?? []).map((d) => Number(d?.dayOfWeek)))].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b),
  };
}

const dayNames = (p) => p.days.map((d) => DAYS[d - 1].short);

export function filterProcesses(rows, { search, ...chips }) {
  return rows.filter(
    (p) => matchesSearch([p.code, p.description, p.currency, p.status, ...dayNames(p)], search) && matchesStatusChips(p.status, chips)
  );
}

// Day Use sorts by the week: the one that starts earlier first, then the one with more days.
const dayKey = (p) => p.days.join("");

const COMPARE = {
  code: compareText("code"),
  description: compareText("description"),
  status: compareText("status"),
  currency: compareText("currency"),
  days: (a, b) => dayKey(a).localeCompare(dayKey(b)),
};

// Ties (and the default order) fall back to Process ID, numbers first, then the description.
const byCode = (a, b) => COMPARE.code(a, b) || COMPARE.description(a, b);

export function sortProcesses(rows, key, dir) {
  return sortRows(rows, COMPARE[key] ?? byCode, byCode, dir);
}

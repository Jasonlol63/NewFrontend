export const DOMAIN_REPORT_URL = "/api/report/domain-report/list";
export const PROCESS_LIST_URL = "/api/process/process-list";

// One process of /api/process/process-list: id, code, category and its descriptions.
export function normalizeProcess(dto) {
  const process = dto?.process ?? {};
  const id = dto?.id ?? process.id;
  const code = String(process.code ?? "").trim();
  if (id == null || !code) return null;
  const descriptions = (dto.processDescriptions ?? []).map((d) => d?.name).filter(Boolean);
  return {
    id,
    category: String(process.category ?? "").trim().toUpperCase(),
    label: descriptions.length ? `${code} (${descriptions.join(", ")})` : code,
  };
}

// The Group's own data reports its BANK processes; a company reports GAME ones and can also
// ask for all of them ("All Process").
export function processOptions(processes, isGroupOwn) {
  const own = processes.filter((p) => (p.category === "BANK") === isGroupOwn);
  const list = own.map((p) => ({ value: p.id, label: p.label }));
  return isGroupOwn ? list : [{ value: "", label: "All Process" }, ...list];
}

export function buildDomainRequest({ tenantId, dateFrom, dateTo, processId, isGroupOwn }) {
  return {
    tenantId,
    dateFrom,
    dateTo,
    processId: processId === "" ? null : Number(processId),
    category: isGroupOwn ? "BANK" : "GAME",
  };
}

// One process row of the Spring DomainReportDTO list. A company's rows carry the process
// description; a Group's don't.
export function normalizeDomainRow(raw, isGroupOwn) {
  const process = String(raw.processCode ?? "").trim();
  const description = String(raw.description ?? "").trim();
  return {
    id: `${process}|${description}`,
    label: !isGroupOwn && description ? `${process} (${description})` : process,
    turnover: raw.turnoverAmount,
    win: raw.winAmount,
    lose: raw.loseAmount,
    winLose: raw.winLoseAmount,
  };
}

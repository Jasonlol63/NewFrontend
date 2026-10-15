import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { currentMonthRange } from "@/lib/date";
import DataTable, { ROW_HEIGHT } from "@/components/shared/list/DataTable.jsx";
import { Badge } from "@/components/shared/list/cells.jsx";
import { useFitRows } from "@/components/shared/list/useListView";
import MainOverlay from "@/components/layout/MainOverlay.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import AuditDetailPanel from "./AuditDetailPanel.jsx";
import AuditFilterCard from "./AuditFilterCard.jsx";
import { fetchAuditLog, fetchAuditOptions, fetchAuditSummary } from "./auditLogApi";
import { actionStyle, formatStamp, splitSummary } from "./auditLogRules";

const EMPTY_COUNTS = { create: 0, update: 0, delete: 0, restorable: 0 };
const EMPTY_OPTIONS = { companies: [], modules: [] };
const canSelect = () => false;

// Typing in the search box waits this long before asking the server.
const SEARCH_DELAY = 300;

/**
 * Audit Log (IT accounts): every create / update / delete written by the staff of any company, newest first.
 * The list is paged by the server (GET /api/it/audit-log, as many rows per page as fit the card); the numbers on the
 * type tiles come from /audit-log/summary under the same filters, and a click on a row opens its detail panel.
 */
export default function AuditLogPage() {
  const { t } = useTranslation(["auditlog", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const [range, setRange] = useState(() => currentMonthRange());
  const [company, setCompany] = useState("");
  const [module, setModule] = useState("");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loadedKey, setLoadedKey] = useState(null);
  const [openId, setOpenId] = useState(null);

  const bodyRef = useRef(null);
  const { count: pageSize, rowHeight } = useFitRows(bodyRef, 0, ROW_HEIGHT);

  // The search box is applied a moment after the last key; every other filter goes back to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(search);
      setPage(1);
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [search]);
  const change = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const failed = useCallback(
    (e) => {
      if (e.name === "AbortError") return;
      push(t("toast.loadFailed"), "error", e.message, { label: t("common:retry"), onClick: () => setReloadKey((k) => k + 1) });
    },
    [push, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchAuditOptions({ signal: controller.signal }).then(setOptions).catch(failed);
    return () => controller.abort();
  }, [failed]);

  const filters = { range, company, module, keyword };
  const summaryKey = `${range.from}|${range.to}|${company}|${module}|${keyword}|${reloadKey}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchAuditSummary({ range, company, module, keyword }, { signal: controller.signal }).then(setCounts).catch(failed);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey, failed]);

  const listKey = `${summaryKey}|${action}|${page}|${pageSize}`;
  const loading = loadedKey !== listKey;
  useEffect(() => {
    const controller = new AbortController();
    fetchAuditLog({ ...filters, action, page, size: pageSize }, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setLoadedKey(listKey);
      })
      .catch((e) => {
        failed(e);
        if (e.name !== "AbortError") setLoadedKey(listKey);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, failed]);

  const rows = data.rows;
  const pageCount = Math.max(1, Math.ceil(data.total / pageSize));
  const offset = (page - 1) * pageSize;
  const openIndex = rows.findIndex((r) => r.id === openId);
  const open = openIndex >= 0 ? rows[openIndex] : null;
  const selected = useMemo(() => new Set(openId == null ? [] : [openId]), [openId]);

  const columns = [
    { key: "no", label: t("cols.no"), sortable: false, className: "w-[44px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    {
      key: "time",
      label: t("cols.time"),
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) => {
        const s = formatStamp(r.createdAt);
        return (
          <span className="tabular-nums">
            <b>{s.time}</b>
            <span className="ml-1.5 type-caption font-normal! text-dash-faint">{s.day}</span>
          </span>
        );
      },
    },
    {
      key: "operator",
      label: t("cols.operator"),
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dfeaff,#bcd6ff)] text-[10px] font-semibold text-[#0a3fc9]">
            {String(r.operatorName ?? "?").slice(0, 2).toUpperCase()}
          </span>
          {r.operatorName}
          {r.operatorRole && <small className="type-caption font-normal! text-dash-faint">{r.operatorRole}</small>}
        </span>
      ),
    },
    { key: "tenantCode", label: t("cols.company"), sortable: false, cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.tenantCode || "-" },
    {
      key: "module",
      label: t("cols.module"),
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) => <Badge className="border-[#cfe0fa] bg-[#eef4fd] font-medium! text-[#41588a]">{r.module}</Badge>,
    },
    {
      key: "action",
      label: t("cols.type"),
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) => {
        const s = actionStyle(r.action);
        return (
          <Badge className={cn("items-center gap-1.5", s.badge)}>
            <i className={cn("size-[7px] flex-none rounded-full", s.dot)} />
            {r.action}
          </Badge>
        );
      },
    },
    {
      key: "summary",
      label: t("cols.summary"),
      sortable: false,
      fit: true,
      className: "w-full",
      cellClassName: "whitespace-nowrap",
      render: (r) => {
        const { verb, rest } = splitSummary(r.summary);
        return (
          <span title={r.summary}>
            {verb && <span className="mr-2 font-medium! text-dash-sub">{verb}</span>}
            {rest}
          </span>
        );
      },
    },
    {
      key: "go",
      label: "",
      sortable: false,
      className: "w-[36px]",
      render: () => <ChevronRight className="size-4 text-[#8fb0e8]" />,
    },
  ];

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <AuditFilterCard
        range={range}
        onRangeChange={change(setRange)}
        company={company}
        onCompanyChange={change(setCompany)}
        companies={options.companies}
        module={module}
        onModuleChange={change(setModule)}
        modules={options.modules}
        search={search}
        onSearchChange={setSearch}
        action={action}
        onActionChange={change(setAction)}
        counts={counts}
      />

      <DataTable
        columns={columns}
        rowKey={(r) => r.id}
        noun="records"
        minWidth="min-w-0"
        fitWidth
        loading={loading}
        emptyMessage={t("empty")}
        bodyRef={bodyRef}
        rows={rows}
        offset={offset}
        total={data.total}
        paged
        boxedPager
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        rowHeight={rowHeight}
        pageFull={rows.length === pageSize}
        selected={selected}
        canSelect={canSelect}
        selectColumn={false}
        onRowClick={(r) => setOpenId(r.id)}
      />

      {open && (
        <MainOverlay>
          <AuditDetailPanel
            row={open}
            index={openIndex}
            count={rows.length}
            onPrev={openIndex > 0 ? () => setOpenId(rows[openIndex - 1].id) : undefined}
            onNext={openIndex < rows.length - 1 ? () => setOpenId(rows[openIndex + 1].id) : undefined}
            onClose={() => setOpenId(null)}
          />
        </MainOverlay>
      )}
    </div>
  );
}

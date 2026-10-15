import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Copy, ScrollText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/list/cells.jsx";
import { actionStyle, changedFields, formatStamp, formatValue, KEY_FIELDS, parseSnapshot, splitSummary, WIDE_FIELDS } from "./auditLogRules";

const iconButton =
  "flex size-8 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-white/90 bg-white/60 text-brand-navy transition-colors hover:bg-white/85 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/60";

const card = "relative flex-none overflow-hidden rounded-2xl border border-modal-line bg-white shadow-modal-card";

const copyText = (text) => navigator.clipboard?.writeText(text).catch(() => {});

function Initials({ name, className }) {
  return (
    <span className={cn("flex flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#dfeaff,#bcd6ff)] font-semibold text-[#0a3fc9]", className)}>
      {String(name ?? "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function ActionBadge({ action }) {
  const style = actionStyle(action);
  return (
    <Badge className={cn("gap-1.5", style.badge)}>
      <i className={cn("size-[7px] rounded-full", style.dot)} />
      {action}
    </Badge>
  );
}

// "Fields" view: one small card per column; the headline ones (type, amount, accounts) get the stripe tint.
function FieldGrid({ data, deleted }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-3">
      {Object.entries(data).map(([key, value]) => (
        <div
          key={key}
          className={cn(
            "min-w-0 rounded-[9px] border px-2.5 py-[7px]",
            WIDE_FIELDS.has(key) && "col-span-2",
            deleted ? "border-dashed border-[#f6c4cf] bg-[#fff8fa]" : KEY_FIELDS.has(key) ? "border-[#7fb2ff] bg-row-stripe" : "border-dash-line bg-white"
          )}
        >
          <small className="block font-mono type-caption text-dash-faint">{key}</small>
          <div
            className={cn(
              "break-all font-mono type-table-cell font-semibold!",
              deleted ? "text-[#9f2e46] line-through decoration-[#c8304f]/40" : KEY_FIELDS.has(key) ? "text-[#0d60ff]" : "text-[#1f2937]"
            )}
          >
            {formatValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangeList({ changes }) {
  const { t } = useTranslation("auditlog");
  return (
    <div className="flex flex-col gap-1.5 px-2.5 pb-3">
      {changes.map((c) => (
        <div key={c.field} className="grid grid-cols-[minmax(80px,0.7fr)_1fr_18px_1fr] items-stretch gap-1.5">
          <span className="flex items-center break-all font-mono type-caption font-semibold! text-[#5b74a3]">{c.field}</span>
          <div className="min-w-0 break-all rounded-[9px] border border-[#ffc2cf] bg-[#ffe4ea] px-2 py-[7px] font-mono type-caption font-semibold! text-[#a32244] line-through decoration-[#c8304f]/45">
            <small className="block text-[10px] font-normal! no-underline opacity-70">{t("detail.before")}</small>
            {c.before}
          </div>
          <span className="flex items-center justify-center text-[#8fb0e8]">
            <ArrowRight className="size-3.5" />
          </span>
          <div className="min-w-0 break-all rounded-[9px] border border-[#a7f0c0] bg-[#dcfce7] px-2 py-[7px] font-mono type-caption font-semibold! text-[#0f6e34]">
            <small className="block text-[10px] font-normal! opacity-70">{t("detail.after")}</small>
            {c.after}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One log row in a panel that slides in from the right over the content area (same shell as the notification panel).
 * Render it inside <MainOverlay>. index / count: place of the row in the page, for the previous / next buttons.
 */
export default function AuditDetailPanel({ row, index, count, onPrev, onNext, onClose }) {
  const { t } = useTranslation(["auditlog", "common"]);
  const [view, setView] = useState("fields");
  const style = actionStyle(row.action);
  const stamp = formatStamp(row.createdAt);
  const { verb, rest } = splitSummary(row.summary);
  const before = useMemo(() => parseSnapshot(row.beforeData), [row.beforeData]);
  const after = useMemo(() => parseSnapshot(row.afterData), [row.afterData]);
  const isUpdate = row.action === "UPDATE" && before && after;
  const snapshot = row.action === "DELETE" ? before : after ?? before;
  const changes = useMemo(() => (isUpdate ? changedFields(before, after) : []), [isUpdate, before, after]);
  const json = snapshot ? JSON.stringify(snapshot, null, 2) : "";

  useEffect(() => setView("fields"), [row.id]);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowUp" && onPrev) onPrev();
      else if (e.key === "ArrowDown" && onNext) onNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onPrev, onNext]);

  const contentTitle = row.action === "DELETE" ? t("detail.deletedContent") : t("detail.createdContent");

  return (
    <div className="@container/main absolute inset-0 z-40">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-in fade-in-0 bg-[rgba(20,51,107,0.18)] duration-200" />
      <section
        role="dialog"
        aria-label={t("detail.title")}
        className={cn(
          "absolute inset-y-2 right-2 flex w-[min(460px,calc(100%-16px))] animate-in slide-in-from-right-8 fade-in-0 flex-col overflow-hidden rounded-[22px] bg-[rgba(238,244,253,0.92)] backdrop-blur-[22px] backdrop-saturate-[1.15] duration-200",
          "shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)]",
          "@max-[519px]/main:inset-y-0 @max-[519px]/main:right-0 @max-[519px]/main:w-full @max-[519px]/main:rounded-none"
        )}
      >
        <header className="flex flex-none items-center gap-2.5 pb-3 pl-[18px] pr-4 pt-4">
          <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)]">
            <ScrollText className="size-[18px]" strokeWidth={2.3} />
          </span>
          <h2 className="m-0 whitespace-nowrap type-page-title tracking-[-0.3px] text-brand-navy">{t("detail.title")}</h2>
          <span className="type-caption tabular-nums text-[#5b74a3]">
            {index + 1} / {count}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label={t("detail.prev")} title={t("detail.prev")} className={iconButton}>
              <ChevronLeft className="size-[15px]" strokeWidth={2.6} />
            </button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label={t("detail.next")} title={t("detail.next")} className={iconButton}>
              <ChevronRight className="size-[15px]" strokeWidth={2.6} />
            </button>
            <button type="button" onClick={onClose} aria-label={t("common:close")} title={t("common:close")} className={iconButton}>
              <X className="size-[15px]" strokeWidth={2.6} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-t border-modal-divider px-3 pb-3.5 pt-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          <article className={cn(card, "py-3.5 pr-3.5 pl-[18px] before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-[3px]", style.accent)}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge className="border-[#cfe0fa] bg-[#eef4fd] font-medium! text-[#41588a]">{row.module}</Badge>
              <ActionBadge action={row.action} />
            </div>
            <div className="break-words type-label text-brand-navy">
              {verb && <span className="mr-1">{verb}</span>}
              {rest}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-dashed border-[#e3ebf8] pt-2 type-caption text-[#5b74a3]">
              <Initials name={row.operatorName} className="size-[22px] text-[9px]" />
              <b className="type-table-cell font-semibold! text-[#374151]">{row.operatorName}</b>
              {row.operatorRole && <span>{row.operatorRole}</span>}
              {row.tenantCode && (
                <>
                  <i className="size-[3px] rounded-full bg-slate-300" />
                  <span>{row.tenantCode}</span>
                </>
              )}
              <span className="ml-auto flex items-center gap-1.5 tabular-nums">
                <Clock className="size-3" />
                {stamp.full}
              </span>
            </div>
          </article>

          <article className={cn(card, "grid grid-cols-2")}>
            <div className="px-3.5 py-2.5">
              <small className="mb-0.5 block type-caption text-dash-faint">{t("detail.sourceTable")}</small>
              <span className="font-mono type-table-cell font-semibold! text-[#1f2937]">{row.sourceTable || "—"}</span>
            </div>
            <div className="border-l border-[#eef2f7] px-3.5 py-2.5">
              <small className="mb-0.5 block type-caption text-dash-faint">{t("detail.recordId")}</small>
              <span className="flex items-center gap-1.5 font-mono type-table-cell font-semibold! text-[#1f2937]">
                {row.entityId || "—"}
                {row.entityId && (
                  <button type="button" onClick={() => copyText(row.entityId)} title={t("detail.copy")} aria-label={t("detail.copy")} className="flex cursor-pointer text-[#8fb0e8] hover:text-[#0d60ff]">
                    <Copy className="size-3.5" />
                  </button>
                )}
              </span>
            </div>
          </article>

          {isUpdate ? (
            <article className={card}>
              <div className="flex items-center gap-2 pt-2.5 pr-3 pb-2 pl-3.5">
                <h3 className="m-0 type-label text-brand-navy">{t("detail.changes")}</h3>
                <span className="type-caption font-semibold! text-[#0d60ff]">{t("detail.fieldCount", { count: changes.length })}</span>
              </div>
              {changes.length ? <ChangeList changes={changes} /> : <p className="m-0 px-3.5 pb-3 type-table-cell text-dash-faint">{t("detail.noChanges")}</p>}
            </article>
          ) : snapshot ? (
            <article className={card}>
              <div className="flex items-center gap-2 pt-2.5 pr-3 pb-2 pl-3.5">
                <h3 className="m-0 type-label text-brand-navy">{contentTitle}</h3>
                <span className="type-caption font-semibold! text-[#0d60ff]">{t("detail.fieldCount", { count: Object.keys(snapshot).length })}</span>
                <div className="ml-auto inline-flex gap-0.5 rounded-[9px] bg-[#eaf2ff] p-0.5">
                  {["fields", "json"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={cn(
                        "cursor-pointer rounded-[7px] px-2.5 py-[3px] type-caption font-semibold!",
                        view === v ? "bg-brand-sweep text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.6)]" : "text-[#5b74a3]"
                      )}
                    >
                      {t(`detail.${v}`)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => copyText(json)}
                  className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#cfe0fb] bg-[#eaf2ff] px-2 type-caption font-semibold! text-brand-navy hover:bg-[#dce9ff]"
                >
                  <Copy className="size-3" />
                  {t("detail.copy")}
                </button>
              </div>
              {view === "fields" ? (
                <FieldGrid data={snapshot} deleted={row.action === "DELETE"} />
              ) : (
                <pre className="mx-2.5 mb-3 max-h-[280px] overflow-auto rounded-[10px] border border-[#dfe8f6] bg-[#0f1f3d] p-3 font-mono type-caption leading-[1.6] text-[#cfe0ff]">{json}</pre>
              )}
            </article>
          ) : (
            <div className="rounded-xl border border-dashed border-modal-off-line px-3 py-6 text-center type-table-cell text-[#8a96a8]">{t("detail.noData")}</div>
          )}
        </div>
      </section>
    </div>
  );
}

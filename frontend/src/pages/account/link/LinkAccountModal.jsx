import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { CheckListTools } from "@/components/shared/form-modal/CheckList.jsx";
import { filterItems } from "@/components/shared/form-modal/listSelection";
import { applyLinkOp, fetchAccountLinks } from "./linkAccountApi";
import { diffLinks } from "./linkAccountRules";

// Same shell and cards as Add / Edit Account. Layout, from the content area width (@container/main):
//   >= 900px: two columns, Link Type + Selected (1) | Accounts (2)
//   < 900px: one column, scrolling
// Every account gets its own direction: bidirectional (blue, both accounts see each other) or unidirectional
// (teal, only this account sees the other). The segmented bar picks what the next click adds as.
// Class names are written out in full so Tailwind can see them.

const TYPES = {
  bi: {
    label: "Bidirectional",
    Icon: ArrowLeftRight,
    tile: "border-[#7fb2ff] bg-row-stripe text-brand-navy",
    badge: "bg-brand-sweep",
    chip: "border-[#7fb2ff] bg-row-stripe text-brand-navy shadow-[inset_0_0_0_1px_#7fb2ff]",
    heading: "text-[#1d4ed8]",
    count: "text-[#3b82f6]",
    on: "bg-brand-sweep shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]",
    arrow: "text-[#3b82f6]",
    dot: "bg-[#7fb2ff]",
  },
  uni: {
    label: "Unidirectional",
    Icon: ArrowRight,
    tile: "border-[#5fd0c0] bg-[linear-gradient(90deg,#d5f6f0_0%,#f0fcf9_100%)] text-[#0b5d52]",
    badge: "bg-[linear-gradient(100deg,#0f9d8a,#3fd1bd)]",
    chip: "border-[#5fd0c0] bg-[linear-gradient(90deg,#d5f6f0_0%,#f0fcf9_100%)] text-[#0b5d52] shadow-[inset_0_0_0_1px_#5fd0c0]",
    heading: "text-[#0f766e]",
    count: "text-[#0f9d8a]",
    on: "bg-[linear-gradient(100deg,#0f9d8a,#3fd1bd)] shadow-[0_4px_10px_-4px_rgba(15,157,138,0.6)]",
    arrow: "text-[#0f9d8a]",
    dot: "bg-[#5fd0c0]",
  },
  // A one-way link from the other account to this one: shown, never added from here.
  in: {
    label: "From other accounts",
    Icon: ArrowLeft,
    tile: "border-[#a9dcd5] bg-[linear-gradient(90deg,#e6f6f3_0%,#f6fcfb_100%)] text-[#3b7d74]",
    badge: "bg-[linear-gradient(100deg,#6bb8ae,#9ad8cf)]",
    chip: "border-[#a9dcd5] bg-[linear-gradient(90deg,#e6f6f3_0%,#f6fcfb_100%)] text-[#3b7d74] shadow-[inset_0_0_0_1px_#a9dcd5]",
    heading: "text-[#3b7d74]",
    count: "text-[#3b7d74]",
  },
};
const MODES = ["bi", "uni"]; // what a click can add as
const other = (t) => (t === "bi" ? "uni" : "bi");

/**
 * Link Account: pick the accounts `account` is linked to, each as bidirectional or unidirectional.
 * accounts: the tenant's account rows (the pool); tenantId: the company picked on the page.
 * What the account already has comes from /api/account/link/manage, including one-way links that point at it
 * ("in"): those can only be upgraded to bidirectional here (click the tile), never removed. Save sends only
 * what changed, one request per change; if one fails the message is shown in the footer and what already went
 * through is not sent again.
 */
export default function LinkAccountModal({ account, accounts, tenantId, onClose, onSaved }) {
  const [initial, setInitial] = useState(() => new Map()); // otherAccountId -> "bi" | "uni" | "in", as stored
  const [current, setCurrent] = useState(() => new Map());
  const [labels, setLabels] = useState(() => new Map());
  const [mode, setMode] = useState("bi"); // what the next click adds as
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchAccountLinks(account.id, tenantId, { signal: controller.signal })
      .then(({ links, labels: fromServer }) => {
        setInitial(links);
        setCurrent(new Map(links));
        setLabels(fromServer);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setMessage(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [account.id, tenantId]);

  const pool = useMemo(
    () =>
      accounts
        .filter((a) => a.id !== account.id)
        .map((a) => ({ value: a.id, label: a.accountId }))
        .sort((x, y) => (x.label < y.label ? -1 : x.label > y.label ? 1 : 0)),
    [accounts, account.id]
  );
  const labelOf = (id) => pool.find((p) => p.value === id)?.label ?? labels.get(id) ?? String(id);
  const shown = filterItems(pool, query);

  const count = (t) => [...current.values()].filter((v) => v === t).length;

  // Click: add with the current mode; the same mode again removes it; the other mode switches it.
  // A link that points at this account ("in") toggles between staying as it is and bidirectional, whatever the mode.
  const isIncoming = (id) => initial.get(id) === "in";
  const clickTile = (id) =>
    setCurrent((m) => {
      const next = new Map(m);
      if (isIncoming(id)) next.set(id, m.get(id) === "in" ? "bi" : "in");
      else if (next.get(id) === mode) next.delete(id);
      else next.set(id, mode);
      return next;
    });
  const flip = (id) => setCurrent((m) => new Map(m).set(id, isIncoming(id) ? (m.get(id) === "in" ? "bi" : "in") : other(m.get(id))));
  const remove = (id) =>
    setCurrent((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  const clear = () => setCurrent(new Map([...initial].filter(([, t]) => t === "in")));
  const selectAll = () =>
    setCurrent((m) => {
      const next = new Map(m);
      shown.forEach((p) => next.has(p.value) || next.set(p.value, mode));
      return next;
    });

  const save = async () => {
    if (saving || loading) return;
    setMessage("");
    setSaving(true);
    const done = new Map(initial);
    try {
      for (const op of diffLinks(initial, current)) {
        await applyLinkOp(op, account.id, tenantId);
        if (op.kind === "remove") done.delete(op.id);
        else done.set(op.id, op.type);
      }
      await onSaved(); // closes the modal
    } catch (err) {
      setInitial(done);
      setMessage(err.message);
      setSaving(false);
    }
  };

  const footerNote = message || (loading ? "Loading…" : current.size ? [`${count("bi")} bidirectional`, `${count("uni")} unidirectional`, count("in") ? `${count("in")} from others` : ""].filter(Boolean).join(" · ") : "");
  const footerIsError = Boolean(message);

  return (
    <FormModal
      icon={Link2}
      title="Link Account"
      onClose={onClose}
      onSave={save}
      saveDisabled={loading || saving}
      footerStart={
        footerNote && (
          <p
            role={footerIsError ? "alert" : "status"}
            className={cn(
              "m-0 mr-auto min-w-0 text-[12.5px] font-semibold leading-tight @max-[599px]/main:basis-full @max-[599px]/main:text-[12px]",
              footerIsError ? "text-[#dc2626]" : "text-dash-sub"
            )}
          >
            {footerNote}
          </p>
        )
      }
      bodyClassName={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
        "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
        <LinkTypeCard accountId={account.accountId} mode={mode} setMode={setMode} />
        <SelectedCard current={current} initial={initial} labelOf={labelOf} onFlip={flip} onRemove={remove} count={count} />
      </div>
      <AccountsCard
        items={shown}
        total={pool.length}
        current={current}
        mode={mode}
        query={query}
        onQuery={setQuery}
        onClick={clickTile}
        onSelectAll={selectAll}
        onClear={clear}
        loading={loading}
      />
    </FormModal>
  );
}

const stackCard = "@max-[899px]/main:flex-none @max-[899px]/main:overflow-visible";
const stackBody = "@max-[899px]/main:overflow-visible";

// Link from + the mode bar (what a click adds as) + a small picture of what that mode means.
function LinkTypeCard({ accountId, mode, setMode }) {
  const hint = mode === "bi" ? "Clicked accounts are added as bidirectional: data syncs both ways." : `Clicked accounts are added as unidirectional: data flows from ${accountId} to the account.`;
  const ModeArrow = TYPES[mode].Icon;
  return (
    <FormCard title="Link Type" className={cn("flex-none @max-[899px]/main:order-1", stackCard)} bodyClassName={stackBody}>
      <p className="m-0 mb-1 ml-px text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px]">Link from</p>
      <div className="mb-3 flex h-9 items-center justify-between rounded-[10px] border border-modal-input-line bg-modal-input px-3 text-[13.5px] font-extrabold text-brand-navy shadow-[0_1px_3px_rgba(15,23,42,0.05)] modal-compact:mb-2 modal-compact:h-[30px] modal-tiny:h-7">
        <span className="truncate">{accountId}</span>
        <span className="flex-none rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[0.4px] text-[#1d4ed8]">THIS ACCOUNT</span>
      </div>

      <p className="m-0 mb-1 ml-px text-[12.5px] font-semibold text-[#374151] modal-compact:text-[12px]">Add clicked accounts as</p>
      <div className="grid grid-cols-2 gap-0.5 rounded-[10px] border border-modal-off-line bg-white/45 p-0.5">
        {MODES.map((key) => [key, TYPES[key]]).map(([key, t]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={cn(
              "inline-flex h-[30px] min-w-0 cursor-pointer items-center justify-center gap-1.5 truncate rounded-[7px] border-none px-1 text-[12px] font-bold transition-colors modal-compact:h-[26px]",
              mode === key ? cn("text-white", t.on) : "bg-transparent text-[#64748b] hover:bg-white/60 hover:text-brand-navy"
            )}
          >
            <t.Icon className="size-3.5 flex-none" strokeWidth={2.6} />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-modal-off-line bg-white/30 px-2.5 pb-2.5 pt-3 modal-compact:mt-2 modal-compact:pt-2">
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid h-9 min-w-16 max-w-[45%] place-items-center truncate rounded-[11px] border border-[#7fb2ff] bg-row-stripe px-3 text-[13px] font-extrabold text-brand-navy">{accountId}</span>
          <ModeArrow className={cn("h-[18px] w-11 flex-none", TYPES[mode].arrow)} strokeWidth={2.2} />
          <span className="grid h-9 min-w-16 place-items-center rounded-[11px] border border-modal-off-line bg-modal-off px-3 text-[13px] font-extrabold text-[#374151]">Account</span>
        </div>
        <p className="m-0 mt-2.5 text-center text-[12px] leading-[1.45] text-[#475569]">{hint}</p>
      </div>
    </FormCard>
  );
}

// The picks in three groups: bidirectional, unidirectional, and one-way links that point at this account.
// A chip's arrow button moves it to the other group, × removes it. A link that points at this account can only be
// made bidirectional (and back, until Save), never removed from here, so it has no ×.
function SelectedCard({ current, initial, labelOf, onFlip, onRemove, count }) {
  return (
    <FormCard
      title="Selected"
      right={<CardCount>{current.size} selected</CardCount>}
      className={cn("flex-1 @max-[899px]/main:order-3", stackCard)}
      bodyClassName={stackBody}
    >
      {["bi", "uni", "in"].map((key) => {
        const t = TYPES[key];
        const ids = [...current].filter(([, v]) => v === key).map(([id]) => id);
        if (key === "in" && ![...initial.values()].includes("in")) return null;
        return (
          <div key={key} className="mb-3.5 last:mb-0">
            <div className={cn("mb-1.5 ml-px flex items-center gap-1.5 text-[12px] font-extrabold", t.heading)}>
              <t.Icon className="size-3.5" strokeWidth={2.6} />
              {t.label}
              <span className={cn("ml-auto text-[11.5px]", t.count)}>{count(key)}</span>
            </div>
            {ids.length ? (
              <div className="flex flex-wrap gap-[5px]">
                {ids.map((id) => {
                  const wasIncoming = initial.get(id) === "in";
                  // What the arrow does: a link that points at us goes bidirectional and back; the rest swap sides.
                  const Switch = wasIncoming ? (key === "in" ? ArrowLeftRight : ArrowLeft) : TYPES[other(key)].Icon;
                  const switchTitle = wasIncoming
                    ? key === "in"
                      ? "Make bidirectional"
                      : "Back to one-way from them"
                    : `Switch to ${TYPES[other(key)].label}`;
                  return (
                    <span key={id} className={cn("inline-flex h-7 items-center gap-1 rounded-lg border pl-2.5 pr-1.5 text-[12px] font-extrabold", t.chip)}>
                      {labelOf(id)}
                      <button
                        type="button"
                        onClick={() => onFlip(id)}
                        title={switchTitle}
                        className="flex cursor-pointer rounded-[5px] border-none bg-transparent p-[3px] opacity-55 hover:bg-white/80 hover:opacity-100"
                      >
                        <Switch className="size-[13px]" strokeWidth={2.6} />
                      </button>
                      {!wasIncoming && (
                        <button
                          type="button"
                          onClick={() => onRemove(id)}
                          title="Remove"
                          aria-label={`Remove ${labelOf(id)}`}
                          className="flex cursor-pointer rounded-[5px] border-none bg-transparent p-[3px] opacity-55 hover:bg-white/80 hover:opacity-100"
                        >
                          <X className="size-[11px]" strokeWidth={3.2} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-modal-off-line px-1.5 py-[9px] text-center text-[12px] text-[#8a96a8]">None</div>
            )}
          </div>
        );
      })}
    </FormCard>
  );
}

function AccountsCard({ items, total, current, mode, query, onQuery, onClick, onSelectAll, onClear, loading }) {
  return (
    <FormCard
      title="Accounts"
      right={
        <>
          <span className="flex items-center gap-3 text-[11.5px] font-semibold text-[#475569] @max-[599px]/main:hidden">
            {MODES.map((key) => [key, TYPES[key]]).map(([key, t]) => (
              <span key={key} className="inline-flex items-center gap-[5px]">
                <i className={cn("size-2.5 rounded-[3px]", t.dot)} />
                {t.label}
              </span>
            ))}
          </span>
          <CardCount>
            {current.size}/{total} selected
          </CardCount>
        </>
      }
      className={cn("flex-1 @max-[899px]/main:order-2", stackCard)}
      body={false}
    >
      <CheckListTools
        query={query}
        onQuery={onQuery}
        placeholder="Search account"
        onSelectAll={onSelectAll}
        onClear={onClear}
        className="border-b border-modal-divider px-3.5 py-2.5 modal-compact:px-3 modal-compact:py-2"
      />
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(124px,1fr))] content-start gap-2 overflow-y-auto px-3.5 pb-3.5 pt-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
          "@max-[1209px]/main:grid-cols-[repeat(auto-fill,minmax(104px,1fr))] modal-compact:gap-1.5 modal-compact:px-3 modal-compact:pb-2.5 modal-compact:pt-2",
          stackBody
        )}
      >
        {items.map((p) => {
          const type = current.get(p.value);
          const t = type && TYPES[type];
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onClick(p.value)}
              aria-pressed={Boolean(type)}
              title={type === "in" ? "One-way from this account to you. Click to make it bidirectional." : t ? t.label : `Add as ${TYPES[mode].label.toLowerCase()}`}
              className={cn(
                "relative flex h-10 cursor-pointer items-center rounded-[11px] border pl-3.5 pr-10 text-left text-[13px] font-extrabold transition-colors modal-compact:h-9 modal-tiny:h-8",
                t ? t.tile : "border-modal-off-line bg-white/60 text-[#374151] hover:border-[#93c5fd]"
              )}
            >
              <span className="truncate">{p.label}</span>
              {t && (
                <span className={cn("absolute right-[9px] top-1/2 grid h-[18px] w-6 -translate-y-1/2 place-items-center rounded-md text-white", t.badge)}>
                  <t.Icon className="size-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full py-6 text-center text-[12.5px] text-dash-faint">{loading ? "Loading…" : "No matches"}</div>
        )}
      </div>
    </FormCard>
  );
}

import { useMemo, useState } from "react";
import { Coins, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { SelectField, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import CurrencyChangesDialog from "./CurrencyChangesDialog.jsx";
import {
  FILTER_OPTIONS,
  INITIAL_CURRENCIES,
  buildChanges,
  cloneHoldings,
  countChanges,
  holdState,
  mockHoldings,
  visibleAccounts,
} from "./currencySettingRules";

// Which accounts hold which currency. Pick a currency, tick the accounts that hold it; edits in every currency
// are kept until Save, which opens a confirmation listing every change grouped by currency.
// Layout, from the screen width (@container/main): 2 columns (Add Currency + Currency | Account), below 900px one
// column (the body scrolls). Height tiers: modal-compact <= 760, modal-tiny <= 600 (see index.css).
// UI only for now: holdings are placeholders and Save just hands the result back through onSave.

const stackCard = "@max-[899px]/main:flex-none @max-[899px]/main:overflow-visible";
const stackBody = "@max-[899px]/main:overflow-visible";

const TILE_STATE = {
  on: "border-[#7fb2ff] bg-row-stripe shadow-[inset_0_0_0_1px_#7fb2ff]",
  new: "border-[#34d399] bg-[#ecfdf5] shadow-[inset_0_0_0_1px_#34d399]",
  rm: "border-[1.5px] border-dashed border-[#f87171] bg-[#fff5f5]",
  off: "border-modal-off-line bg-modal-off hover:border-[#93c5fd] hover:bg-white/80",
};

export default function CurrencySettingModal({ accounts, onClose, onSave }) {
  const [currencies, setCurrencies] = useState(INITIAL_CURRENCIES);
  const [orig, setOrig] = useState(() => mockHoldings(accounts, INITIAL_CURRENCIES)); // saved
  const [draft, setDraft] = useState(() => cloneHoldings(orig)); // being edited
  const [active, setActive] = useState(INITIAL_CURRENCIES[0]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [review, setReview] = useState(null); // changes shown in the confirmation, null = closed

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.accountId, a])), [accounts]);
  const changes = useMemo(() => buildChanges(accounts, orig, draft, currencies), [accounts, orig, draft, currencies]);
  const changeCount = countChanges(changes);
  const changedCurrencies = useMemo(() => new Set(changes.map((c) => c.currency)), [changes]);

  const shown = useMemo(
    () => visibleAccounts(accounts, { query, filter, orig, draft, currency: active }),
    [accounts, query, filter, orig, draft, active]
  );
  const activeSet = draft[active];
  const allShownHeld = shown.length > 0 && shown.every((a) => activeSet.has(a.accountId));

  const edit = (fn) =>
    setDraft((d) => {
      const next = { ...d, [active]: new Set(d[active]) };
      fn(next[active]);
      return next;
    });
  const toggleAccount = (id) => edit((set) => (set.has(id) ? set.delete(id) : set.add(id)));
  const toggleShown = () => edit((set) => shown.forEach((a) => (allShownHeld ? set.delete(a.accountId) : set.add(a.accountId))));

  const addCurrency = (code) => {
    if (!code || currencies.includes(code)) return;
    setCurrencies((list) => [...list, code]);
    setOrig((o) => ({ ...o, [code]: new Set() }));
    setDraft((d) => ({ ...d, [code]: new Set() }));
    setActive(code);
  };
  const removeCurrency = (code) => {
    const rest = currencies.filter((c) => c !== code);
    setCurrencies(rest);
    const drop = (h) => Object.fromEntries(Object.entries(h).filter(([c]) => c !== code));
    setOrig(drop);
    setDraft(drop);
    if (active === code) setActive(rest[0]);
  };

  // Accounts the user undid in the confirmation go back to how they were saved.
  const applyRestored = (restored) => {
    if (!restored.length) return;
    setDraft((d) => {
      const next = { ...d };
      restored.forEach(({ currency, accountId, kind }) => {
        next[currency] = new Set(next[currency]);
        if (kind === "removed") next[currency].add(accountId);
        else next[currency].delete(accountId);
      });
      return next;
    });
  };

  const confirm = (restored) => {
    const final = cloneHoldings(draft);
    restored.forEach(({ currency, accountId, kind }) => (kind === "removed" ? final[currency].add(accountId) : final[currency].delete(accountId)));
    setOrig(final);
    setDraft(cloneHoldings(final));
    setReview(null);
    onSave?.({ currencies, holdings: Object.fromEntries(Object.entries(final).map(([c, set]) => [c, [...set]])) });
  };

  return (
    <>
      <FormModal
        icon={Coins}
        title="Currency Setting"
        onClose={onClose}
        onSave={() => setReview(changes)}
        saveDisabled={!changeCount}
        saveLabel={
          <>
            Save
            {changeCount > 0 && <span className="ml-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-white/25 px-1.5 text-[11.5px] font-extrabold">{changeCount}</span>}
          </>
        }
        bodyClassName={cn(
          "grid grid-cols-[clamp(290px,24vw,340px)_minmax(0,1fr)]",
          "@max-[899px]/main:flex @max-[899px]/main:flex-col @max-[899px]/main:overflow-y-auto @max-[899px]/main:[scrollbar-width:thin]"
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col gap-(--gap) @max-[899px]/main:contents">
          <CurrencyManager
            currencies={currencies}
            active={active}
            onPick={setActive}
            changed={changedCurrencies}
            counts={draft}
            onAdd={addCurrency}
            onRemove={removeCurrency}
          />
        </div>

        <FormCard
          title={
            <span className="flex items-center gap-2">
              Account
              <span className="inline-flex h-[22px] items-center rounded-full @max-[359px]/main:hidden bg-brand-sweep px-2.5 text-[11.5px] font-extrabold tracking-[0.3px] text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]">{active}</span>
            </span>
          }
          right={
            <>
              {/* Wide enough: search + filter sit in the header, right before the count; narrower, they get their own row below. */}
              <span className="mr-1 hidden min-w-0 items-center gap-2 font-normal @min-[980px]/main:flex">
                <AccountFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} className="w-[220px] min-w-[150px] shrink modal-compact:w-[200px]" />
              </span>
              <span className="@max-[419px]/main:hidden">
                <CardCount>
                  {activeSet.size} hold {active}
                </CardCount>
              </span>
              <button
                type="button"
                onClick={toggleShown}
                disabled={!shown.length}
                className={cn(primaryButtonClass, "h-8 flex-none px-4 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50 modal-compact:h-7 modal-tiny:h-[26px]")}
              >
                {allShownHeld ? "Clear All" : "Select All"}
              </button>
            </>
          }
          body={false}
          className={cn("@max-[899px]/main:order-3", stackCard)}
        >
          <div className="flex flex-none flex-wrap items-center gap-2 border-b border-modal-divider px-3.5 py-2 modal-compact:px-3 modal-compact:py-1.5 @min-[980px]/main:hidden @max-[599px]/main:px-2.5">
            <AccountFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} className="min-w-[120px] max-w-[300px] flex-[1_1_200px] @max-[599px]/main:max-w-none" />
          </div>

          <div className={cn("min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-compact:p-2.5 modal-tiny:p-2", stackBody)}>
            <div className="mb-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-dash-sub modal-compact:mb-2">
              <Legend className="border-[#7fb2ff] bg-[#eaf3ff]">Holds</Legend>
              <Legend className="border-dashed border-[#f87171] bg-[#fff5f5]">Will be removed</Legend>
              <Legend className="border-[#34d399] bg-[#ecfdf5]">Newly added</Legend>
            </div>

            {shown.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(112px,9vw,140px),1fr))] gap-2.5 modal-compact:gap-2 @max-[599px]/main:grid-cols-[repeat(auto-fill,minmax(104px,1fr))]">
                {shown.map((a) => {
                  const state = holdState(orig, draft, active, a.accountId);
                  return (
                    <button
                      key={a.accountId}
                      type="button"
                      onClick={() => toggleAccount(a.accountId)}
                      aria-pressed={state === "on" || state === "new"}
                      className={cn(
                        "relative flex h-[54px] min-w-0 cursor-pointer flex-col justify-center gap-0.5 rounded-xl border px-3 text-left transition-colors modal-compact:h-12 modal-tiny:h-[42px]",
                        TILE_STATE[state]
                      )}
                    >
                      {state === "rm" && <Tag className="bg-[#fee2e2] text-[#b91c1c]">Remove</Tag>}
                      {state === "new" && <Tag className="bg-[#d1fae5] text-[#047857]">New</Tag>}
                      <b className={cn("truncate text-[13.5px] font-extrabold text-[#374151]", state === "on" && "text-brand-navy", state === "new" && "text-[#065f46]", state === "rm" && "text-[#b91c1c] line-through decoration-[1.5px]")}>
                        {a.accountId}
                      </b>
                      <span className={cn("truncate text-[10.5px] font-bold uppercase text-[#7b8794]", state === "on" && "text-[#4a6aa5]", state === "new" && "text-[#059669]", state === "rm" && "text-[#d57a7a]")}>{a.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 p-6 text-center text-[13px] text-dash-faint">No account matches.</p>
            )}
          </div>
        </FormCard>
      </FormModal>

      {review && (
        <CurrencyChangesDialog
          changes={review}
          accountsById={accountsById}
          onClose={(restored) => {
            applyRestored(restored);
            setReview(null);
          }}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

// Search box + Filter Row select; the caller sizes the search box through className.
function AccountFilters({ query, onQuery, filter, onFilter, className }) {
  return (
    <>
      <label className={cn("relative block", className)}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dash-faint" strokeWidth={2.2} />
        <TextInput value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Account or Name" aria-label="Search Account or Name" className="rounded-full pl-8" />
      </label>
      <div className="w-[124px] flex-none">
        <SelectField value={filter} onChange={onFilter} options={FILTER_OPTIONS} />
      </div>
    </>
  );
}

function Legend({ className, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn("size-2.5 rounded-[3px] border-[1.5px]", className)} />
      {children}
    </span>
  );
}

function Tag({ className, children }) {
  return <i className={cn("absolute right-[7px] top-1.5 h-[15px] rounded-full px-[5px] text-[9px] font-extrabold uppercase not-italic leading-[15px] tracking-[0.4px]", className)}>{children}</i>;
}

// Add Currency + the Currency list (tabs; in Delete mode a click asks to delete that currency).
function CurrencyManager({ currencies, active, onPick, changed, counts, onAdd, onRemove }) {
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const add = () => {
    const c = code.trim().toUpperCase();
    if (c) onAdd(c);
    setCode("");
  };

  return (
    <>
      <FormCard title="Add Currency" className={cn("flex-none @max-[899px]/main:order-1", stackCard)} bodyClassName={stackBody}>
        <div className="flex items-center gap-2">
          <TextInput
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, "").slice(0, 5))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. MYR"
            aria-label="New currency code"
            autoComplete="off"
            className="min-w-0 flex-1 uppercase"
          />
          <button type="button" onClick={add} className={cn(primaryButtonClass, "h-9 flex-none px-3 text-[12.5px] modal-compact:h-[30px] modal-tiny:h-7")}>
            <Plus className="size-3.5" strokeWidth={2.6} />
            Add
          </button>
          <button
            type="button"
            onClick={() => setDeleting((v) => !v)}
            aria-pressed={deleting}
            className={cn(
              "inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-bold modal-compact:h-[30px] modal-tiny:h-7",
              deleting ? "border-[#dc2626] bg-[#dc2626] text-white" : "border-[#fecaca] bg-white/70 text-[#dc2626] hover:bg-white"
            )}
          >
            <Trash2 className="size-3.5" strokeWidth={2.2} />
            {deleting ? "Done" : "Delete"}
          </button>
        </div>
      </FormCard>

      <FormCard
        title="Currency"
        right={<CardCount>{currencies.length} added</CardCount>}
        className={cn("flex-1 @max-[899px]/main:order-2", stackCard)}
        bodyClassName={stackBody}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-[7px]">
          {currencies.map((c) => {
            const on = !deleting && c === active;
            return (
              <button
                key={c}
                type="button"
                onClick={() => (deleting ? setToDelete(c) : onPick(c))}
                title={deleting ? `Delete ${c}` : changed.has(c) ? "Unsaved changes" : undefined}
                aria-pressed={deleting ? undefined : on}
                className={cn(
                  "relative flex h-9 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-1.5 text-[13px] font-extrabold transition-colors modal-compact:h-8 modal-tiny:h-[30px]",
                  deleting
                    ? "border-[#fecaca] bg-white text-[#b91c1c] hover:border-[#f87171] hover:bg-[#fef2f2]"
                    : on
                      ? "border-[#7fb2ff] bg-row-stripe text-brand-navy shadow-[inset_0_0_0_1px_#7fb2ff,0_4px_10px_-6px_rgba(20,90,220,0.5)]"
                      : "border-modal-off-line bg-modal-off text-brand-navy hover:border-[#93c5fd] hover:bg-white/85"
                )}
              >
                {c}
                {deleting ? (
                  <X className="size-3 text-[#ef4444]" strokeWidth={3.2} />
                ) : (
                  <span className="text-[11px] font-bold text-[#6b86b3]">{counts[c]?.size ?? 0}</span>
                )}
                {!deleting && changed.has(c) && <i className="absolute -right-1 -top-1 size-[11px] rounded-full border-2 border-white bg-[#f59e0b] shadow-[0_1px_3px_rgba(180,83,9,0.4)]" />}
              </button>
            );
          })}
        </div>
      </FormCard>

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        names={toDelete ? [toDelete] : []}
        noun="currency"
        onConfirm={() => {
          onRemove(toDelete);
          setToDelete(null);
        }}
      />
    </>
  );
}

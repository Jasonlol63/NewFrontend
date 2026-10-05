import { useEffect, useState } from "react";
import { Building2, Check, Globe, Layers, ListChecks, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { Field, PasswordInput, SelectField, SoftButton, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import MemberRow from "./MemberRow.jsx";
import {
  NO_GROUP,
  SECONDARY_PASSWORD_LENGTH,
  buildDraft,
  canSave,
  companyChange,
  countChanges,
  isSecondaryPasswordValid,
  normalizeCode,
  snapshotOf,
} from "./domainFormRules";

// Width tiers come from the content area (@container/main = screen minus sidebar), height tiers are the
// modal-compact / modal-short / modal-tiny variants of index.css; class names are written out in full so
// Tailwind can see them. Short screens keep the lists tall: the Domain Information fields stay on one row,
// the add-row labels go (the placeholders say it), and Multiple Choice takes the add row's place.

const smallButton = "h-[30px] px-3.5 text-[12.5px] modal-tiny:h-7";
const addButton = cn(
  primaryButtonClass,
  "h-9 flex-none px-[18px] text-[13px] @min-[900px]/main:@max-[1099px]/main:h-8 modal-compact:h-[30px] modal-tiny:h-7"
);

/**
 * Add Domain / Edit Domain: the same modal, only the title text and a few fields differ.
 * Fills the content area (the sidebar stays visible), Domain page blurred behind. Mount it only while open.
 * mode: "add" | "edit"; domain: the list row being edited (edit mode).
 *
 * Joining / leaving a group, adding and removing only change this draft; the database is only touched
 * by Save (UI only for now: Save just hands the draft back through onSave).
 *  - Quick: click the group chip of a company and pick a group (or "No group").
 *  - Multiple Choice: tick companies, pick a target group, Done.
 */
export default function DomainFormModal({ mode = "add", domain, onClose, onSave }) {
  const isEdit = mode === "edit";
  const [initial] = useState(() => buildDraft(isEdit ? domain : null));
  const [owner, setOwner] = useState(initial.owner);
  const [groups, setGroups] = useState(initial.groups);
  const [companies, setCompanies] = useState(initial.companies);
  // What Edit opened with, to count what is still unsaved.
  const [base] = useState(() => (isEdit ? snapshotOf(initial) : null));

  const [groupInput, setGroupInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [companyGroup, setCompanyGroup] = useState(NO_GROUP);
  const [groupError, setGroupError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [notice, setNotice] = useState("");

  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState(""); // "" = not chosen yet, NO_GROUP = take out of their group

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const setField = (key) => (e) => setOwner((o) => ({ ...o, [key]: e.target.value }));
  const setSecondary = (e) =>
    setOwner((o) => ({ ...o, secondaryPassword: e.target.value.replace(/\D/g, "").slice(0, SECONDARY_PASSWORD_LENGTH) }));
  const secondaryBad = !isEdit && owner.secondaryPassword.length > 0 && !isSecondaryPasswordValid(owner.secondaryPassword);

  const groupOptions = groups.length
    ? [{ value: NO_GROUP, label: "No group" }, ...groups.map((g) => ({ value: g.code, label: g.code }))]
    : [{ value: NO_GROUP, label: "No groups created" }];

  const addGroup = () => {
    const code = normalizeCode(groupInput);
    if (!code) return setGroupError("Enter a Group ID");
    if (groups.some((g) => g.code === code)) return setGroupError(`${code} is already added`);
    setGroupError("");
    setGroups((list) => [...list, { code, date: "" }]);
    setGroupInput("");
  };
  const addCompany = () => {
    const code = normalizeCode(companyInput);
    if (!code) return setCompanyError("Enter a Company ID");
    if (companies.some((c) => c.code === code)) return setCompanyError(`${code} is already added`);
    setCompanyError("");
    setCompanies((list) => [...list, { code, group: companyGroup === NO_GROUP ? "" : companyGroup, date: "" }]);
    setCompanyInput("");
  };
  // A removed group lets go of its companies: they stay, but in no group.
  const removeGroup = (code) => {
    setGroups((list) => list.filter((g) => g.code !== code));
    setCompanies((list) => list.map((c) => (c.group === code ? { ...c, group: "" } : c)));
    if (companyGroup === code) setCompanyGroup(NO_GROUP);
    if (target === code) setTarget("");
  };
  const removeCompany = (code) => {
    setCompanies((list) => list.filter((c) => c.code !== code));
    setPicked((set) => {
      const next = new Set(set);
      next.delete(code);
      return next;
    });
  };
  const moveCompany = (code, group) => {
    setCompanies((list) => list.map((c) => (c.code === code ? { ...c, group } : c)));
    setNotice(group ? `${code} moved to ${group}` : `${code} left its group`);
  };

  const exitMulti = () => {
    setMulti(false);
    setPicked(new Set());
    setTarget("");
  };
  const togglePick = (code) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const applyBulk = () => {
    if (!picked.size || !target) return;
    const group = target === NO_GROUP ? "" : target;
    const count = picked.size;
    setCompanies((list) => list.map((c) => (picked.has(c.code) ? { ...c, group } : c)));
    exitMulti();
    setNotice(`${count} ${count === 1 ? "company" : "companies"} ${group ? `moved to ${group}` : "taken out of their group"}`);
  };

  const changes = countChanges(base, { groups, companies });
  const save = () => onSave?.({ owner, groups, companies });

  return (
    <FormModal
      icon={Globe}
      title={isEdit ? "Edit Domain" : "Add Domain"}
      onClose={onClose}
      onSave={save}
      saveDisabled={!canSave(isEdit, owner)}
      footerStart={
        isEdit &&
        changes > 0 && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[#8a5a00] @max-[599px]/main:basis-full">
            <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
            {changes} unsaved change{changes === 1 ? "" : "s"}
            <span className="font-medium text-[#8a96a8] @max-[899px]/main:hidden">applied when you press Save</span>
          </p>
        )
      }
      bodyClassName={cn(
        "grid grid-cols-2 grid-rows-[auto_minmax(0,1fr)]",
        "@max-[899px]/main:grid-cols-1 @max-[899px]/main:grid-rows-[max-content_minmax(340px,auto)_minmax(340px,auto)] @max-[899px]/main:content-start @max-[899px]/main:overflow-y-auto"
      )}
    >
      <FormCard title="Domain Information" className="col-span-full" bodyClassName="overflow-visible">
        <div
          className={cn(
            "grid gap-3 modal-compact:gap-2.5 modal-tiny:gap-2",
            isEdit
              ? "grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.7fr)_minmax(0,1.3fr)]"
              : "grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]",
            "@max-[899px]/main:grid-cols-2"
          )}
        >
          <Field label="Owner Code">
            <TextInput value={owner.ownerCode} onChange={setField("ownerCode")} autoComplete="off" className="uppercase" />
          </Field>
          <Field label="Name">
            <TextInput value={owner.name} onChange={setField("name")} autoComplete="off" />
          </Field>
          <Field label="Email">
            <TextInput type="email" inputMode="email" value={owner.email} onChange={setField("email")} autoComplete="off" />
          </Field>
          <Field label="Password" optional={isEdit}>
            <PasswordInput value={owner.password} onChange={setField("password")} />
          </Field>
          {!isEdit && (
            <Field label="Secondary Password" as="div">
              <PasswordInput
                value={owner.secondaryPassword}
                onChange={setSecondary}
                inputMode="numeric"
                placeholder="6 digits only"
                aria-invalid={secondaryBad || undefined}
                className={secondaryBad ? "border-[#ef4444] focus:border-[#ef4444] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : undefined}
              />
              <p className={cn("m-0 mt-1 ml-0.5 text-[11px] modal-compact:hidden", secondaryBad ? "text-[#dc2626]" : "text-[#8a96a8]")}>
                Must be exactly 6 digits (0-9)
              </p>
            </Field>
          )}
        </div>
      </FormCard>

      <FormCard title="Groups" right={<CardCount>{groups.length} added</CardCount>} bodyClassName="flex flex-col gap-2.5 overflow-hidden modal-compact:gap-2">
        <AddRow
          label="Group ID"
          placeholder="GROUP ID"
          value={groupInput}
          onChange={setGroupInput}
          onAdd={addGroup}
          error={groupError}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {groups.length ? (
            groups.map((g) => (
              <MemberRow key={g.code} code={g.code} date={g.date} onRemove={() => removeGroup(g.code)} />
            ))
          ) : (
            <EmptyList icon={Layers} text="No groups added yet" />
          )}
        </div>
      </FormCard>

      <FormCard
        title="Companies"
        right={
          <>
            <CardCount>{companies.length} added</CardCount>
            <SoftButton
              aria-pressed={multi}
              onClick={() => (multi ? exitMulti() : setMulti(true))}
              className={cn(
                "h-[26px] gap-[5px] rounded-lg px-3 text-[12px]",
                multi && "border-transparent bg-brand-sweep text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.65)] hover:bg-brand-sweep hover:brightness-105"
              )}
            >
              <ListChecks className="size-[13px]" strokeWidth={2.4} />
              Multiple Choice
            </SoftButton>
          </>
        }
        bodyClassName="flex flex-col gap-2.5 overflow-hidden modal-compact:gap-2"
      >
        {multi ? (
          <div className="flex flex-none flex-wrap items-center gap-2 rounded-xl border border-[#cfe0fa] bg-[linear-gradient(90deg,#eaf3ff_0%,#f7fbff_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] modal-tiny:p-1.5 @min-[1100px]/main:flex-nowrap">
            <div className="flex flex-none items-center gap-2.5 text-[12.5px] text-brand-navy">
              <b className="font-extrabold">{picked.size} selected</b>
              <button type="button" disabled={!companies.length} onClick={() => setPicked(new Set(companies.map((c) => c.code)))} className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-bold text-[#1d7bff] hover:underline disabled:cursor-not-allowed disabled:text-dash-faint">
                All
              </button>
              <button type="button" onClick={() => setPicked(new Set())} className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-bold text-[#1d7bff] hover:underline">
                Clear
              </button>
            </div>
            <div className="max-w-[210px] min-w-[110px] flex-[1_1_130px]">
              <SelectField value={target} onChange={setTarget} options={groupOptions} placeholder="Move to group…" />
            </div>
            <SoftButton onClick={exitMulti} className={smallButton}>
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={applyBulk}
              disabled={!picked.size || !target || !groups.length}
              className={cn(primaryButtonClass, smallButton, "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100")}
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              {picked.size ? `Done (${picked.size})` : "Done"}
            </button>
          </div>
        ) : (
          <AddRow
            label="Company ID"
            placeholder="COMPANY ID"
            value={companyInput}
            onChange={setCompanyInput}
            onAdd={addCompany}
            error={companyError}
            extra={
              <Field label="Group" optional className="max-w-[170px] flex-none basis-[170px]">
                <SelectField value={companyGroup} onChange={setCompanyGroup} options={groupOptions} />
              </Field>
            }
          />
        )}
        {notice && (
          <p role="status" className="m-0 -mt-1 ml-0.5 flex-none text-[11.5px] font-semibold text-[#0f7a4f]">
            {notice}
          </p>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {companies.length ? (
            companies.map((c) => (
              <MemberRow
                key={c.code}
                code={c.code}
                date={c.date}
                group={c.group}
                groups={groups}
                onMove={(group) => moveCompany(c.code, group)}
                change={companyChange(base, c)}
                selectable={multi}
                picked={picked.has(c.code)}
                onPick={() => togglePick(c.code)}
                onRemove={() => removeCompany(c.code)}
              />
            ))
          ) : (
            <EmptyList icon={Building2} text="No companies added yet" />
          )}
        </div>
      </FormCard>
    </FormModal>
  );
}

// "Group ID [input] [Add]" with an optional extra control (the group of a new company) and an error line.
// The labels go on short screens: the placeholders already say what each box is.
function AddRow({ label, placeholder, value, onChange, onAdd, error, extra }) {
  return (
    <div className="flex-none">
      <div className="flex items-end gap-2 modal-short:items-center modal-short:[&_label>span]:hidden">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 ml-0.5 block truncate text-[12.5px] font-semibold text-[#374151] modal-compact:mb-0.5 modal-compact:text-[12px]">{label}</span>
          <TextInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
            placeholder={placeholder}
            autoComplete="off"
            className="uppercase placeholder:normal-case"
          />
        </label>
        {extra}
        <button type="button" onClick={onAdd} className={addButton}>
          <Plus className="size-[15px]" strokeWidth={2.5} />
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 mt-1 ml-0.5 text-[11px] font-medium text-[#dc2626]">
          {error}
        </p>
      )}
    </div>
  );
}

function EmptyList({ icon: Icon, text }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgba(130,155,195,0.45)] p-2.5 text-center text-[12.5px] text-[#8a96a8]">
      <Icon className="size-[22px] opacity-70" strokeWidth={1.8} />
      {text}
    </div>
  );
}

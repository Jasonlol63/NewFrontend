import { Check, Layers, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Count } from "./AccessListCard.jsx";

/**
 * Company access of the user being added / edited: one chip per Group and Company this login can open, ticked
 * when the user may enter it. It only grants entry; the Account / Process lists under it belong to the company
 * the Admin page is in.
 * groups / companies: [{ code, tenantId }]; selected: Set of tenantId; onToggle(tenantId).
 * lockedId: the company the Admin page is in. It stays ticked: the lists below are saved into it, and removing the
 * user from the company being managed would make the user vanish from this very list.
 */
export default function CompanyAccessBar({ groups, companies, selected, onToggle, lockedId, loading, className }) {
  const { t } = useTranslation("admin");
  // A Group this login can only see (no tenantId) can not be granted, so it is not counted.
  const grantable = [...groups, ...companies].filter((c) => c.tenantId);
  const total = grantable.length;
  const count = grantable.filter((c) => selected.has(c.tenantId)).length;

  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-1.5 rounded-2xl border border-modal-line bg-modal-card px-3.5 py-2.5 shadow-modal-card",
        "@min-[900px]/main:@max-[1099px]/main:gap-1 @min-[900px]/main:@max-[1099px]/main:px-2.5 @min-[900px]/main:@max-[1099px]/main:py-2",
        "modal-compact:gap-1 modal-compact:px-3 modal-compact:py-1.5 modal-tiny:px-2.5 modal-tiny:py-1",
        className
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="h-3.5 w-1 flex-none translate-y-[2px] rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
        <h2 className="m-0 whitespace-nowrap fm-section text-brand-navy">{t("form.companyAccess")}</h2>
        {!loading && <Count value={count} total={total} />}
      </div>
      {/* Many companies wrap onto more lines and scroll here, so the lists below never lose their height. */}
      <div className="flex max-h-[84px] min-h-0 flex-col gap-1 overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-compact:max-h-[64px] modal-tiny:max-h-[56px]">
        {loading ? (
          <p className="m-0 fm-help text-dash-faint">{t("access.loading")}</p>
        ) : (
          <>
            {/* The Group row is always there, even for a login with no Group access of its own. */}
            <ChipRow label={t("form.group")}>
              {groups.length === 0 ? (
                <span className="pt-[3px] fm-help text-dash-faint">{t("form.noGroup")}</span>
              ) : (
                groups.map((g) => (
                  <Chip key={g.code} item={g} group on={selected.has(g.tenantId)} locked={g.tenantId === lockedId} onToggle={onToggle} />
                ))
              )}
            </ChipRow>
            {companies.length > 0 && (
              <ChipRow label={t("form.company")}>
                {companies.map((c) => (
                  <Chip key={c.tenantId} item={c} on={selected.has(c.tenantId)} locked={c.tenantId === lockedId} onToggle={onToggle} />
                ))}
              </ChipRow>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ChipRow({ label, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-[76px] flex-none pt-[2px] fm-label text-[#374151] @max-[599px]/main:w-auto @max-[599px]/main:pr-1">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1 @max-[599px]/main:flex-nowrap @max-[599px]/main:overflow-x-auto @max-[599px]/main:pb-1 @max-[599px]/main:[scrollbar-width:none]">
        {children}
      </div>
    </div>
  );
}

function Chip({ item, group = false, on, locked, onToggle }) {
  const { t } = useTranslation("admin");
  const unavailable = !item.tenantId;
  return (
    <button
      type="button"
      onClick={() => !locked && !unavailable && onToggle(item.tenantId)}
      aria-pressed={on}
      aria-disabled={locked || unavailable || undefined}
      title={unavailable ? t("form.noGroupAccess", { code: item.code }) : locked ? t("form.currentCompany", { code: item.code }) : item.code}
      className={cn(
        "flex h-[26px] flex-none items-center gap-1.5 rounded-lg border pl-1.5 pr-2 fm-btn-sm transition-colors modal-compact:h-6 modal-tiny:h-[22px]",
        locked || unavailable ? "cursor-default" : "cursor-pointer",
        unavailable && "opacity-50",
        on ? "border-[#7fb2ff] bg-row-stripe text-brand-navy" : "border-modal-off-line bg-modal-off text-[#374151] hover:border-[#93c5fd]"
      )}
    >
      <span
        className={cn(
          "flex size-4 flex-none items-center justify-center rounded-[5px] transition-colors",
          on ? "bg-brand-sweep text-white shadow-[0_3px_6px_-3px_rgba(20,90,220,0.6)]" : "border border-[#c3d3ea] bg-modal-input"
        )}
      >
        {on && <Check className="size-2.5" strokeWidth={4} />}
      </span>
      {group && <Layers className="size-3 flex-none text-[#5b74a3]" strokeWidth={2.2} />}
      <span className="whitespace-nowrap">{item.code}</span>
      {locked && <Lock className="size-3 flex-none text-[#5b74a3]" strokeWidth={2.2} />}
    </button>
  );
}

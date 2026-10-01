import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Eye, EyeOff, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import MainOverlay from "@/components/layout/MainOverlay.jsx";
import AccessListCard, { Count } from "./AccessListCard.jsx";
import { PERMISSIONS, ROLE_OPTIONS } from "./addUserOptions";
import { MOCK_ACCOUNTS, MOCK_PROCESSES } from "./addUserMockData";

// Width tiers come from the content area (@container/main = screen minus sidebar):
//   @min-[900px]/main:@max-[1099px]/main = compact 3 columns (1200-1366 with the sidebar, 1024-1180 with the rail)
//   @max-[899px]/main = tablets: info on top, the two lists below; @max-[599px]/main = phones
// Height tiers use the modal-compact / modal-tiny / modal-tall variants from index.css.
// Class names are written out in full so Tailwind can see them.

const EMPTY_FORM = { loginId: "", password: "", name: "", role: "", email: "" };

/**
 * Add User: fills the content area (the sidebar stays visible), Admin page blurred behind.
 * Mount it only while open so every opening starts from an empty form.
 * UI only for now: accounts / processes are placeholder rows and Save just hands the draft
 * back through onSave.
 */
export default function AddUserModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [perms, setPerms] = useState(() => new Set());
  // New users get every account and process by default; the admin unticks what they shouldn't see.
  const [accounts, setAccounts] = useState(() => new Set(MOCK_ACCOUNTS.map((a) => a.id)));
  const [processes, setProcesses] = useState(() => new Set(MOCK_PROCESSES.map((p) => p.id)));

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const togglePerm = (key) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = () =>
    onSave?.({
      ...form,
      readOnly,
      permissions: [...perms],
      accountIds: [...accounts],
      processIds: [...processes],
    });

  return (
    <MainOverlay>
      <div className="@container/main absolute inset-0 z-30 flex animate-dialog-overlay motion-reduce:animate-none">
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(214,230,252,0.72)] backdrop-blur-[12px]" />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          className={cn(
            "relative z-10 m-[clamp(8px,1.6dvh,16px)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-white",
            "[--gap:clamp(8px,1.5dvh,14px)] [--pad:clamp(10px,2dvh,18px)]",
            "@min-[900px]/main:@max-[1099px]/main:[--gap:8px] @min-[900px]/main:@max-[1099px]/main:[--pad:10px]",
            "modal-compact:[--gap:8px] modal-compact:[--pad:10px] modal-tiny:m-2 modal-tiny:[--gap:6px] modal-tiny:[--pad:8px]",
            "@max-[599px]/main:m-2 @max-[599px]/main:rounded-[18px]"
          )}
        >
          <header className="flex flex-none items-center justify-between gap-3 px-[calc(var(--pad)+6px)] pt-(--pad)">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] modal-compact:size-8 modal-compact:rounded-[10px] modal-tiny:size-7 modal-tiny:rounded-lg">
                <UserPlus className="size-5 modal-tiny:size-4" strokeWidth={2.2} />
              </div>
              <h1
                id="add-user-title"
                className="m-0 whitespace-nowrap text-[clamp(20px,2.6dvh,26px)] font-extrabold leading-[1.1] tracking-[-0.3px] text-brand-navy modal-compact:text-[20px] modal-tiny:text-[18px]"
              >
                Add User
              </h1>
            </div>
            <SoftButton onClick={onClose} className="h-9 px-4 modal-compact:h-8 modal-tiny:h-[30px] modal-tiny:px-3">
              <ChevronLeft className="size-[15px]" strokeWidth={2.5} />
              Back
            </SoftButton>
          </header>

          <div
            className={cn(
              "grid min-h-0 flex-1 gap-(--gap) px-(--pad) py-(--gap)",
              "grid-cols-[clamp(300px,22cqw,380px)_minmax(0,1fr)_minmax(0,1fr)]",
              "@min-[900px]/main:@max-[1099px]/main:grid-cols-[clamp(256px,27cqw,280px)_minmax(0,1fr)_minmax(0,1fr)]",
              "@max-[899px]/main:grid-cols-2 @max-[899px]/main:grid-rows-[max-content_minmax(420px,62dvh)] @max-[899px]/main:content-start @max-[899px]/main:overflow-y-auto",
              "@max-[599px]/main:grid-cols-1 @max-[599px]/main:grid-rows-[max-content_440px_440px]"
            )}
          >
            <UserInfoCard
              form={form}
              setField={setField}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              readOnly={readOnly}
              onToggleReadOnly={() => setReadOnly((v) => !v)}
              perms={perms}
              onTogglePerm={togglePerm}
            />
            <AccessListCard title="Account" items={MOCK_ACCOUNTS} selected={accounts} onChange={setAccounts} />
            <AccessListCard title="Process" items={MOCK_PROCESSES} selected={processes} onChange={setProcesses} />
          </div>

          <footer className="flex flex-none items-center justify-end gap-2 border-t border-[#dbe7fb] px-(--pad) pb-(--pad) pt-2.5 modal-compact:pt-1.5">
            <SoftButton onClick={onClose} className="h-[38px] min-w-[112px] px-[22px] text-[13.5px] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={save}
              className="inline-flex h-[38px] min-w-[112px] cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-none bg-brand-sweep px-[22px] text-[13.5px] font-bold text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] hover:brightness-105 modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1"
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              Save
            </button>
          </footer>
        </div>
      </div>
    </MainOverlay>
  );
}

function UserInfoCard({ form, setField, showPassword, onTogglePassword, readOnly, onToggleReadOnly, perms, onTogglePerm }) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dbe7fb] bg-white", "@max-[899px]/main:col-span-full")}>
      <div
        className={cn(
          "flex flex-none items-center gap-2 border-b border-[#eef2f7] px-3.5 pb-2.5 pt-3",
          "@min-[900px]/main:@max-[1099px]/main:px-2.5 @min-[900px]/main:@max-[1099px]/main:pb-2 @min-[900px]/main:@max-[1099px]/main:pt-[9px]",
          "modal-compact:px-3 modal-compact:pb-1.5 modal-compact:pt-[7px] modal-tiny:px-2.5 modal-tiny:pb-[5px] modal-tiny:pt-1.5"
        )}
      >
        <span className="h-4 w-1 flex-none rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
        <h2 className={cn("m-0 whitespace-nowrap text-[16px] font-extrabold text-brand-navy", "@min-[900px]/main:@max-[1099px]/main:text-[14.5px]", "modal-tiny:text-[14px]")}>
          User Information
        </h2>
      </div>

      {/* Scrolls on its own if the screen is too short, so nothing is ever clipped. */}
      <div
        className={cn(
          "@container/info flex min-h-0 flex-1 flex-col overflow-y-auto px-3.5 pb-3.5 pt-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
          "@min-[900px]/main:@max-[1099px]/main:p-2.5",
          "modal-compact:px-3 modal-compact:pb-2.5 modal-compact:pt-2 modal-tiny:px-2.5 modal-tiny:pb-2 modal-tiny:pt-1.5",
          "@max-[899px]/main:block @max-[899px]/main:overflow-visible"
        )}
      >
        <div className="grid flex-none grid-cols-2 gap-x-3 gap-y-2.5 modal-compact:gap-x-2.5 modal-compact:gap-y-1.5 modal-tiny:gap-x-2 modal-tiny:gap-y-1 @min-[560px]/info:grid-cols-3">
          <Field label="Login ID" className="col-span-2 @min-[560px]/info:col-span-1">
            <TextInput value={form.loginId} onChange={setField("loginId")} autoComplete="off" />
          </Field>
          <Field label="Password" className="col-span-2 @min-[560px]/info:col-span-1">
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={setField("password")}
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 flex -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-dash-faint hover:text-[#64748b]"
              >
                {showPassword ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
              </button>
            </div>
          </Field>
          <Field label="Name">
            <TextInput value={form.name} onChange={setField("name")} className="uppercase" />
          </Field>
          <Field label="Role">
            <div className="relative">
              <select
                value={form.role}
                onChange={setField("role")}
                className={cn(inputClass, "cursor-pointer appearance-none pr-8", !form.role && "text-dash-faint")}
              >
                <option value="" disabled>
                  Select Role
                </option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value} className="text-[#111827]">
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dash-faint" strokeWidth={2} />
            </div>
          </Field>
          <Field label="Email" className="col-span-2">
            <TextInput type="email" inputMode="email" value={form.email} onChange={setField("email")} autoComplete="off" />
          </Field>
        </div>

        <div className="my-3 h-px flex-none bg-[#eef2f7] modal-compact:mb-2 modal-compact:mt-2.5 modal-tiny:mb-1.5 modal-tiny:mt-2" />

        <div className="mb-2 flex flex-none flex-wrap items-center justify-between gap-2 modal-compact:mb-1.5 modal-tiny:mb-1">
          <div className="flex items-baseline gap-[5px] text-[13px] font-extrabold text-brand-navy">
            Permissions <Count value={perms.size} total={PERMISSIONS.length} />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={readOnly}
            onClick={onToggleReadOnly}
            className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[12px] font-semibold text-[#475569]"
          >
            <span className={cn("relative h-[18px] w-8 rounded-full transition-colors", readOnly ? "bg-brand-sweep" : "bg-[#cbd5e1]")}>
              <span
                className={cn(
                  "absolute top-0.5 size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left]",
                  readOnly ? "left-4" : "left-0.5"
                )}
              />
            </span>
            Read only
          </button>
        </div>

        {/* In the 3-column layout the grid stretches to fill the card's remaining height. */}
        <div
          className={cn(
            "grid grid-cols-2 gap-1.5 @min-[560px]/info:grid-cols-4",
            "@min-[900px]/main:max-h-[226px] @min-[900px]/main:flex-[1_0_auto] @min-[900px]/main:auto-rows-[minmax(38px,1fr)]",
            "@min-[900px]/main:modal-tall:max-h-[450px] @min-[900px]/main:modal-tall:grid-cols-1 @min-[900px]/main:modal-tall:auto-rows-[minmax(40px,1fr)]",
            "@min-[900px]/main:modal-compact:max-h-[160px] @min-[900px]/main:modal-compact:auto-rows-[minmax(30px,1fr)]",
            "modal-tiny:gap-1 @min-[900px]/main:modal-tiny:auto-rows-[minmax(28px,1fr)]"
          )}
        >
          {PERMISSIONS.map((p) => (
            <PermissionItem key={p.key} perm={p} on={perms.has(p.key)} onToggle={() => onTogglePerm(p.key)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PermissionItem({ perm, on, onToggle }) {
  const Icon = perm.icon;
  // The icon doubles as the checkbox: grey when off, brand gradient when on.
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={perm.label}
      className={cn(
        "flex min-h-[38px] min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border px-2 py-1.5 text-left text-[12.5px] font-semibold transition-colors",
        "@min-[900px]/main:@max-[1099px]/main:gap-1.5 @min-[900px]/main:@max-[1099px]/main:px-1.5 @min-[900px]/main:@max-[1099px]/main:py-1 @min-[900px]/main:@max-[1099px]/main:text-[11.5px]",
        "modal-compact:min-h-[30px] modal-compact:gap-1.5 modal-compact:px-[7px] modal-compact:py-[3px] modal-compact:text-[12px]",
        "modal-tiny:min-h-7 modal-tiny:px-1.5 modal-tiny:py-0.5",
        // Narrow info column (1024 / 1200 screens): smaller still, and it must win over the height tiers.
        "@max-[250px]/info:gap-[5px]! @max-[250px]/info:px-[5px]! @max-[250px]/info:text-[11px]!",
        on ? "border-[#7fb2ff] bg-row-stripe text-brand-navy" : "border-dash-line bg-white text-[#374151] hover:border-[#93c5fd]"
      )}
    >
      <span
        className={cn(
          "flex size-6 flex-none items-center justify-center rounded-[7px] transition-colors",
          "@min-[900px]/main:@max-[1099px]/main:size-5 @min-[900px]/main:@max-[1099px]/main:rounded-md modal-compact:size-5 modal-compact:rounded-md @max-[250px]/info:size-[18px]! @max-[250px]/info:rounded-[5px]!",
          on ? "bg-brand-sweep text-white shadow-[0_4px_8px_-4px_rgba(20,90,220,0.6)]" : "bg-[#f1f5f9] text-[#94a3b8]"
        )}
      >
        <Icon className="size-3.5 modal-compact:size-3" strokeWidth={2} />
      </span>
      <span className="min-w-0 leading-[1.2]">{perm.label}</span>
    </button>
  );
}

const inputClass =
  "h-9 w-full rounded-[10px] border border-dash-line bg-white px-3 text-[13.5px] text-[#111827] shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] @min-[900px]/main:@max-[1099px]/main:h-8 @min-[900px]/main:@max-[1099px]/main:text-[13px] modal-compact:h-[30px] modal-tiny:h-7 modal-tiny:text-[12.5px]";

function TextInput({ className, ...props }) {
  return <input className={cn(inputClass, className)} {...props} />;
}

function Field({ label, className, children }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 ml-0.5 block text-[12.5px] font-semibold text-[#374151] modal-compact:mb-0.5 modal-compact:text-[12px] modal-tiny:mb-px modal-tiny:text-[11.5px]">
        {label} <i className="not-italic text-[#ef4444]">*</i>
      </span>
      {children}
    </label>
  );
}

function SoftButton({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[#cfe0fb] bg-[#eaf2ff] text-[13px] font-bold text-brand-navy hover:bg-[#dce9ff]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

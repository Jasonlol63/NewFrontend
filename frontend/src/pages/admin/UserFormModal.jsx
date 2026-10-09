import { useEffect, useRef, useState } from "react";
import { UserPen, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, PasswordInput, SelectField, TextInput, ToggleSwitch } from "@/components/shared/form-modal/fields.jsx";
import AccessListCard, { Count } from "./AccessListCard.jsx";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, roleOptionsFor } from "./addUserOptions";
import { SECOND_PASSWORD_LENGTH, buildOwnerPayload, buildUserPayload, sameSet, validateUserForm } from "./userFormRules";
import { useAccountItems, useProcessItems, useUserDetail } from "./useUserFormData";
import { normRole } from "./userListRules";

// Width tiers come from the content area (@container/main = screen minus sidebar):
//   @min-[900px]/main:@max-[1099px]/main = compact 3 columns (1200-1366 with the sidebar, 1024-1180 with the rail)
//   @max-[899px]/main = tablets: info on top, the two lists below; @max-[599px]/main = phones
// Height tiers use the modal-compact / modal-tiny / modal-tall variants from index.css.
// Class names are written out in full so Tailwind can see them.

const EMPTY_FORM = { loginId: "", password: "", secondaryPassword: "", name: "", role: "", email: "" };

// The optional 2nd Password field is shown for every user of this company, and for the Owner
// in any company (Edit User on the Owner row). Group views never show it otherwise.
const SECOND_PASSWORD_COMPANY = "C168";

const ADD_URL = "/api/userlist/add";
const UPDATE_URL = "/api/userlist/update";
const OWNER_URL = "/api/userlist/update-owner-profile";
const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

/**
 * Add User / Edit User: the same modal, only the title (and header icon) changes.
 * Fills the content area (the sidebar stays visible), Admin page blurred behind.
 * Mount it only while open so every opening starts from its initial values.
 * mode: "add" | "edit"; user: the list row being edited (edit mode).
 * tenantId / companyCode: the company picked on the Admin page (companyCode null when a Group itself is picked).
 * viewer: the logged-in account, to offer only the roles it may assign.
 * Edit loads the full record (permissions, account / process access); Account and Process come from the
 * company's own lists. Save hands { url, body } to onSave, which posts it and closes the modal; if it
 * throws, the message is shown in the footer. The Owner row only edits its own profile (name, email,
 * passwords), so it shows just the information card.
 */
export default function UserFormModal({ mode = "add", user, tenantId, companyCode, viewer, onClose, onSave }) {
  const isEdit = mode === "edit";
  const isOwnerRow = isEdit && Boolean(user?.isOwnerShadow);
  const title = isEdit ? "Edit User" : "Add User";
  const HeaderIcon = isEdit ? UserPen : UserPlus;
  const showSecondPassword =
    String(companyCode ?? "").toUpperCase() === SECOND_PASSWORD_COMPANY || (isEdit && user?.role === "owner");
  const [form, setForm] = useState(() =>
    isEdit && user
      ? { ...EMPTY_FORM, loginId: user.loginId ?? "", name: user.name ?? "", email: user.email ?? "", role: user.role ?? "" }
      : EMPTY_FORM
  );
  const [readOnly, setReadOnly] = useState(false);
  // Set by a Save attempt with a 2nd Password of 1-5 digits; the error shows until it's fixed.
  const [triedSave, setTriedSave] = useState(false);
  const secondPasswordRef = useRef(null);
  const [perms, setPerms] = useState(() => new Set());
  const [accounts, setAccounts] = useState(() => new Set());
  const [processes, setProcesses] = useState(() => new Set());
  const [message, setMessage] = useState(""); // validation problem or the backend's error
  const [saving, setSaving] = useState(false);

  // What the lists and the record being edited need before the form is usable. The Owner row
  // needs none of it.
  const accountData = useAccountItems(isOwnerRow ? null : tenantId);
  const processData = useProcessItems(isOwnerRow ? null : tenantId);
  const { detail, error: detailError, loading: detailLoading } = useUserDetail(user?.id, tenantId, isEdit && !isOwnerRow);
  const loadError = accountData.error || processData.error || detailError;
  const ready =
    isOwnerRow || (!accountData.loading && !processData.loading && !detailLoading && !loadError && (!isEdit || Boolean(detail)));

  // Fill the form once everything has arrived: the saved values when editing; for a new user every
  // account and process (the admin unticks what they shouldn't see).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !ready || isOwnerRow) return;
    seeded.current = true;
    const everyAccount = new Set(accountData.items.map((a) => a.id));
    const everyProcess = new Set(processData.items.map((p) => p.id));
    if (isEdit && detail) {
      setForm((f) => ({ ...f, name: detail.name ?? f.name, email: detail.email ?? f.email, role: normRole(detail.role) || f.role }));
      setReadOnly(Boolean(detail.readOnly));
      setPerms(new Set((detail.permissions ?? []).map((p) => String(p).toLowerCase()).filter((p) => PERMISSION_KEYS.has(p))));
      // null = everything (also anything added later)
      setAccounts(detail.accountPermissions == null ? everyAccount : new Set(detail.accountPermissions.map((a) => a.id)));
      setProcesses(detail.processPermissions == null ? everyProcess : new Set(detail.processPermissions.map((p) => p.id)));
    } else {
      setAccounts(everyAccount);
      setProcesses(everyProcess);
    }
  }, [ready, isOwnerRow, isEdit, detail, accountData.items, processData.items]);

  const roleOptions = roleOptionsFor(viewer?.role);
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Login IDs are always upper case: typed letters are converted as they go in, and the cursor stays
  // where it was (setting a changed value would otherwise jump it to the end).
  const setLoginId = (e) => {
    const input = e.target;
    const { selectionStart, selectionEnd } = input;
    setForm((f) => ({ ...f, loginId: input.value.toUpperCase() }));
    requestAnimationFrame(() => input.setSelectionRange(selectionStart, selectionEnd));
  };
  // The permission ticks follow the role while they still match the previous role's defaults (or
  // nothing is ticked yet); once the admin has customised them they stay as they are.
  const setRole = (role) => {
    const defaultsOf = (r) => new Set(ROLE_DEFAULT_PERMISSIONS[r] ?? []);
    setPerms((prev) => (sameSet(prev, defaultsOf(form.role)) ? defaultsOf(role) : prev));
    setForm((f) => ({ ...f, role }));
  };
  // Same format as the login secondary password: digits only, at most 6 (extra input is dropped).
  // No maxLength on the input: it would cut a pasted "12-34 56" before the non-digits are removed.
  const setSecondaryPassword = (e) =>
    setForm((f) => ({ ...f, secondaryPassword: e.target.value.replace(/\D/g, "").slice(0, SECOND_PASSWORD_LENGTH) }));
  const togglePerm = (key) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // The 2nd Password is optional, but once filled it must be all 6 digits (the login checks for 6).
  const secondPasswordIncomplete =
    showSecondPassword && form.secondaryPassword.length > 0 && form.secondaryPassword.length < SECOND_PASSWORD_LENGTH;
  const secondPasswordError = triedSave && secondPasswordIncomplete;

  // The 2nd Password is only sent when the field is shown and filled in (blank in Edit User = keep the current one).
  const save = async () => {
    if (saving || !ready) return;
    if (secondPasswordIncomplete) {
      setTriedSave(true);
      secondPasswordRef.current?.focus();
      return;
    }
    const problem = validateUserForm({ mode, form, perms, isOwnerRow });
    if (problem) {
      setMessage(problem);
      return;
    }
    setMessage("");
    setSaving(true);
    const request = isOwnerRow
      ? { url: OWNER_URL, body: buildOwnerPayload({ userId: user.id, form, showSecondPassword }) }
      : {
          url: isEdit ? UPDATE_URL : ADD_URL,
          body: buildUserPayload({
            mode, userId: user?.id, tenantId, form, showSecondPassword, readOnly, perms, accounts, processes,
            accountItems: accountData.items, processItems: processData.items,
          }),
        };
    try {
      await onSave(request); // closes the modal on success
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  };

  // One line in the footer: the 2nd Password hint, a validation / backend error, a load error, or the loading note.
  const footerNote = secondPasswordError ? "2nd Password must be 6 digits" : message || loadError || (ready ? "" : "Loading…");
  const footerIsError = Boolean(secondPasswordError || message || loadError);

  return (
    <FormModal
      icon={HeaderIcon}
      title={title}
      onClose={onClose}
      onSave={save}
      saveDisabled={!ready || saving}
      footerStart={
        footerNote && (
          <p
            id="second-password-error"
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
        "grid",
        isOwnerRow && "grid-cols-1! grid-rows-none! content-start overflow-y-auto",
        "grid-cols-[clamp(300px,22cqw,380px)_minmax(0,1fr)_minmax(0,1fr)]",
        "@min-[900px]/main:@max-[1099px]/main:grid-cols-[clamp(256px,27cqw,280px)_minmax(0,1fr)_minmax(0,1fr)]",
        "@max-[899px]/main:grid-cols-2 @max-[899px]/main:grid-rows-[max-content_minmax(420px,62dvh)] @max-[899px]/main:content-start @max-[899px]/main:overflow-y-auto",
        "@max-[599px]/main:grid-cols-1 @max-[599px]/main:grid-rows-[max-content_440px_440px]"
      )}
    >
      <UserInfoCard
        form={form}
        setField={setField}
        setLoginId={setLoginId}
        setRole={setRole}
        setSecondaryPassword={setSecondaryPassword}
        showSecondPassword={showSecondPassword}
        secondPasswordRef={secondPasswordRef}
        secondPasswordError={secondPasswordError}
        readOnly={readOnly}
        onToggleReadOnly={() => setReadOnly((v) => !v)}
        perms={perms}
        onTogglePerm={togglePerm}
        isEdit={isEdit}
        isOwnerRow={isOwnerRow}
        roleOptions={roleOptions}
      />
      {!isOwnerRow && (
        <>
          <AccessListCard title="Account" items={accountData.items} selected={accounts} onChange={setAccounts} />
          <AccessListCard title="Process" items={processData.items} selected={processes} onChange={setProcesses} />
        </>
      )}
    </FormModal>
  );
}

function UserInfoCard({ form, setField, setLoginId, setRole, setSecondaryPassword, showSecondPassword, secondPasswordRef, secondPasswordError, readOnly, onToggleReadOnly, perms, onTogglePerm, isEdit, isOwnerRow, roleOptions }) {
  return (
    // The body scrolls on its own if the screen is too short, so nothing is ever clipped.
    <FormCard
      title="User Information"
      className={cn("@max-[899px]/main:col-span-full", isOwnerRow && "mx-auto w-full max-w-[720px]")}
      bodyClassName="@container/info flex flex-col @max-[899px]/main:block @max-[899px]/main:overflow-visible"
    >
        <div className="grid flex-none grid-cols-2 gap-x-3 gap-y-2.5 modal-compact:gap-x-2.5 modal-compact:gap-y-1.5 modal-tiny:gap-x-2 modal-tiny:gap-y-1 @min-[560px]/info:grid-cols-3">
          {/* Login ID | Name share a row so Role gets a full row: long roles ("Customer Service") never clip. */}
          <Field label="Login ID">
            {/* The backend never changes a Login ID once it is created. */}
            <TextInput
              value={form.loginId}
              onChange={setLoginId}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={isEdit}
              className="uppercase disabled:cursor-not-allowed disabled:bg-modal-off disabled:text-dash-faint"
            />
          </Field>
          <Field label="Name">
            <TextInput value={form.name} onChange={setField("name")} className="uppercase" />
          </Field>
          {/* With the 2nd Password, Password | 2nd Password share a row (3 columns: it moves next to Role). */}
          <Field label="Password" optional={isEdit} className={showSecondPassword ? undefined : "col-span-2 @min-[560px]/info:col-span-1"}>
            <PasswordInput value={form.password} onChange={setField("password")} />
          </Field>
          {showSecondPassword && (
            <Field label="2nd Password" optional>
              <PasswordInput
                ref={secondPasswordRef}
                value={form.secondaryPassword}
                onChange={setSecondaryPassword}
                inputMode="numeric"
                aria-invalid={secondPasswordError || undefined}
                aria-describedby={secondPasswordError ? "second-password-error" : undefined}
                className={secondPasswordError ? "border-[#ef4444] focus:border-[#ef4444] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : undefined}
              />
            </Field>
          )}
          {!isOwnerRow && (
            <Field label="Role" className="col-span-2 @min-[560px]/info:col-span-1">
              <SelectField value={form.role} onChange={setRole} options={roleOptions} placeholder="Select Role" />
            </Field>
          )}
          <Field label="Email" className={showSecondPassword && !isOwnerRow ? "col-span-2 @min-[560px]/info:col-span-1" : "col-span-2"}>
            <TextInput type="email" inputMode="email" value={form.email} onChange={setField("email")} autoComplete="off" />
          </Field>
        </div>

        {!isOwnerRow && (
        <>
        <div className="my-3 h-px flex-none bg-modal-divider modal-compact:mb-2 modal-compact:mt-2.5 modal-tiny:mb-1.5 modal-tiny:mt-2" />

        <div className="mb-2 flex flex-none flex-wrap items-center justify-between gap-2 modal-compact:mb-1.5 modal-tiny:mb-1">
          <div className="flex items-baseline gap-[5px] text-[13px] font-extrabold text-brand-navy">
            Permissions <Count value={perms.size} total={PERMISSIONS.length} />
          </div>
          <ToggleSwitch on={readOnly} onToggle={onToggleReadOnly} label="Read only" />
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
        </>
        )}
    </FormCard>
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
        on ? "border-[#7fb2ff] bg-row-stripe text-brand-navy" : "border-modal-off-line bg-modal-off text-[#374151] hover:border-[#93c5fd]"
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

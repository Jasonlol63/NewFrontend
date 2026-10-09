import { toIsoDate } from "@/lib/date";
import { PRESET_DAYS } from "./accountFormOptions";

// Pure rules for the Add / Edit Account form: validation, the Payment Alert <-> API conversion and the
// request body of /api/account/add and /update.

export const ADD_URL = "/api/account/add";
export const UPDATE_URL = "/api/account/update";

// The backend sends a DATE as a timestamp at local midnight ("2026-09-30T16:00:00.000+00:00" for 1 Oct in
// UTC+8); read it back as the local calendar date.
export function toLocalIsoDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : toIsoDate(d);
}

const formatAmount = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "-5,000.00" -> -5000; empty / not a number -> null.
export function parseAlertAmount(text) {
  const raw = String(text ?? "").replace(/[,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

// The Payment Alert card's state for an account row (or the defaults for a new one).
export function alertFromRow(row) {
  const day = row?.alertDay;
  const type = day === "monthly" ? "monthly" : Number.isFinite(Number(day)) && day ? Number(day) : 7;
  return {
    on: Boolean(row?.paymentAlert),
    type,
    custom: type !== "monthly" && !PRESET_DAYS.includes(type), // the Custom day grid is open
    startDate: toLocalIsoDate(row?.alertStartDate) || toIsoDate(new Date()),
    amount: row?.alertAmount == null ? "" : formatAmount(Number(row.alertAmount)),
  };
}

// The four alert fields of the request. Off in Edit keeps what was stored (the account may have been set up
// before); off in Add stores nothing.
export function alertPayload(alert, { keepConfig }) {
  if (!alert.on && !keepConfig) {
    return { paymentAlert: 0, alertDay: null, alertAmount: null, alertSpecificDate: null };
  }
  return {
    paymentAlert: alert.on ? 1 : 0,
    alertDay: String(alert.type),
    alertAmount: parseAlertAmount(alert.amount),
    alertSpecificDate: alert.startDate || null,
  };
}

// The first problem with the form, or "" when it can be saved.
export function validateAccountForm({ mode, form, pickedCount, tenantIds, scopeTenantId }) {
  if (mode === "add" && !form.accountId.trim()) return "Account ID is required";
  if (!form.name.trim()) return "Name is required";
  if (!form.role) return "Role is required";
  if (mode === "add" && !form.password) return "Password is required";
  if (pickedCount === 0) return "Select at least one currency";
  if (tenantIds.length === 0) return "Select at least one company";
  // The new account's currencies are saved for the company being viewed, so it has to be one of them.
  if (mode === "add" && !tenantIds.includes(scopeTenantId)) return "The current company must stay selected";
  return "";
}

// Request body of /add and /update. tenantIds: the companies ticked in the card plus, in Edit, the ones the
// account already has that the card doesn't list (other Groups): the backend replaces the whole list, so
// leaving those out would unbind them.
export function buildAccountPayload({ mode, accountId, scopeTenantId, form, alert, currencyIds, tenantIds, keepAlertConfig }) {
  const common = {
    scopeTenantId,
    name: form.name.trim().toUpperCase(),
    role: form.role,
    remark: form.remark.trim(),
    currencyIds,
    tenantIds,
    ...alertPayload(alert, { keepConfig: keepAlertConfig }),
    // Left blank in Edit Account = keep the current password.
    ...(form.password ? { password: form.password } : {}),
  };
  if (mode === "edit") return { ...common, id: accountId };
  return { ...common, accountId: form.accountId.trim().toUpperCase() };
}

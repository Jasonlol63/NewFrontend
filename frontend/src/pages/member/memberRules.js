// Member Win/Loss: the requests of /api/member/* and the rows of its replies.

import { formatRate, normalizeHistoryRow } from "@/pages/transaction-payment/paymentHistoryRules";
import { moneyText, sumMoney } from "@/lib/money";

export const PROFILE_URL = "/api/member/profile";
export const CURRENCIES_URL = "/api/member/account-currencies/batch";
export const BALANCES_URL = "/api/member/mini-grid-balances";
export const HISTORY_URL = "/api/member/history";

const code = (c) => String(c.code ?? "").toUpperCase();

/**
 * The profile as the page needs it: the accounts to pick from ({ value: db id, label: account code, name }; just the member
 * when nothing is linked), whether the account is linked to others, and the member's own currencies when it is not.
 */
export function normalizeProfile(data) {
  const linked = Boolean(data?.hasAccountLink);
  const accounts = linked
    ? (data.linkedAccounts ?? []).map((a) => ({ value: a.id, label: String(a.accountCode ?? "").toUpperCase(), name: a.name ?? "" }))
    : [{ value: data?.accountId, label: String(data?.accountCode ?? "").toUpperCase(), name: data?.accountName ?? "" }];
  return { accountId: data?.accountId ?? null, tenantId: data?.tenantId ?? null, linked, accounts, ownCurrencies: (data?.currencies ?? []).map(code).filter(Boolean) };
}

/** The codes held by any of the accounts, in the order they first appear. */
export function currencyUnion(batch) {
  return [...new Set((batch ?? []).flatMap((entry) => (entry.currencies ?? []).map(code)).filter(Boolean))];
}

/** Balances as { [accountId]: { [currency]: decimal string } }. */
export function balanceMap(rows) {
  const map = {};
  (rows ?? []).forEach((r) => {
    (map[r.accountId] ??= {})[String(r.currency ?? "").toUpperCase()] = moneyText(r.balance);
  });
  return map;
}

// "-" instead of an empty cell
const dash = (v) => (v ? v : "-");

/** One block per shown currency from the history rows: its rows, the Win/Loss and Cr/Dr sums and the closing balance. bfLabel: how the B/F row's date reads. */
export function buildMemberBlocks(rows, currencies, bfLabel = "B/F") {
  return currencies.map((currency) => {
    const own = rows.map(normalizeHistoryRow).filter((r) => r.currency === currency);
    const lines = own.map((r) => ({
      key: r.key,
      date: r.bf ? bfLabel : dash(r.date),
      product: r.bf ? "-" : dash(r.product),
      rate: r.bf ? "-" : formatRate(r.rate),
      winLoss: r.bf ? "0" : r.winLoss,
      crDr: r.bf ? "0" : r.crDr,
      balance: r.balance,
      description: dash(r.description),
      remark: r.bf ? "-" : dash(r.remark),
    }));
    return {
      currency,
      rows: lines,
      totals: {
        winLoss: sumMoney(lines.map((r) => r.winLoss)),
        crDr: sumMoney(lines.map((r) => r.crDr)),
        balance: lines.length ? lines[lines.length - 1].balance : "0",
      },
    };
  });
}


// Options, validation and the request bodies of the Add / Edit Bank Process modal (/api/bank-process).

export const BANK_ADD_URL = "/api/bank-process/add-bank-process";
export const BANK_UPDATE_URL = "/api/bank-process/update-bank-process";
export const BANK_BALANCE_DELETE_URL = "/api/bank-process/delete-bank-balance";
export const BANK_COUNTRY_ADD_URL = "/api/bank-country-option/insert-country";
export const BANK_COUNTRY_DELETE_URL = "/api/bank-country-option/delete-country";
export const BANK_OPTION_LIST_URL = "/api/bank-country-option/list-bank-option";
export const BANK_OPTION_ADD_URL = "/api/bank-country-option/insert-bank-option";
export const BANK_OPTION_DELETE_URL = "/api/bank-country-option/delete-bank-option";

const options = (list) => list.map((x) => ({ value: x, label: x }));

export const FIRST_OF_MONTH = "FIRST_OF_EVERY_MONTH";
// value = what the backend stores (BankProcess.Frequency).
export const FREQUENCIES = [
  { value: FIRST_OF_MONTH, label: "1st of Every Month" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONCE", label: "Once" },
  { value: "DAY", label: "Daily" },
  { value: "WEEK", label: "Weekly" },
];
// The card owner type is free text in the database (VARCHAR); these are the three the page offers.
export const CARD_OWNER_TYPES = options(["PERSONAL", "BUSINESS", "ENTERPRISE"]);
// "1+1", "1+2", "1+3" are the compensation contracts the backend recognises, and it matches the whole text, so they are
// stored exactly like that; only the label adds "MONTHS". The rest is free text to the backend.
const ONE_PLUS = /^1\+[123]$/;
export const contractLabel = (contract) => (ONE_PLUS.test(String(contract ?? "").trim()) ? `${String(contract).trim()} MONTHS` : contract);
export const CONTRACTS = [
  ...options(["1 MONTH", "2 MONTHS", "3 MONTHS", "6 MONTHS"]),
  ...["1+1", "1+2", "1+3"].map((value) => ({ value, label: contractLabel(value) })),
];

// Only these two run to a Day End; Once uses just Day Start, Daily and Weekly have no end.
export const usesDayEnd = (frequency) => frequency === FIRST_OF_MONTH || frequency === "MONTHLY";

export const money = (v) => String(v).replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const round2 = (n) => Math.round(n * 100) / 100;
export const profitOf = (form) => round2((parseFloat(form.sellPrice) || 0) - (parseFloat(form.buyPrice) || 0));

// The accounts the Supplier, Customer, Company and Profit Sharing selects offer (same list as the old Bank Process page):
// these roles only, and only active accounts. CAPITAL, BANK, CASH, EXPENSES, COMPANY and DEBTOR are not offered.
export const BANK_PICK_ACCOUNT_ROLES = ["PARTNER", "SUPPLIER", "STAFF", "AGENT", "MEMBER", "PROFIT"];
export const isBankPickAccount = (row) => row.status === "active" && BANK_PICK_ACCOUNT_ROLES.includes(String(row.role ?? "").trim().toUpperCase());

// "BA019 [MUAR DASON]" or just "BS005" when the account has no name.
export const accountLabel = (code, name) => (name ? `${String(code).toUpperCase()} [${name}]` : String(code).toUpperCase());

// The first problem with the form, or "" when it can be saved. billingLocked: nothing but SOP, Remark and Insurance is
// saved, and none of those is required.
export function validateBankForm({ isEdit, form, sharing, billingLocked = false }) {
  if (billingLocked) return "";
  if (!isEdit) {
    if (!form.countryId) return "Country is required";
    if (!form.bankId) return "Bank is required";
    if (!form.type) return "Type is required";
    if (!form.cardOwner.trim()) return "Card Owner is required";
  }
  if (!form.dayStart) return "Day Start is required";
  if (!form.frequency) return "Frequency is required";
  if (!form.supplier) return "Supplier is required";
  if (!form.customer) return "Customer is required";
  if (form.buyPrice === "") return "Buy Price is required";
  if (form.sellPrice === "") return "Sell Price is required";
  if (!form.contract) return "Contract is required";
  if (sharing.some((e) => !(Number(e.amount) > 0))) return "Every Profit Sharing amount must be more than 0";
  return "";
}

/**
 * Request of /add-bank-process or /update-bank-process. In Edit the country, bank, card owner and type are not sent
 * (the backend keeps the saved ones). Day End is only sent for the frequencies that have one; its lock switch
 * (dayEndMonthlyCapEnabled) only exists in Edit with 1st of Every Month. Bank Balance is only sent while the process
 * has none yet (the backend ignores it once one is linked). companyPrice is the profit (Sell - Buy).
 */
export function buildBankRequest({ isEdit, id, tenantId, form, sharing, dayEndLocked, balanceLocked, billingLocked = false }) {
  // Official, E-Invoice and Block: the backend keeps every billing field and saves only these three.
  if (billingLocked) {
    return {
      url: BANK_UPDATE_URL,
      body: {
        id,
        tenantId,
        insurancePrice: form.insurance === "" ? null : Number(form.insurance),
        sop: form.sop.toUpperCase(),
        remark: form.remark.toUpperCase(),
      },
    };
  }
  const body = {
    tenantId,
    dayStart: form.dayStart,
    dayEnd: usesDayEnd(form.frequency) && form.dayEnd ? form.dayEnd : null,
    dayEndMonthlyCapEnabled: isEdit && form.frequency === FIRST_OF_MONTH && dayEndLocked,
    frequency: form.frequency,
    supplierAccountId: Number(form.supplier),
    supplierPrice: Number(form.buyPrice),
    customerAccountId: Number(form.customer),
    customerPrice: Number(form.sellPrice),
    companyAccountId: form.company ? Number(form.company) : null,
    companyPrice: profitOf(form),
    contract: form.contract,
    insurancePrice: form.insurance === "" ? null : Number(form.insurance),
    sop: form.sop.toUpperCase(),
    remark: form.remark.toUpperCase(),
    shares: sharing.map((e, i) => ({ accountId: Number(e.account), amount: Number(e.amount), sortOrder: i })),
    ...(!balanceLocked && Number(form.bankBalance) > 0 ? { bankBalance: Number(form.bankBalance) } : {}),
  };
  if (isEdit) return { url: BANK_UPDATE_URL, body: { ...body, id } };
  return {
    url: BANK_ADD_URL,
    body: {
      ...body,
      countryId: Number(form.countryId),
      bankOptionId: Number(form.bankId),
      cardOwner: form.cardOwner.trim().toUpperCase(),
      cardOwnerType: form.type,
    },
  };
}

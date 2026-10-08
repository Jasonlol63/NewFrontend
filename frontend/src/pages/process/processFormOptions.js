// Options of the Add Process modal. Placeholder until the currency API is wired up.
export const MOCK_CURRENCIES = ["EUR", "MYR", "SGD", "USD", "THB", "IDR", "VND", "PHP", "CNY", "HKD", "USDT"].map((c) => ({ value: c, label: c }));

// Sample options of the Bank Process modal, until its APIs are wired up.
const options = (list) => list.map((x) => ({ value: x, label: x }));
export const BANK_MODAL_COUNTRIES = options(["MYR", "SGD", "AUD", "USDT", "IDR"]);
export const BANK_MODAL_BANKS = options(["CIMB (BUSINESS)", "MBB (BUSINESS)", "RHB (BUSINESS)", "OCBC (BUSINESS)", "UOB (BUSINESS)", "MAYBANK (BUSINESS)"]);
export const BANK_MODAL_TYPES = options(["PERSONAL", "BUSINESS"]);
export const BANK_MODAL_FREQUENCIES = options(["1st of Every Month", "Monthly", "Once", "Daily"]);
export const BANK_MODAL_CONTRACTS = options(["1 MONTH", "2 MONTHS", "3 MONTHS", "6 MONTHS", "12 MONTHS"]);
export const BANK_MODAL_ACCOUNTS = options(["BA019 [MUAR DASON]", "BA020 [GROWTH VAULT]", "BC015 [AD VERIZON]", "BC028 [LIANG FISHING]", "BS001", "GP"]);

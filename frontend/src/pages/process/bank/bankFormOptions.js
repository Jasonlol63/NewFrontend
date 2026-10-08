// Sample options of the Bank Process modal, until its APIs are wired up.
const options = (list) => list.map((x) => ({ value: x, label: x }));
export const BANK_MODAL_COUNTRIES = ["MYR", "SGD", "AUD", "USDT", "IDR"];
// Banks belong to a country: a bank is only offered under the country it was created in.
export const BANK_MODAL_BANKS_BY_COUNTRY = {
  MYR: ["CIMB", "MBB", "PBB", "RHB"],
  SGD: ["DBS", "OCBC", "UOB"],
  AUD: ["ANZ", "NAB"],
  USDT: [],
  IDR: ["BCA"],
};
export const BANK_MODAL_TYPES = options(["PERSONAL", "BUSINESS"]);
export const BANK_MODAL_FREQUENCIES = options(["1st of Every Month", "Monthly", "Once", "Daily"]);
export const BANK_MODAL_CONTRACTS = options(["1 MONTH", "2 MONTHS", "3 MONTHS", "6 MONTHS", "12 MONTHS"]);
export const BANK_MODAL_ACCOUNTS = options(["BA019 [MUAR DASON]", "BA020 [GROWTH VAULT]", "BC015 [AD VERIZON]", "BC028 [LIANG FISHING]", "BS001", "GP"]);

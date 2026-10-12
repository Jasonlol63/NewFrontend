// Example data for the tests of the summary (a captured sheet, its rows and accounts). Not used by the page.
import { createRow, resequence } from "./summaryRules.js";

export const MOCK_CAPTURED = {
  rows: [
    ["A", "KAIYUAN", "3000", "MAJOR", "1", "$25.50"],
    ["B", "SHIHUI", "3000", "MINOR", "2", "$12.00"],
    ["C", "AHMAD", "1200", "MAJOR", "2", "$5.00"],
    ["D", 'M99M06 (D)', 'M06-KZ"', "MAJOR", "WIN/PLC", "182", "$1.27", "350", "$9.10", "$10.37", "$930.78", "12.5%", "88", "$45.00", "KZ", "$1,204.30", "77", "$3.60", "2026-10-08"],
    ["E", "TT683951A", "1250.40", "-120.00"],
    ["F", "FREEBIE", "88"],
  ],
};

export const MOCK_ACCOUNTS = ["KY [KAI YUAN]", "SHI HUI [SH]", "AHMAD [AHM]", "LIM WEI [LW]", "TAN KOK [TAN]", "SITI [SIT]", "COMM A [CA]", "COMM B [CB]", "EXPENSES [EXPENSES]"];
export const mockAccountId = (label) => MOCK_ACCOUNTS.indexOf(label) + 1 || null;

// Fresh rows every call (new keys).
export function mockRows() {
  const main = (idProduct, rowIndex, account, formula, extra) => createRow({ idProduct, rowIndex, account, accountId: mockAccountId(account), currency: "MYR", currencyId: 1, formula, ...extra });
  const sub = (idProduct, rowIndex, account, formula, extra) => createRow({ type: "sub", idProduct, rowIndex, account, accountId: mockAccountId(account), currency: "MYR", currencyId: 1, formula, inputMethod: "change_to_negative", ...extra });
  return resequence([
    main("KAIYUAN", 0, "KY [KAI YUAN]", "$2"),
    sub("KAIYUAN", 0, "EXPENSES [EXPENSES]", "$2"),
    main("SHIHUI", 1, "SHI HUI [SH]", "$2"),
    sub("SHIHUI", 1, "EXPENSES [EXPENSES]", "$2"),
    main("AHMAD", 2, "AHMAD [AHM]", "600", { sourcePercent: "2" }),
    sub("AHMAD", 2, "EXPENSES [EXPENSES]", "600", { sourcePercent: "2" }),
    main("LIM WEI", 6, "LIM WEI [LW]", "850.5"),
    sub("LIM WEI", 6, "EXPENSES [EXPENSES]", "850.5"),
    main("TAN KOK", 7, "TAN KOK [TAN]", "4300"),
    sub("TAN KOK", 7, "EXPENSES [EXPENSES]", "4300"),
    main("SITI", 8, "SITI [SIT]", "137.625", { sourcePercent: "2" }),
    sub("SITI", 8, "EXPENSES [EXPENSES]", "137.625", { sourcePercent: "2" }),
    main("TT683951A", 4, "COMM A [CA]", "$2", { description: "COMM" }),
    sub("TT683951A", 4, "COMM B [CB]", "$2", { description: "COMM" }),
    createRow({ idProduct: "FREEBIE", rowIndex: 5 }),
  ]);
}

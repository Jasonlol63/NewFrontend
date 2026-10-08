import { addDays, toIsoDate } from "@/lib/date";

export const SHEET_COLS = 20;
export const SHEET_ROWS = 40;
export const CAPTURE_MODES = [
  { value: "text", label: "1.TEXT" },
  { value: "number", label: "2.NUMBER" },
];

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// Today and the six days before it, newest first: "2026-10-08 (THURSDAY)".
export function dateOptions(today = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, -i);
    return { value: toIsoDate(d), label: `${toIsoDate(d)} (${WEEKDAYS[d.getDay()]})` };
  });
}

// Column letters: 0 -> A ... 25 -> Z, 26 -> AA
export function rowLetter(i) {
  return (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));
}

// TEMPORARY while Data Capture is a UI draft: there is no submitted-processes API yet.
// Once it exists, load this per date + tenant and delete the list below.
export const MOCK_SUBMITTED = [
  { id: 1, code: "QI242A", name: "皇冠", by: "ZERO", date: "05/10/2026", time: "19:20:42" },
  { id: 2, code: "AGK8777", name: "KING855 CT", by: "ZERO", date: "05/10/2026", time: "18:19:15" },
  { id: 3, code: "888KUN", name: "888KING H5 API", by: "ZERO", date: "05/10/2026", time: "18:17:17" },
  { id: 4, code: "M99M06", name: "CITIBET", by: "ZERO", date: "05/10/2026", time: "18:10:39" },
  { id: 5, code: "HKNNC", name: "LIVE22 HKD", by: "9", date: "05/10/2026", time: "18:05:14" },
  { id: 6, code: "CPKUN", name: "CROWDPLAY API", by: "BEE", date: "05/10/2026", time: "17:59:55" },
  { id: 7, code: "BCA31SUB", name: "PS3838", by: "BEE", date: "05/10/2026", time: "17:13:33" },
];

import test from "node:test";
import assert from "node:assert/strict";

import {
  looksLikeSectionTotalsReport,
  tryBuildSectionTotalsMatrix,
} from "./dataCaptureSectionTotalsPasteHelper.js";
import { parsePlainTextMatrix } from "./dataCaptureTextPaste.js";

const figs = (n, start = 1) => Array.from({ length: n }, (_, i) => `${start + i}.00`);
const agent = (id, name) => [id, name, "77", ...figs(20)].join("\t"); // 23 cells
const total = (label) => [label, ...figs(20)].join("\t"); // label + 20 figures = 21 cells

const REPORT = [
  "Sport",
  agent("E1911", "XQ"),
  agent("E1935", "JH069"),
  total("Sport Total ="),
  "E-Games",
  agent("E1912", "JB2"),
  total("E-Games Total ="),
  total("Total ="),
].join("\n");

test("claims the report and moves every footer under the agent columns", () => {
  const m = tryBuildSectionTotalsMatrix(REPORT, "");
  assert.equal(m.length, 8);
  assert.ok(m.every((row) => row.length === 23), "every row is 23 cells wide");
  assert.deepEqual(m[0].slice(0, 3), ["Sport", "", ""]);
  // Sport Total = : label, 2 blanks, then the 20 figures (Turnover is the 4th cell of an agent row)
  assert.deepEqual(m[3].slice(0, 4), ["Sport Total =", "", "", "1.00"]);
  assert.equal(m[3][22], "20.00");
  assert.deepEqual(m[7].slice(0, 4), ["Total =", "", "", "1.00"]);
});

test("Chrome text/plain with CRLF and a trailing blank line is the same report", () => {
  const crlf = REPORT.replace(/\n/g, "\r\n") + "\r\n\r\n";
  assert.equal(looksLikeSectionTotalsReport(crlf), true);
  assert.equal(tryBuildSectionTotalsMatrix(crlf, "").length, 8);
});

test("other reports are not claimed", () => {
  const citibet = "Downline Payment\nNo.\tLvl\tUsername\n1\tPL\tyong\nTotal : (Ringgit Malaysia (RM))\t($872.03)";
  assert.equal(tryBuildSectionTotalsMatrix(citibet, ""), null);
  const subGrand = REPORT.replace("Total =", "GRAND TOTAL").replace("Sport Total =", "SUB TOTAL");
  assert.equal(tryBuildSectionTotalsMatrix(subGrand, ""), null);
  assert.equal(tryBuildSectionTotalsMatrix("A\tB\n1\t2\n3\t4", ""), null);
});

test("a report without the final 'Total =' or without sections is not claimed", () => {
  const noGrand = REPORT.split("\n").slice(0, 7).join("\n");
  assert.equal(tryBuildSectionTotalsMatrix(noGrand, ""), null);
  const noSection = REPORT.split("\n").filter((l) => !/^(Sport|E-Games)$/.test(l)).join("\n");
  assert.equal(tryBuildSectionTotalsMatrix(noSection, ""), null);
});

test("an extra line that is neither a section, an agent row nor a footer keeps the helper out", () => {
  assert.equal(tryBuildSectionTotalsMatrix(REPORT + "\nsomething\textra", ""), null);
});

test("without the helper the plain parser leaves the footers shifted (why the helper exists)", () => {
  const plain = parsePlainTextMatrix(REPORT);
  const sportTotal = plain.find((row) => /^Sport Total/i.test(row[0]));
  assert.notDeepEqual(sportTotal.slice(0, 4), ["Sport Total =", "", "", "1.00"]);
});

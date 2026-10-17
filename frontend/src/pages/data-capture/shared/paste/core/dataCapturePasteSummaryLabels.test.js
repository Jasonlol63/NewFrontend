import test from "node:test";
import assert from "node:assert/strict";

import { isKeptPasteSummaryLabel } from "./dataCapturePasteSummaryLabels.js";
import { sanitizePasteMatrix } from "./dataCapturePasteMatrixSanitize.js";

const body = (id) => [id, "PL", "yong", "Major", "1330", "$27.10", "1420", "$56.80", "$83.90", "($2,605.49)", "$83.90", "($2,605.49)"];

test("Citibet footer 'Total : (Ringgit Malaysia (RM))' is a kept summary label", () => {
  assert.equal(isKeptPasteSummaryLabel("Total : (Ringgit Malaysia (RM))"), true);
  assert.equal(isKeptPasteSummaryLabel("TOTAL: (USD)"), true);
});

test("a row that merely starts with Total is not kept by that rule", () => {
  assert.equal(isKeptPasteSummaryLabel("Total player count"), false);
  assert.equal(isKeptPasteSummaryLabel("Total :"), true, "plain TOTAL with a trailing colon was kept before");
});

test("the Citibet footer row survives the over-select cleanup (it used to be dropped as a truncated stub)", () => {
  const footer = ["Total : (Ringgit Malaysia (RM))", "", "", "", "", "", "", "", "", "", "", "($872.03)"];
  const out = sanitizePasteMatrix([body("1"), body("2"), footer]);
  assert.equal(out.length, 3);
  assert.equal(out[2][0], "Total : (Ringgit Malaysia (RM))");
});

test("a total label with a currency code is a kept summary label", () => {
  assert.equal(isKeptPasteSummaryLabel("GRAND TOTAL (MYR)"), true);
  assert.equal(isKeptPasteSummaryLabel("Grand Total (usd)"), true);
  assert.equal(isKeptPasteSummaryLabel("SUBTOTAL (SGD)"), true);
  assert.equal(isKeptPasteSummaryLabel("SUB (MYR)"), true, "the existing SUB (CCC) rule still holds");
  assert.equal(isKeptPasteSummaryLabel("PLAYER (MYR)"), false);
  assert.equal(isKeptPasteSummaryLabel("GRAND TOTAL (MALAYSIA)"), false);
});

test("an Excel 'GRAND TOTAL (MYR)' footer with #### cells survives the over-select cleanup", () => {
  // The 16-column report the user pasted: six zwe rows, then the Grand Total row (narrow columns show ####).
  const row = (id) => [id, "*****", "1,763.00", "1,763.00", "211.9", "130", "-1,421.10", "1,275.59", "-153.41", "-130", "0", "992.18", "487.41", "-58.49", "0", "428.92"];
  const footer = ["GRAND TOTAL (MYR)", "########", "100%", "15,351.57", "########", "100%", "########", "########", "100%", "########", "########", "", "", "", "", ""];
  const rows = ["zwe59-3", "zwe139-3", "zwe59-6", "zwe139-6", "zwe59-7", "zwe139-7"].map(row);
  const out = sanitizePasteMatrix([...rows, footer]);
  assert.equal(out.length, 7);
  assert.equal(out[6][0], "GRAND TOTAL (MYR)");
  assert.equal(out[0].length, 16, "columns are not trimmed");
});

test("a narrow stub row that is not a summary label is still dropped", () => {
  const out = sanitizePasteMatrix([body("1"), body("2"), ["junk", "x"]]);
  assert.equal(out.length, 2);
});

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

test("a narrow stub row that is not a summary label is still dropped", () => {
  const out = sanitizePasteMatrix([body("1"), body("2"), ["junk", "x"]]);
  assert.equal(out.length, 2);
});

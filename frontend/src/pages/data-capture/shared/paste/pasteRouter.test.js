import test from "node:test";
import assert from "node:assert/strict";

import { createGrid } from "../grid/gridModel.js";
import { applyDataMatrixToGrid } from "./core/dataCapturePasteApply.js";
import { runPasteSession } from "./pasteSession.js";
import { pasteIntoSheet } from "./pasteRouter.js";
import { describePasteNotice, translatePasteNotice } from "./pasteNotice.js";

// Pastes plain text into an empty 26 x 20 sheet; returns { taken, commits, grid (last committed or the original), notes }.
function paste(text, { captureType = "1.Text", anchor = { row: 0, col: 0 }, maxCols = 50, html = "" } = {}) {
  const grid = createGrid(26, 20);
  const commits = [];
  const notes = [];
  const taken = pasteIntoSheet({ clip: { text, html }, grid, anchor, captureType, maxCols, notify: (m, l) => notes.push([m, l]), commit: (g) => commits.push(g) });
  return { taken, commits, grid: commits.at(-1) ?? grid, notes };
}
const values = (grid, r, c0, c1) => grid.cells[r].slice(c0, c1 + 1).map((cell) => cell.value);

test("Text: a tab separated paste lands from the anchor, as one commit", () => {
  const { taken, commits, grid } = paste("ID\tWIN\tLOSS\nA1\t10\t20\nA2\t30\t40", { anchor: { row: 1, col: 2 } });
  assert.equal(taken, true);
  assert.equal(commits.length, 1, "one undo step");
  assert.deepEqual(values(grid, 1, 2, 4), ["ID", "WIN", "LOSS"]);
  assert.deepEqual(values(grid, 3, 2, 4), ["A2", "30", "40"]);
  assert.equal(grid.cells[1][1].value, "", "nothing left of the anchor");
});

// The cap is the apply layer's: a 25 column matrix on a 20 column sheet.
function applyWide(maxCols) {
  const grid = createGrid(26, 20);
  const wide = [Array.from({ length: 25 }, (_, i) => `C${i + 1}`)];
  let out = grid;
  runPasteSession({ grid, anchor: { row: 0, col: 0 }, captureType: "1.Text", maxCols, notify() {}, commit: (g) => (out = g) }, () => applyDataMatrixToGrid(wide, { row: 0, col: 0 }));
  return out;
}

test("the sheet grows for a wide matrix, up to maxCols (the Bank sheet keeps its columns)", () => {
  const open = applyWide(50);
  assert.equal(open.cols, 25);
  assert.equal(open.cells[0][24].value, "C25");
  const capped = applyWide(11);
  assert.equal(capped.cols, 20, "never wider than it already is");
  assert.equal(capped.cells[0][19].value, "C20");
});

test("Return: formula cells expand into label + numbers, plain text never falls back to the generic paste", () => {
  const { taken, grid } = paste("M99M06\tWin: 100*3\t12", { captureType: "4.RETURN" });
  assert.equal(taken, true);
  assert.equal(grid.cells[0][0].value, "M99M06");
  assert.ok(grid.cells[0].some((c) => c.value.includes("100")), "the formula numbers are in the row");
});

test("a paste message is split into translatable pieces", () => {
  const keys = (m) => describePasteNotice(m)?.map(([k]) => k).join("+");
  assert.equal(keys("成功粘贴 12 个单元格 (3 行 x 4 列)!"), "cells");
  assert.equal(keys("成功粘贴 12 个单元格 (3 行 x 4 列)! 按 Ctrl+Z 可撤销"), "cells+tail.undo");
  assert.equal(keys("AWC (2.7): 成功粘贴 8 个单元格 (2 行 x 4 列)，已保持表格行格式!"), "cellsLabeled+tail.tableRow");
  assert.equal(keys("成功粘贴表格 (1 个数据行 x 25 列)，已按字段重排!"), "tableByField");
  assert.equal(keys("成功粘贴 KING855 Win/Loss 9 行 x 13 列"), "report");
  assert.equal(keys("Successfully pasted 5 cells (1 rows x 5 cols)! Press Ctrl+Z to undo"), "cells+tail.undo");
  assert.equal(keys("No cells were pasted from Citibet report."), "noCells");
  assert.equal(keys("Something else"), undefined);
  const t = (key, p) => key + JSON.stringify(p ?? {});
  assert.equal(translatePasteNotice("Something else", t), "Something else");
  assert.match(translatePasteNotice("成功粘贴 12 个单元格 (3 行 x 4 列)!", t), /^capture:paste.cells{.*"cells":"12"/);
});

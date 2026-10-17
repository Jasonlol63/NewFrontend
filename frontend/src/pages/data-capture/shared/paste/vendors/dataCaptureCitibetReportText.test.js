import assert from "node:assert/strict";
import test from "node:test";
import { citibetReportToPasteText } from "./dataCaptureCitibetReportText.js";
import { parseCitibetPaymentReport } from "./dataCaptureCitibetParsers.js";
import { autoDetectCaptureTypeFromPaste } from "../core/dataCapturePasteDetect.js";

// The page's own labels (I18N.setResource of newPayReport.jsp).
const I18N = {
  earnings: "<strong>&nbsp;My Earnings</strong>",
  long_RM: "Ringgit Malaysia (RM)",
  overall: "Overall",
  major: "Major",
  minor: "Minor",
  total: "Total",
  w_p2: "W/P",
  minor2: "Mi",
};
const PAGE = { racing_mode: "summary", cash_mode: false, isOP: false, username: "m99m06" };

// One week of m99m06 as the site ships it (CitibetHandler.data of newPayReport.jsp).
const REPORT = {
  upline: [
    [
      {
        sub_total: [{ metadata: [{ bet: 872, bet_tax: "$6.11", eat: 631, eat_tax: "$16.42", tax: "", profit_loss: "", type: "overall" }], profit_loss: "" }],
        lvl: "",
        username: "",
        total_tax: "$22.53",
        total_profit_loss: "($887.28)",
      },
      {
        sub_total: [{ metadata: [{ bet: 872, bet_tax: "$17.09", eat: 631, eat_tax: "$16.98", type: "w_p2" }], profit_loss: "($898.82)" }],
        lvl: "MG",
        row_type: "detail",
        username: "m99m06<br/>m06-KZ",
        total_tax: "$34.07",
        total_profit_loss: "($898.82)",
      },
      {
        sub_total: [{ metadata: [{ bet: 872, bet_tax: "$17.09", eat: 631, eat_tax: "$16.98", tax: "$34.07", type: "major" }], profit_loss: "($898.82)" }],
        lvl: "MG",
        row_type: "summary",
        username: "m99m06<br/>m06-KZ",
        total_tax: "$34.07",
        total_profit_loss: "($898.82)",
      },
      { earnings: "long_RM", total_profit_loss: "$11.54" },
    ],
  ],
  downline: [
    [
      {
        no: "",
        lvl: "MG",
        row_type: "detail",
        linkLvl: "3",
        linkUid: "m99m06",
        username: "m06-KZ",
        sub_total: [{ metadata: [{ bet: 28, bet_tax: "$0.20", eat: 591, eat_tax: "$15.38", type: "w_p2" }], profit_loss: "$2,002.18" }],
        total_tax: "$15.57",
        total_profit_loss: "$2,002.18",
        accType: "2",
        earning: "$15.57",
      },
      {
        no: "",
        lvl: "MG",
        row_type: "summary",
        linkLvl: "3",
        linkUid: "m99m06",
        username: "m06-KZ",
        sub_total: [{ metadata: [{ bet: 28, bet_tax: "$0.20", eat: 591, eat_tax: "$15.38", tax: "$15.57", type: "major" }], profit_loss: "$2,002.18" }],
        total_tax: "$15.57",
        total_profit_loss: "$2,002.18",
        accType: "2",
        earning: "$15.57",
      },
      {
        no: 1,
        lvl: "PL",
        row_type: "summary",
        linkLvl: "0",
        linkUid: "yong",
        username: "yong",
        sub_total: [{ metadata: [{ bet: 844, bet_tax: "$16.90", eat: 40, eat_tax: "$1.60", tax: "$18.50", type: "major" }], profit_loss: "($2,901.00)" }],
        total_tax: "$18.50",
        total_profit_loss: "($2,901.00)",
        accType: "2",
        earning: "$11.54",
      },
      { earnings: "long_RM", total_profit_loss: "($898.82)" },
    ],
  ],
};

const lines = (text) => text.split("\n");

test("the two tables come out as the text a copy of them gives", () => {
  const text = citibetReportToPasteText({ data: REPORT, page: PAGE, i18n: I18N });
  assert.deepEqual(lines(text), [
    "Upline Payment",
    "Lvl\tUsername\tType\tBet\tBet Tax\tEat\tEat Tax\tTax\tProfit/Loss\tTotal Tax\tTotal Profit/Loss",
    "\t\tOverall\t872\t$6.11\t631\t$16.42\t\t\t$22.53\t($887.28)",
    // The Username cell is "m99m06<br/>m06-KZ", which a copy splits over these two lines.
    "MG\tm99m06",
    "m06-KZ\tMajor\t872\t$17.09\t631\t$16.98\t$34.07\t($898.82)\t$34.07\t($898.82)",
    // The site's own label keeps its leading &nbsp;.
    " My Earnings : (Ringgit Malaysia (RM))\t$11.54",
    "Downline Payment",
    "No.\tLvl\tUsername\tType\tBet\tBet Tax\tEat\tEat Tax\tTax\tProfit/Loss\tTotal Tax\tTotal Profit/Loss\t ",
    "\tMG\tm99m06",
    "m06-KZ\tMajor\t28\t$0.20\t591\t$15.38\t$15.57\t$2,002.18\t$15.57\t$2,002.18\t ",
    "1\tPL\tyong",
    "yong\tMajor\t844\t$16.90\t40\t$1.60\t$18.50\t($2,901.00)\t$18.50\t($2,901.00)\t ",
    "Total : (Ringgit Malaysia (RM))\t($898.82)\t ",
  ]);
});

test("the existing Citibet paste takes it and lays it out as a hand-pasted report", () => {
  const text = citibetReportToPasteText({ data: REPORT, page: PAGE, i18n: I18N });
  assert.equal(autoDetectCaptureTypeFromPaste(text), "CITIBET");
  const parsed = parseCitibetPaymentReport(text);
  assert.ok(parsed);
  assert.deepEqual(parsed.dataMatrix, [
    ["OVERALL", "", "", "872", "$6.11", "631", "$16.42", "$22.53", "($887.28)", "", "", ""],
    ["m99m06", "m06-KZ", "Major", "872", "$17.09", "631", "$16.98", "$34.07", "($898.82)", "$34.07", "($898.82)", ""],
    ["MY EARNINGS : (RINGGIT MALAYSIA (RM))", "", "", "", "", "", "", "", "", "", "$11.54", ""],
    ["m99m06", "m06-KZ", "Major", "28", "$0.20", "591", "$15.38", "$15.57", "$2,002.18", "$15.57", "$2,002.18", ""],
    ["yong", "yong", "Major", "844", "$16.90", "40", "$1.60", "$18.50", "($2,901.00)", "$18.50", "($2,901.00)", ""],
    ["TOTAL : (RINGGIT MALAYSIA (RM))", "", "", "", "", "", "", "", "", "", "($898.82)", ""],
  ]);
});

test("only the rows of the page's own view are taken (summary leaves the detail rows out)", () => {
  const summary = citibetReportToPasteText({ data: REPORT, page: PAGE, i18n: I18N });
  // The MG row ships as both "detail" (W/P) and "summary" (Major); summary draws one line per row, not two.
  assert.equal(summary.split("\n").filter((l) => l.includes("\tMajor\t")).length, 3);
  assert.ok(!summary.includes("W/P\t"));

  const detail = citibetReportToPasteText({ data: REPORT, page: { ...PAGE, racing_mode: "detail" }, i18n: I18N });
  assert.ok(detail.includes("W/P\t"));
  assert.ok(!detail.includes("\tMajor\t"));
});

test("cash mode leaves out Eat and Eat Tax, as the site does", () => {
  const text = citibetReportToPasteText({ data: REPORT, page: { ...PAGE, cash_mode: true }, i18n: I18N });
  assert.equal(lines(text)[1], "Lvl\tUsername\tType\tBet\tBet Tax\tTax\tProfit/Loss\tTotal Tax\tTotal Profit/Loss");
  // Overall still carries its own empty Tax and Profit/Loss cells.
  assert.equal(lines(text)[2], "\t\tOverall\t872\t$6.11\t\t\t$22.53\t($887.28)");
});

test("a report with no rows gives nothing to paste", () => {
  assert.equal(citibetReportToPasteText({ data: {}, page: PAGE, i18n: I18N }), "");
  assert.equal(citibetReportToPasteText({ data: null, page: PAGE, i18n: I18N }), "");
  assert.equal(citibetReportToPasteText(null), "");
  assert.equal(citibetReportToPasteText({ data: { upline: [[]], downline: [[]] }, page: PAGE, i18n: I18N }), "");
});

test("labels the page does not carry fall back to the site's own English", () => {
  const text = citibetReportToPasteText({ data: REPORT, page: PAGE, i18n: {} });
  assert.ok(text.includes("Overall\t872"));
  assert.ok(text.includes("\tMajor\t"));
  // An unknown currency key reads as the key itself, which is what the site shows too.
  assert.ok(text.includes(" My Earnings : (long_RM)"));
});

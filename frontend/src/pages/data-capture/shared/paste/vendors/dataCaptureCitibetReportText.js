// Auto Fetch: the Payment Report JSON of a Citibet site turned back into the text a manual copy of its Upline /
// Downline tables gives, so an auto-fetched report goes through the very same paste modules (and comes out in the
// very same cells) as the copy-and-paste it replaces.
//
// The site ships the rows as a JSON literal in the page (CitibetHandler.data) and draws them with its own
// pay_report.js (CitibetHandler.setRacingData). This module follows that function's column layout:
//   Upline:   Lvl | Username | Type | Bet | Bet Tax | Eat | Eat Tax | Tax | Profit/Loss | Total Tax | Total Profit/Loss
//   Downline: No. | Lvl | Username | Type | Bet | Bet Tax | Eat | Eat Tax | Tax | Profit/Loss | Total Tax | Total Profit/Loss | (View)
// and writes each cell as its text, so what comes out is what selecting those tables in the browser copies:
//  - a Username cell is "id<br/>code", which copying splits over two lines ("MG\tm99m06" then "m06-KZ\tMajor\t...");
//  - the earnings label keeps its leading space (the site's own "&nbsp;My Earnings");
//  - "Eat" / "Eat Tax" are left out in cash mode, as the site leaves them out.
// Only the rows of the page's own racing_mode are taken (the data carries both "detail" and "summary" of every row,
// and the page draws one of them), which is how the tables look when they are copied.

const I18N_FALLBACK = { overall: "Overall", major: "Major", minor: "Minor", w_p2: "W/P", w_p_hk2: "W/P", fct_pfct2: "FC/PFT", minor2: "Mi", earnings: " My Earnings", total: "Total" };

/** I18N.get of the page: its own label, else the shipped fallback, else the key (what the site itself falls back to). */
function label(i18n, key) {
  if (key == null || key === "") return "";
  const own = i18n?.[key];
  const text = own != null && own !== "" ? own : I18N_FALLBACK[key];
  return text != null ? plainText(text) : String(key);
}

/** The text of a cell the site fills with HTML: tags out, <br> a line break, &nbsp; a space (as innerText reads it). */
function plainText(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

const cell = (value) => (value == null ? "" : plainText(value));

// The row objects of one section, as the page draws them: every currency block in turn, and of every row only the
// metadata lines whose row_type is the page's racing_mode (a row with no row_type, like Overall, is always drawn).
function* drawnRows(section) {
  for (const block of section ?? []) {
    for (const row of block ?? []) {
      yield row;
    }
  }
}

function metadataRows(row, mode) {
  const out = [];
  for (const subTotal of row.sub_total ?? []) {
    const metadata = subTotal?.metadata ?? [];
    metadata.forEach((meta, index) => {
      // The data holds both views of a row; the page draws the one its racing_mode names.
      if (row.row_type && row.row_type !== mode) return;
      out.push({ meta, subTotal, first: index === 0, count: metadata.length });
    });
  }
  return out;
}

// Type | Bet | Bet Tax | [Eat | Eat Tax] | Tax | [Profit/Loss on the first line of the cell group]
function measureCells({ meta, subTotal, first }, ctx) {
  let type = label(ctx.i18n, meta.type);
  // Detail view marks a minor line, as the site marks it.
  if (meta.is_minor === "1" && ctx.mode === "detail") type = `(${label(ctx.i18n, "minor2")})${type}`;
  const cells = [type, cell(meta.bet), cell(meta.bet_tax)];
  if (!ctx.cashMode) cells.push(cell(meta.eat), cell(meta.eat_tax));
  cells.push(cell(meta.tax));
  if (first) cells.push(cell(subTotal.profit_loss));
  return cells;
}

/** The Upline Payment table as its rows of text. */
function uplineRows(section, ctx) {
  const lines = [];
  for (const row of drawnRows(section)) {
    if (!row.sub_total) {
      // The "total" row of the template: the earnings label and its amount.
      lines.push([`${label(ctx.i18n, "earnings")} : (${label(ctx.i18n, row.earnings)})`, cell(row.total_profit_loss)]);
      continue;
    }
    const drawn = metadataRows(row, ctx.mode);
    drawn.forEach((entry, index) => {
      const values = measureCells(entry, ctx);
      if (index === 0) {
        lines.push([cell(row.lvl), cell(row.username), ...values, cell(row.total_tax), cell(row.total_profit_loss)]);
      } else {
        lines.push(values);
      }
    });
  }
  return lines;
}

/** The Downline Payment table as its rows of text. */
function downlineRows(section, ctx) {
  const lines = [];
  for (const row of drawnRows(section)) {
    if (!row.sub_total) {
      lines.push([`${label(ctx.i18n, "total")} : (${label(ctx.i18n, row.earnings)})`, cell(row.total_profit_loss), " "]);
      continue;
    }
    const drawn = metadataRows(row, ctx.mode);
    drawn.forEach((entry, index) => {
      const values = measureCells(entry, ctx);
      if (index === 0) {
        // The site writes the account itself as "id<br/>code" and every other one as a link plus its code; both read
        // as the two lines a copy splits on.
        const username = ctx.username && ctx.username === row.linkUid ? `${row.linkUid}\n${row.username}` : `${row.linkUid ?? ""}\n${row.username ?? ""}`;
        const parent = [cell(row.no), cell(row.lvl), username.trim() === "" ? "" : username, ...values, cell(row.total_tax)];
        if (ctx.isOP) parent.push(ctx.username === row.linkUid ? " " : cell(row.earning));
        parent.push(cell(row.total_profit_loss), " ");
        lines.push(parent);
      } else {
        lines.push(values);
      }
    });
  }
  return lines;
}

const UPLINE_HEAD = ["Lvl", "Username", "Type", "Bet", "Bet Tax", "Eat", "Eat Tax", "Tax", "Profit/Loss", "Total Tax", "Total Profit/Loss"];
const DOWNLINE_HEAD = ["No.", "Lvl", "Username", "Type", "Bet", "Bet Tax", "Eat", "Eat Tax", "Tax", "Profit/Loss", "Total Tax", "Total Profit/Loss", " "];

const withoutEat = (head) => head.filter((h) => h !== "Eat" && h !== "Eat Tax");

/**
 * The report as the text a copy of its two tables gives (tab between cells, newline between rows).
 * report: { data: CitibetHandler.data, page: PayReportHandler.data (racing_mode, cash_mode, username, isOP), i18n }.
 * Returns "" when the report carries no Upline and no Downline rows.
 */
export function citibetReportToPasteText(report) {
  const data = report?.data;
  if (!data || (!data.upline && !data.downline)) return "";
  const page = report.page ?? {};
  const ctx = {
    i18n: report.i18n ?? {},
    mode: page.racing_mode === "detail" ? "detail" : "summary",
    cashMode: Boolean(page.cash_mode),
    isOP: Boolean(page.isOP),
    username: page.username ?? "",
  };

  const lines = [];
  const upline = uplineRows(data.upline, ctx);
  if (upline.length) {
    lines.push(["Upline Payment"], ctx.cashMode ? withoutEat(UPLINE_HEAD) : UPLINE_HEAD, ...upline);
  }
  const downline = downlineRows(data.downline, ctx);
  if (downline.length) {
    lines.push(["Downline Payment"], ctx.cashMode ? withoutEat(DOWNLINE_HEAD) : DOWNLINE_HEAD, ...downline);
  }
  return lines.map((row) => row.join("\t")).join("\n");
}

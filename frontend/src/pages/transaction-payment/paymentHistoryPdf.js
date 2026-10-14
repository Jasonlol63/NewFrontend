// Payment History PDF: A4 landscape, one table per currency, built in the browser with jsPDF.
// Same look as the report of the previous version (header with logo, 8 columns, B/F first, total row, "Page N").
// jsPDF is loaded only when a PDF is made. The Chinese font is a subset of Noto Sans SC kept in /fonts and loaded
// only when the text has Chinese in it.

import { moneySign, sumMoney } from "@/lib/money";
import { flowAmount, formatRate } from "./paymentHistoryRules";

const LOGO_PATH = "images/count_brandlogo.png";
const FONT_FAMILY = "NotoSansSC";
const FONT_FILES = { normal: "NotoSansSC-Regular.subset.ttf", bold: "NotoSansSC-Bold.subset.ttf" };
const FALLBACK_FONT = "helvetica";

const LOGO_HEIGHT_MM = 8;
const LOGO_TOP_TRIM_MM = 1.1;
const TITLE_PT = 14;
const META_PT = 9;
const CURRENCY_PT = 11;
const HEADER_TOP_MM = 8;
const FIRST_PAGE_TOP_MM = 24;
const OTHER_PAGE_TOP_MM = 18;
const HEADER_TABLE_GAP_MM = 1.5;
const HEADER_SEP_GAP_MM = 1.5;
const FOOTER_BOTTOM_MM = 10;
const BRAND_RGB = [0, 44, 73];

// A4 landscape, 277mm of table. The Date column is wide enough for the whole year.
const COLUMN_STYLES = {
  0: { cellWidth: 19, halign: "left", overflow: "hidden", fontStyle: "bold" }, // Date
  1: { cellWidth: 42, halign: "left", overflow: "linebreak", fontStyle: "bold" }, // Id Product
  2: { cellWidth: 18, halign: "right", overflow: "hidden", fontStyle: "bold" }, // Rate
  3: { cellWidth: 24, halign: "right", overflow: "hidden" }, // Win/Loss
  4: { cellWidth: 24, halign: "right", overflow: "hidden" }, // Cr/Dr
  5: { cellWidth: 26, halign: "right", overflow: "hidden" }, // Balance
  6: { cellWidth: 64, halign: "left", overflow: "linebreak" }, // Description
  7: { cellWidth: 60, halign: "left", overflow: "linebreak" }, // Remark
};
const HEADERS = ["Date", "Id Product", "Rate", "Win/Loss", "Cr/Dr", "Balance", "Description", "Remark"];

const hasCjk = (text) => /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/.test(String(text ?? ""));
const assetUrl = (path) => `${import.meta.env.BASE_URL ?? "/"}${path}`.replace(/\/{2,}/g, "/");

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const fontCache = new Map();
function loadFont(file) {
  if (!fontCache.has(file)) {
    const request = fetch(assetUrl(`fonts/${file}`))
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load the font for the PDF");
        return res.arrayBuffer();
      })
      .then(toBase64)
      .catch((err) => {
        fontCache.delete(file);
        throw err;
      });
    fontCache.set(file, request);
  }
  return fontCache.get(file);
}

async function registerChineseFont(doc) {
  const [normal, bold] = await Promise.all([loadFont(FONT_FILES.normal), loadFont(FONT_FILES.bold)]);
  [["normal", normal], ["bold", bold]].forEach(([style, data]) => {
    doc.addFileToVFS(FONT_FILES[style], data);
    doc.addFont(FONT_FILES[style], FONT_FAMILY, style);
  });
}

let logoPromise = null;
function loadLogo() {
  if (!logoPromise) {
    logoPromise = fetch(assetUrl(LOGO_PATH))
      .then((res) => (res.ok ? res.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result || "");
              const img = new Image();
              img.onload = () => resolve({ dataUrl, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
              img.onerror = () => resolve(null);
              img.src = dataUrl;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoPromise;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------


// The totals of one currency: Win/Loss and Cr/Dr add up, the closing balance is the last Balance.
function totalsOf(rows) {
  return { winLoss: sumMoney(rows.map((r) => r.winLoss)), crDr: sumMoney(rows.map((r) => r.crDr)), closing: rows.length ? rows[rows.length - 1].balance : "0" };
}

// Every money cell shows a dash for 0.00 (the B/F row too).
const moneyText = (n) => flowAmount(n);

function applyMoneyStyle(cell, n) {
  cell.styles.halign = "right";
  cell.styles.overflow = "hidden";
  if (moneySign(n) > 0) {
    cell.styles.textColor = [23, 42, 159];
    cell.styles.fontStyle = "bold";
  } else if (moneySign(n) < 0) {
    cell.styles.textColor = [185, 28, 28];
    cell.styles.fontStyle = "bold";
  } else {
    cell.styles.textColor = BRAND_RGB;
    cell.styles.fontStyle = "bold";
    cell.styles.halign = "center";
  }
}

function rowCells(r) {
  return [
    r.bf ? "B/F" : r.date || "-",
    r.bf ? "-" : r.product || "-",
    r.bf ? "-" : formatRate(r.rate),
    r.bf ? "-" : moneyText(r.winLoss),
    r.bf ? "-" : moneyText(r.crDr),
    moneyText(r.balance),
    (r.description || "-").toUpperCase(),
    r.bf ? "-" : (r.remark || "-").toUpperCase(),
  ];
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const capHeightMm = (pt) => pt * 0.352778 * 0.72;
const lineHeightMm = (pt) => pt * 0.352778 * 1.15;

function setFont(doc, text, cjk, style) {
  doc.setFont(cjk && hasCjk(text) ? FONT_FAMILY : FALLBACK_FONT, style);
}

function drawPageHeader(doc, { logo, pageW, marginX, title, meta, currencyTitle, cjk }) {
  const capTopY = HEADER_TOP_MM;
  let blockBottomY = capTopY;
  let logoW = 0;
  if (logo) {
    logoW = LOGO_HEIGHT_MM * (logo.w / logo.h);
    const logoTopY = capTopY - LOGO_TOP_TRIM_MM;
    doc.addImage(logo.dataUrl, "PNG", pageW - marginX - logoW, logoTopY, logoW, LOGO_HEIGHT_MM);
    blockBottomY = Math.max(blockBottomY, logoTopY + LOGO_HEIGHT_MM);
  }
  const maxW = pageW - marginX * 2 - (logoW > 0 ? logoW + 4 : 0);

  setFont(doc, title, cjk, "bold");
  doc.setFontSize(TITLE_PT);
  doc.setTextColor(...BRAND_RGB);
  const titleY = capTopY + capHeightMm(TITLE_PT);
  doc.text(title, marginX, titleY, { align: "left", maxWidth: maxW });
  blockBottomY = Math.max(blockBottomY, titleY);

  setFont(doc, meta, cjk, "normal");
  doc.setFontSize(META_PT);
  doc.setTextColor(100, 116, 139);
  const metaY = titleY + lineHeightMm(META_PT);
  doc.text(meta, marginX, metaY, { align: "left", maxWidth: maxW });
  blockBottomY = Math.max(blockBottomY, metaY);

  if (currencyTitle) {
    const currencyY = blockBottomY + 2 + capHeightMm(CURRENCY_PT);
    setFont(doc, currencyTitle, cjk, "bold");
    doc.setFontSize(CURRENCY_PT);
    doc.setTextColor(...BRAND_RGB);
    doc.text(currencyTitle, marginX, currencyY, { align: "left", maxWidth: maxW });
    blockBottomY = Math.max(blockBottomY, currencyY);
  }

  const sepY = blockBottomY + HEADER_SEP_GAP_MM;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(marginX, sepY, pageW - marginX, sepY);
  return sepY + HEADER_TABLE_GAP_MM;
}

// The heading of a later currency, on the page that is already open.
function drawCurrencyHeading(doc, { pageW, marginX, startY, title, cjk }) {
  const y = startY + capHeightMm(CURRENCY_PT);
  setFont(doc, title, cjk, "bold");
  doc.setFontSize(CURRENCY_PT);
  doc.setTextColor(...BRAND_RGB);
  doc.text(title, marginX, y, { align: "left", maxWidth: pageW - marginX * 2 });
  const sepY = y + HEADER_SEP_GAP_MM;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(marginX, sepY, pageW - marginX, sepY);
  return sepY + HEADER_TABLE_GAP_MM;
}

function drawPageFooter(doc, { pageW, pageH, label }) {
  doc.setFont(FALLBACK_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(label, pageW / 2, pageH - FOOTER_BOTTOM_MM, { align: "center" });
}

// "2026-01-01" -> "01/01/2026"
const dmy = (iso) => iso.split("-").reverse().join("/");

/**
 * The PDF of the given sections ([{ currency, rows }], rows as normalizeHistoryRow returns them, B/F first) as a jsPDF
 * document. Call doc.output("blob") for a preview, doc.save(name) to download.
 */
export async function buildHistoryPdf({ sections, accountCode, accountName, dateFrom, dateTo }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;

  const accountLabel = `${accountCode}${accountName ? ` (${accountName})` : ""}`;
  const title = `${accountCode} - WIN/LOSE REPORT`;
  const meta = `${accountLabel} · ${dmy(dateFrom)} – ${dmy(dateTo)}`;

  const allText = [title, meta, ...sections.flatMap((s) => s.rows.flatMap((r) => [r.product, r.description, r.remark]))];
  const cjk = allText.some(hasCjk);
  if (cjk) await registerChineseFont(doc);
  const logo = await loadLogo();

  const many = sections.length > 1;
  const currencyTitle = (code) => `Currency: ${code}`;
  const firstTableY = drawPageHeader(doc, { logo, pageW, marginX, title, meta, currencyTitle: many ? currencyTitle(sections[0].currency) : null, cjk });
  const drawnPages = new Set([1]);
  let pendingHeading = null;
  let cursorY = firstTableY;

  sections.forEach((section, index) => {
    const { winLoss, crDr, closing } = totalsOf(section.rows);
    let startY = index === 0 ? firstTableY : cursorY;
    if (many && index > 0) {
      if (cursorY > pageH - 40) {
        doc.addPage();
        startY = undefined;
        pendingHeading = currencyTitle(section.currency);
      } else {
        startY = drawCurrencyHeading(doc, { pageW, marginX, startY: cursorY, title: currencyTitle(section.currency), cjk });
      }
    }

    autoTable(doc, {
      startY,
      margin: { top: index === 0 ? firstTableY : OTHER_PAGE_TOP_MM, left: marginX, right: marginX, bottom: FOOTER_BOTTOM_MM + 4 },
      tableWidth: pageW - marginX * 2,
      head: [HEADERS],
      body: section.rows.map(rowCells),
      foot: [
        [
          { content: `Total (${section.currency})`, colSpan: 3, styles: { halign: "left", fontStyle: "bold" } },
          moneyText(winLoss),
          moneyText(crDr),
          moneyText(closing),
          { content: "", colSpan: 2 },
        ],
      ],
      showFoot: "lastPage",
      theme: "grid",
      didDrawPage: (hook) => {
        const page = doc.internal.getCurrentPageInfo().pageNumber;
        if (!drawnPages.has(page)) {
          drawnPages.add(page);
          let top = OTHER_PAGE_TOP_MM;
          if (pendingHeading) {
            top = drawCurrencyHeading(doc, { pageW, marginX, startY: HEADER_TOP_MM, title: pendingHeading, cjk });
            pendingHeading = null;
          }
          hook.settings.margin.top = top;
        }
        drawPageFooter(doc, { pageW, pageH, label: `Page ${page}` });
      },
      styles: {
        font: FALLBACK_FONT,
        fontSize: 9,
        cellPadding: { top: 0.8, right: 1.2, bottom: 0.8, left: 1.2 },
        lineColor: [232, 237, 243],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        overflow: "hidden",
        valign: "middle",
        fillColor: [249, 251, 255],
      },
      headStyles: { fillColor: BRAND_RGB, textColor: 255, fontStyle: "bold", fontSize: 9, minCellHeight: 5.8, valign: "middle" },
      footStyles: { fillColor: [238, 244, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [228, 235, 255] },
      columnStyles: COLUMN_STYLES,
      didParseCell: (hook) => {
        const col = hook.column.index;
        const text = Array.isArray(hook.cell.text) ? hook.cell.text.join(" ") : String(hook.cell.raw ?? "");
        if (cjk && hasCjk(text)) hook.cell.styles.font = FONT_FAMILY;
        if (hook.section === "head") {
          hook.cell.styles.cellPadding = { top: 1, right: 1.2, bottom: 1, left: 1.2 };
          return;
        }
        if (hook.section === "body") {
          const row = section.rows[hook.row.index];
          if (row?.bf) {
            hook.cell.styles.fillColor = [238, 244, 255];
            hook.cell.styles.textColor = [30, 58, 95];
          }
          if (col === 3) applyMoneyStyle(hook.cell, row.bf ? 0 : row.winLoss);
          if (col === 4) applyMoneyStyle(hook.cell, row.bf ? 0 : row.crDr);
          if (col === 5) applyMoneyStyle(hook.cell, row.balance);
          if (col === 1 || col === 2) hook.cell.styles.textColor = [0, 0, 0];
          if (col === 6 || col === 7) {
            hook.cell.styles.fontStyle = "bold";
            hook.cell.styles.overflow = "linebreak";
            hook.cell.styles.halign = "left";
            if (!row?.bf) hook.cell.styles.textColor = [0, 0, 0];
            if (hasCjk(text)) hook.cell.styles.fontSize = 8.7;
          }
          return;
        }
        if (hook.section === "foot") {
          if (col === 3) applyMoneyStyle(hook.cell, winLoss);
          if (col === 4) applyMoneyStyle(hook.cell, crDr);
          if (col === 5) applyMoneyStyle(hook.cell, closing);
        }
      },
    });
    cursorY = (doc.lastAutoTable?.finalY || startY || FIRST_PAGE_TOP_MM) + 12;
    pendingHeading = null;
  });

  return doc;
}

/** WinLoss-CAPITAL-MYR-SGD-01-01-2026-28-09-2026 (MULTI when there are more than three currencies). */
export function pdfFilename({ accountCode, currencies, dateFrom, dateTo }) {
  const code = String(accountCode || "account").replace(/[^\w.-]+/g, "_");
  const ccy = currencies.length <= 3 ? currencies.join("-") : "MULTI";
  return `WinLoss-${code}-${ccy}-${dmy(dateFrom).replace(/\//g, "-")}-${dmy(dateTo).replace(/\//g, "-")}`;
}

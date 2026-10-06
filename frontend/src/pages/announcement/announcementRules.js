// Rules and helpers of the Announcement page (Announcement / Settings tabs); the API calls live in announcementApi.js.

export const DEFAULT_LIST_TITLE = "✨ 本次更新包括 ✨";
export const THANKS_LINE = "感谢大家的使用，我们会持续优化系统。";
export const TELEGRAM_BASE = "https://t.me/";

// ---- text helpers -------------------------------------------------------------------------------

const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL", "OL", "UL", "LI", "A", "BLOCKQUOTE", "CODE", "PRE", "H2", "H3", "H4", "SPAN", "DIV"]);
const DROPPED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "NOSCRIPT"]);
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function cleanChildren(parent, target, doc) {
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      target.appendChild(doc.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1 || DROPPED_TAGS.has(node.tagName)) return;
    if (!ALLOWED_TAGS.has(node.tagName)) {
      cleanChildren(node, target, doc);
      return;
    }
    const el = doc.createElement(node.tagName);
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      if (SAFE_HREF.test(href.trim())) {
        el.setAttribute("href", href.trim());
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    cleanChildren(node, el, doc);
    target.appendChild(el);
  });
}

/** Keeps only the formatting the editor can produce; scripts, styles, event handlers and odd links are dropped. */
export function sanitizeHtml(html) {
  if (!html || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const box = doc.createElement("div");
  cleanChildren(doc.body, box, doc);
  return box.innerHTML;
}

/** Plain text of an HTML string (search, empty check). */
export function htmlToText(html) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ");
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export const hasText = (html) => htmlToText(html).length > 0;

/** "2.1.3" from "...Version 2.1.3..." in the content, or "" when there is none. */
export function versionOf(content) {
  const m = /Version\s*(\d+(?:\.\d+)*)/i.exec(htmlToText(content));
  return m ? m[1] : "";
}

export function filterAnnouncements(list, search) {
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter((a) => `${a.title} ${a.listTitle} ${htmlToText(a.content)} ${a.createdBy}`.toLowerCase().includes(q));
}

const pad2 = (n) => String(n).padStart(2, "0");

/** "2026-10-06 12:35" from what the backend sends for a LocalDateTime: an ISO string or a [y, m, d, h, mi, s] array. */
export function formatDateTime(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0] = value;
    return `${y}-${pad2(mo)}-${pad2(d)} ${pad2(h)}:${pad2(mi)}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(value));
  return m ? `${m[1]} ${m[2]}` : String(value);
}

// ---- list section title <-> content -------------------------------------------------------------
// The backend has no column for the list section title: it is stored as the leading <h3> of the content,
// e.g. <h3>✨ 本次更新包括 ✨</h3><p><strong>系统已更新至 Version 2.0.1</strong></p>...

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LEADING_H3 = /^\s*<h3[^>]*>([\s\S]*?)<\/h3>/i;

/** { listTitle, body } from the stored content: the leading <h3> is the list title, the rest is the body. */
export function splitContent(content) {
  const m = LEADING_H3.exec(content ?? "");
  if (!m) return { listTitle: "", body: content ?? "" };
  return { listTitle: htmlToText(m[1]), body: (content ?? "").slice(m[0].length) };
}

/** The content to store: the list title (default when empty) as the leading <h3>, then the editor body. */
export function joinContent(listTitle, body) {
  return `<h3>${escapeHtml(listTitle.trim() || DEFAULT_LIST_TITLE)}</h3>${body}`;
}

// ---- backend rows -> page items -----------------------------------------------------------------

export function toAnnouncement(row) {
  const { listTitle, body } = splitContent(row.content);
  return { id: row.id, title: row.title ?? "", listTitle, content: body, createdBy: row.createdBy ?? "", createdAt: formatDateTime(row.createdAt) };
}

/** The maintenance notice is a single row; should the table ever hold several, the newest (highest id) wins. */
export function toNotice(rows) {
  const row = [...(rows ?? [])].sort((a, b) => b.id - a.id)[0];
  return row ? { id: row.id, prefix: row.prefix ?? "", content: row.content ?? "", createdBy: row.createdBy ?? "", createdAt: formatDateTime(row.createdAt) } : null;
}

export function toContact(data) {
  return { handle: normalizeHandle(data?.telegramSupportLink ?? ""), updatedBy: data?.updatedBy ?? "", updatedAt: formatDateTime(data?.updatedAt) };
}

// ---- Telegram link ------------------------------------------------------------------------------

/** Accepts "https://t.me/name", "t.me/name", "@name" or "name" and returns just the handle. */
export function normalizeHandle(input) {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** Empty is fine (the button is hidden); otherwise letters, digits, _ - + and / only. */
export const isValidHandle = (handle) => handle === "" || /^[\w+\-/]{1,128}$/.test(handle);

export const telegramUrl = (handle) => (handle ? `${TELEGRAM_BASE}${handle}` : "");

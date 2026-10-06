// Rules and placeholder data of the Announcement page (Announcement / Maintenance / Contact tabs).
// Design preview: nothing here calls the API yet.

export const DEFAULT_LIST_TITLE = "✨ 本次更新包括 ✨";
export const THANKS_LINE = "感谢大家的使用，我们会持续优化系统。";
export const CURRENT_USER = "JK";
// Role of the signed-in user (placeholder until the login data is wired). Only IT sees the sign-out switch.
export const CURRENT_ROLE = "IT";
export const TELEGRAM_BASE = "https://t.me/";

export const MOCK_ANNOUNCEMENTS = [
  {
    id: 6,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "524",
    createdAt: "2026-09-11 14:31",
    content:
      '<p><strong>系统已更新至 Version 2.1.3</strong></p><ol><li>新增 App 安装页面，iPhone/Android 用户可直接添加到主屏幕，像原生App一样使用 <a href="https://count168.com/app/">https://count168.com/app/</a></li><li>修复 Rate Type 汇率计算与描述文字，显示更准确</li><li>修复交易记录页面日期筛选偶尔不显示的问题</li><li>修复 PDF 导出，修正中文显示效果</li><li>修复 Formula Maintenance 页面字段显示错乱的问题</li><li>修复 Customer Report / Domain Report 切换公司报错、刷新报错的问题，页面更稳定</li></ol>',
  },
  {
    id: 5,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "218",
    createdAt: "2026-08-07 14:45",
    content:
      "<p><strong>系统已更新至 Version 2.0.3</strong></p><ol><li>Process新增Save Draft功能，可保存已填写在Data Capture Table的资料</li><li>Rate Submit 后自动展示相关联的货币资料</li><li>Dashboard 优化，提升页面加载速度与操作流畅度</li></ol>",
  },
  {
    id: 4,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "218",
    createdAt: "2026-07-21 10:02",
    content:
      "<p><strong>系统已更新至 Version 2.0.2</strong></p><ol><li>修复登录后偶尔跳转空白页的问题</li><li>优化 Maintenance 页面表格滚动</li><li>修复 Formula 保存后字段顺序错乱</li></ol>",
  },
  {
    id: 3,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "524",
    createdAt: "2026-07-02 09:18",
    content: "<p><strong>系统已更新至 Version 2.0.1</strong></p><ol><li>新增 Auto Renew 到期提醒徽标</li><li>修复 Domain 页面搜索大小写问题</li></ol>",
  },
  {
    id: 2,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "218",
    createdAt: "2026-06-18 16:40",
    content:
      "<p><strong>系统已更新至 Version 2.0.0</strong></p><ol><li>全新界面上线：侧边栏、列表与弹窗统一风格</li><li>Domain 新增 Price 与公司 / 群组设置</li><li>优化各页面在小屏幕上的显示</li></ol>",
  },
  {
    id: 1,
    title: "系统更新通知",
    listTitle: "",
    createdBy: "524",
    createdAt: "2026-06-03 11:25",
    content:
      "<p><strong>系统已更新至 Version 1.9.8</strong></p><ol><li>修复 Transaction Payment 金额四舍五入问题</li><li>修复 Admin 权限设置保存后未刷新的问题</li></ol>",
  },
];

export const MOCK_NOTICE = {
  id: 1,
  prefix: "系统更新通知",
  content: "<p>测试SpringBoot通知</p>",
  createdBy: "JK",
  createdAt: "2026-10-06 12:35",
  kickUsers: false, // online users are being signed out / kept out while this is on
};

export const MOCK_CONTACT = { handle: "testLinkforCount", updatedBy: "JK", updatedAt: "2026-10-06 12:35" };

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

export function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

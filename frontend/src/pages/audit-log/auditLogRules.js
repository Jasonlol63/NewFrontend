// ===== Action types =====
// Classes follow the Auto Renew status badges (green / blue / rose); Restore is amber.
export const ACTIONS = {
  CREATE: {
    badge: "border-[#a7f0c0] bg-[#dcfce7] text-[#13873f]",
    dot: "bg-[#22c55e]",
    accent: "before:bg-[linear-gradient(180deg,#34d399,#16a34a)]",
  },
  UPDATE: {
    badge: "border-[#aac6ff] bg-[#dfeaff] text-[#0a3fc9]",
    dot: "bg-[#1f6fe8]",
    accent: "before:bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]",
  },
  DELETE: {
    badge: "border-[#ffc2cf] bg-[#ffe4ea] text-[#c8304f]",
    dot: "bg-[#f0506e]",
    accent: "before:bg-[linear-gradient(180deg,#ff8aa0,#e0384f)]",
  },
  RESTORE: {
    badge: "border-[#fde2a1] bg-[#fef3c7] text-[#a45a04]",
    dot: "bg-[#f5a524]",
    accent: "before:bg-[linear-gradient(180deg,#fcd34d,#d97706)]",
  },
};

export const actionStyle = (action) => ACTIONS[action] ?? ACTIONS.UPDATE;

// ===== Time =====
const pad = (n) => String(n).padStart(2, "0");

// createdAt arrives as "2026-10-14T09:38:02" (or, from a differently configured server, [y, m, d, h, mi, s]).
function parts(value) {
  if (Array.isArray(value)) {
    const [y, m, d, h = 0, mi = 0, s = 0] = value;
    return { y, m: pad(m), d: pad(d), time: `${pad(h)}:${pad(mi)}:${pad(s)}` };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(String(value ?? ""));
  return match ? { y: match[1], m: match[2], d: match[3], time: match[4] } : null;
}

/** { time: "09:38:02", day: "14/10", full: "2026-10-14 09:38:02" } for the list and the detail panel. */
export function formatStamp(value) {
  const p = parts(value);
  if (!p) return { time: "-", day: "", full: "-" };
  return { time: p.time, day: `${p.d}/${p.m}`, full: `${p.y}-${p.m}-${p.d} ${p.time}` };
}

// ===== Summary text =====
// The server writes "创建 PAYMENT(USDT) FATE → KARSENG 在 CX 公司". The company has its own column, so the list drops
// the suffix and shows the verb muted in front of the rest.
export function splitSummary(summary) {
  const text = String(summary ?? "").replace(/\s*在\s+\S+\s+(公司|集团)\s*$/, "");
  const match = /^(创建|更新|删除|复原)\s*(.*)$/.exec(text);
  return match ? { verb: match[1], rest: match[2] } : { verb: "", rest: text };
}

// ===== Snapshots =====
// before_data / after_data are JSON text with DB column names as keys.
export function parseSnapshot(text) {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** [{ field, before, after }] for the fields whose value differs between the two snapshots (field order: before, then new ones). */
export function changedFields(before, after) {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => formatValue(b[k]) !== formatValue(a[k]))
    .map((k) => ({ field: k, before: formatValue(b[k]), after: formatValue(a[k]) }));
}

// Fields worth the eye in a CREATE / DELETE snapshot, and the ones that run the full width.
export const KEY_FIELDS = new Set(["transaction_type", "amount", "account_id", "from_account_id"]);
export const WIDE_FIELDS = new Set(["description", "remark", "summary", "name"]);

// ===== Query =====
export function buildQuery({ range, company, module, keyword, action, page, size }) {
  const q = { dateFrom: range.from, dateTo: range.to };
  if (company) q.tenantCode = company;
  if (module) q.module = module;
  if (keyword?.trim()) q.keyword = keyword.trim();
  if (action && action !== "all") q.action = action;
  if (page) q.page = page;
  if (size) q.size = size;
  return q;
}

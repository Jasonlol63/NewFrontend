import { formatDisplayDate } from "@/lib/date";

// "2026-09-30T14:48:12" -> "30/09/2026 14:48"
export function formatDateTime(value) {
  const text = String(value ?? "");
  return text ? `${formatDisplayDate(text.slice(0, 10))} ${text.slice(11, 16)}`.trim() : "";
}

// Deleted By / Deleter cell: "K (04/09/2026 21:17)", empty when nobody deleted it.
export function deletedByText(by, at) {
  return by ? `${by} (${formatDateTime(at)})` : "";
}

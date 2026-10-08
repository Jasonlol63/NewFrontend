// "2026-08-17T11:01:31" -> "2026-08-17 11:01:31"; nothing recorded -> "-". Shared by the Record shown in the edit modals.
export const formatRecordTime = (v) => (v ? String(v).replace("T", " ").slice(0, 19) : "-");

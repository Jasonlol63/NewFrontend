import { useState } from "react";

const HOUR = 60 * 60 * 1000;

// Dev-only preview so the notice can be checked without a backend:
//   /login?notice=upcoming   /login?notice=ongoing
function getDevPreviewNotice() {
  if (!import.meta.env.DEV) return null;
  const mode = new URLSearchParams(window.location.search).get("notice");
  if (mode !== "upcoming" && mode !== "ongoing") return null;

  const now = Date.now();
  const startTime = mode === "upcoming" ? new Date(now + 3 * HOUR) : new Date(now - HOUR);
  return {
    title: "测试 SpringBoot 维护通告",
    content: "后端服务升级，期间无法登录和提交单据，请提前保存数据。",
    startTime,
    endTime: new Date(startTime.getTime() + 2 * HOUR),
  };
}

// Returns the current maintenance notice, or null when there is none.
// TODO: replace the dev preview with the real API call once the endpoint is known.
export default function useMaintenanceNotice() {
  const [notice] = useState(getDevPreviewNotice);
  return notice;
}

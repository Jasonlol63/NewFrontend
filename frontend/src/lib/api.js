// A 401 means there is no valid session (never logged in, idle timeout, kicked by maintenance mode);
// wrong passwords and other business errors come back as 200. Send the user to the login page, except
// on the pages that run before a session exists.
const PRE_LOGIN_PATHS = ["/login", "/secondary-password", "/reset-password"];
function leaveIfSignedOut(res) {
  if (res.status !== 401) return;
  if (PRE_LOGIN_PATHS.some((p) => window.location.pathname.startsWith(p))) return;
  window.location.replace("/login");
}

// Backend replies HTTP 200 for business errors too, so success is judged by the
// body: most endpoints send `status: "success"`, the secondary-password verify
// endpoints send `success: true`.
export async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  leaveIfSignedOut(res);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

export async function getJson(url, params, { signal } = {}) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${url}${query}`, { credentials: "include", signal });
  leaveIfSignedOut(res);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

export async function postJson(url, data, { signal } = {}) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
  leaveIfSignedOut(res);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

// Same as postJson for other verbs (PUT, DELETE). `data` is optional; DELETE endpoints take their ids in the url.
export async function sendJson(method, url, data, { signal } = {}) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal,
  });
  leaveIfSignedOut(res);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

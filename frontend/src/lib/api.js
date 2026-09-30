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
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

export async function getJson(url, params, { signal } = {}) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${url}${query}`, { credentials: "include", signal });
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
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status !== "success" && body.success !== true)) {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

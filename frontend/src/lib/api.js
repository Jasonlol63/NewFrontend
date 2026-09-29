// Backend replies HTTP 200 for business errors too, so success is judged by `status`.
export async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.status !== "success") {
    throw new Error(body?.message || "Network error, please try again");
  }
  return body;
}

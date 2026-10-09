// What Save has to send for the Link Account modal. Types: "bi" | "uni" | "in" (see linkAccountApi.js).

/**
 * What Save has to send: a link only in `current` is added, one only in `initial` is removed, one in both with a
 * different type is changed. Both are Maps(otherAccountId -> "bi" | "uni" | "in"). An incoming link is only ever
 * upgraded to bidirectional (the other account owns it, so it is never removed or turned around from here).
 */
export function diffLinks(initial, current) {
  const ops = [];
  current.forEach((type, id) => {
    if (!initial.has(id)) ops.push({ kind: "add", id, type });
    else if (initial.get(id) !== type) ops.push({ kind: "change", id, type });
  });
  initial.forEach((type, id) => {
    if (!current.has(id) && type !== "in") ops.push({ kind: "remove", id, type });
  });
  return ops;
}

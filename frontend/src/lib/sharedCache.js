// Per-key remembered results with shared requests, for lists that are asked for again and again (switching company, coming back to
// a page). A remembered copy is only a head start: show it at once, then replace it with the fresh answer.
//   peek(key)              the remembered value, or null (also when it is older than CACHE_MS)
//   fetchShared(key, fresh) loads it (one request per key at a time, so a prefetch and the page's own load are one request); `fresh`
//                          asks the server again even if a request is on its way (after a change it could not have seen)
//   prefetch(key)          warms the cache for a key not remembered yet; errors are ignored
//   clear()                forgets everything (the data changed)
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 20;

export function makeCache(load) {
  const store = new Map(); // key -> { value, at }
  const inflight = new Map(); // key -> promise
  let epoch = 0; // bumped by clear(): an answer asked for before that is not kept
  const peek = (key) => {
    const hit = store.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_MS) {
      store.delete(key);
      return null;
    }
    return hit.value;
  };
  const fetchShared = (key, fresh = false) => {
    if (!fresh && inflight.has(key)) return inflight.get(key);
    const asked = epoch;
    const request = load(key)
      .then((value) => {
        if (asked === epoch) {
          store.delete(key);
          store.set(key, { value, at: Date.now() });
          if (store.size > CACHE_MAX) store.delete(store.keys().next().value);
        }
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });
    inflight.set(key, request);
    return request;
  };
  const prefetch = (key) => {
    if (peek(key) == null && !inflight.has(key)) fetchShared(key).catch(() => {});
  };
  return {
    peek,
    fetchShared,
    prefetch,
    clear: () => {
      epoch += 1;
      store.clear();
      inflight.clear();
    },
  };
}

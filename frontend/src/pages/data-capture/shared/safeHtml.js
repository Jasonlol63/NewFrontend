// Pasted cells can keep their formatting (colour, bold, an icon): that HTML comes from the clipboard, so it is cleaned before it
// is drawn: no scripts, frames or objects, no on... handlers, no javascript: links.
const BLOCKED = "script, iframe, object, embed, link, meta, style, base, form";

export function safeCellHtml(html) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}`, "text/html");
    doc.body.querySelectorAll(BLOCKED).forEach((el) => el.remove());
    doc.body.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((a) => {
        const name = a.name.toLowerCase();
        if (name.startsWith("on") || (["href", "src", "xlink:href", "action", "formaction"].includes(name) && /^\s*(javascript|data):/i.test(a.value))) el.removeAttribute(a.name);
      });
    });
    return doc.body.innerHTML;
  } catch {
    return "";
  }
}

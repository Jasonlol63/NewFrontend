// Clipboard helpers of the capture sheet.

export async function writeClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** What a paste event carries: { text, html }. */
export function clipboardOf(event) {
  const data = event.clipboardData;
  return { text: data?.getData("text/plain") ?? "", html: data?.getData("text/html") ?? "" };
}

/** Reads the clipboard for the context-menu Paste (no paste event there): { text, html }, or null when it is not allowed. */
export async function readClipboard() {
  try {
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      let text = "";
      let html = "";
      for (const item of items) {
        if (item.types.includes("text/plain")) text ||= await (await item.getType("text/plain")).text();
        if (item.types.includes("text/html")) html ||= await (await item.getType("text/html")).text();
      }
      if (text || html) return { text, html };
    }
    return { text: await navigator.clipboard.readText(), html: "" };
  } catch {
    return null;
  }
}

/**
 * The plain paste: tab / newline separated text lands as a matrix. This is what runs until the report-specific paste
 * (Text and Return) is plugged in through the sheet's `pasteHandler` prop.
 */
export function plainTextMatrix(text) {
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "")
    .split("\n");
  return lines.map((line) => line.split("\t"));
}

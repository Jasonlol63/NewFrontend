import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bold, Check, Code, Italic, Link2, List, ListOrdered, Quote, RemoveFormatting, Strikethrough, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "./announcementRules";

// Look of the formatted text, shared by the editor, the notification preview and the list cards.
// (Tailwind's reset strips list markers, quotes and link colours, so they are put back here.)
export const RICH_CLASS =
  "break-words [&_a]:font-semibold [&_a]:text-[#0b4fd0] [&_a]:underline [&_blockquote]:my-1 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#9dbcf5] [&_blockquote]:pl-2.5 [&_blockquote]:text-[#475569] " +
  "[&_code]:rounded [&_code]:bg-[#e3ebfa] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.92em] [&_h2]:text-[1.15em] [&_h3]:text-[1.08em] [&_h2]:font-extrabold [&_h3]:font-extrabold [&_h2]:text-brand-navy [&_h3]:text-brand-navy " +
  "[&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_p]:min-h-[1.2em] [&_pre]:overflow-x-auto [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5";

/** Formatted text (sanitized) as shown to users. */
export function RichContent({ html, className }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={cn(RICH_CLASS, className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // mouse-down would move the caret out of the text before the command runs
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-7 flex-none cursor-pointer place-items-center rounded-[7px] border-none bg-transparent text-[#4b5d80] outline-none transition-colors hover:bg-[#e4eefc] focus-visible:ring-2 focus-visible:ring-brand-blue/40 modal-tiny:size-6"
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-0.5 h-4 w-px flex-none bg-modal-divider" />;

/**
 * Small rich text editor (bold, italic, underline, strike, lists, quote, code, link, headings).
 * Uncontrolled after mount: `value` is only the starting HTML; every change goes out through onChange(html).
 * Pasted text is inserted as plain text so no foreign styling gets in.
 */
export default function RichTextEditor({ value, onChange, placeholder, label, className }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  useLayoutEffect(() => {
    ref.current.innerHTML = sanitizeHtml(value);
    // starting value only
  }, []); // oxlint-disable-line react-hooks/exhaustive-deps

  const emit = () => {
    // an emptied box keeps a stray <br>, which would hide the placeholder
    if (!ref.current.textContent && !ref.current.querySelector("li")) ref.current.innerHTML = "";
    onChange(ref.current.innerHTML);
  };

  const run = (command, arg) => {
    ref.current.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const wrapCode = () => {
    const text = window.getSelection()?.toString();
    if (!text) return;
    run("insertHTML", `<code>${escapeHtml(text)}</code>`);
  };

  const openLink = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount && ref.current.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl("https://");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    setLinkOpen(false);
    if (!/^(https?:\/\/|mailto:)\S+$/i.test(url)) return;
    ref.current.focus();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (sel.isCollapsed) document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    else document.execCommand("createLink", false, url);
    emit();
  };

  const onPaste = (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    emit();
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-modal-input-line bg-modal-input shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow] focus-within:border-[#3b82f6] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]",
        className
      )}
    >
      <div role="toolbar" aria-label="Text formatting" className="flex flex-none flex-wrap items-center gap-0.5 border-b border-modal-divider bg-white/40 px-1.5 py-1">
        <select
          aria-label="Text style"
          defaultValue="p"
          onChange={(e) => {
            run("formatBlock", e.target.value);
            e.target.value = "p";
          }}
          className="h-7 flex-none cursor-pointer rounded-[7px] border-none bg-transparent px-1 text-[12.5px] font-semibold text-[#4b5d80] outline-none hover:bg-[#e4eefc] modal-tiny:h-6"
        >
          <option value="p">Normal</option>
          <option value="h3">Heading</option>
        </select>
        <Divider />
        <ToolButton label="Bold" onClick={() => run("bold")}>
          <Bold className="size-4" strokeWidth={2.4} />
        </ToolButton>
        <ToolButton label="Italic" onClick={() => run("italic")}>
          <Italic className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton label="Underline" onClick={() => run("underline")}>
          <Underline className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton label="Strikethrough" onClick={() => run("strikeThrough")}>
          <Strikethrough className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <Divider />
        <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>
          <ListOrdered className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          <List className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <Divider />
        <ToolButton label="Quote" onClick={() => run("formatBlock", "blockquote")}>
          <Quote className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton label="Code (select text first)" onClick={wrapCode}>
          <Code className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton label="Link" onClick={openLink}>
          <Link2 className="size-4" strokeWidth={2.2} />
        </ToolButton>
        <ToolButton
          label="Clear formatting"
          onClick={() => {
            run("removeFormat");
            run("formatBlock", "p");
          }}
        >
          <RemoveFormatting className="size-4" strokeWidth={2.2} />
        </ToolButton>
      </div>

      {linkOpen && (
        <div className="flex flex-none items-center gap-1.5 border-b border-modal-divider bg-white/55 px-2 py-1.5">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setLinkOpen(false);
              }
            }}
            aria-label="Link address"
            placeholder="https://"
            className="h-7 min-w-0 flex-1 rounded-lg border border-modal-input-line bg-white/80 px-2 text-[12.5px] outline-none focus:border-[#3b82f6]"
          />
          <button
            type="button"
            onClick={applyLink}
            aria-label="Apply link"
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border-none bg-brand-sweep text-white"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </button>
        </div>
      )}

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={onPaste}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#1f2937] outline-none [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
          "empty:before:pointer-events-none empty:before:text-[#9aa8c0] empty:before:content-[attr(data-placeholder)]",
          RICH_CLASS
        )}
      />
    </div>
  );
}

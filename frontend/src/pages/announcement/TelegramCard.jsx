import { useLayoutEffect, useRef, useState } from "react";
import { Check, Clock, ExternalLink, RotateCcw, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { AccentBar, CardTile, PANEL_CLASS } from "./PanelCard.jsx";
import { TELEGRAM_BASE, isValidHandle, normalizeHandle, telegramUrl } from "./announcementRules";

// Card width from which the roomy three-layer layout is used (about 1650px screens with the sidebar and up);
// below it the card is one slim bar.
const WIDE_FROM = 1360;

// One slim bar (laptops): controls follow the screen height a little, never below the form modals' 38px.
const H = "h-[clamp(38px,5.2dvh,48px)]";
const BUTTON = cn(H, "min-w-[clamp(104px,12dvh,128px)] px-5 text-[13.5px] @max-[599px]/page:min-w-0 @max-[599px]/page:flex-1 @max-[599px]/page:px-3");
// Roomy layout (big screens): everything grows with the screen height.
const WH = "h-[clamp(38px,5.4dvh,42px)]";
const WBUTTON = cn(WH, "min-w-[112px] px-[22px] text-[13.5px]");

function useWide(ref) {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const update = () => setWide(el.getBoundingClientRect().width >= WIDE_FROM);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return wide;
}

/**
 * Telegram support link of the login page.
 *  - Narrow card (laptops): one slim bar on one line: icon (with the status dot) + title and "Active · Login page
 *    button", the handle box with Test link next to it, who / when, Reset and Save at the right edge. It wraps below
 *    about 900px and stacks on phones.
 *  - Wide card (1650px+ screens): three layers and taller, growing with the screen height: header with the status,
 *    the handle box + Test link with Reset / Save at the right, the "Current link" strip (live link, who / when) and
 *    the hint.
 * The maintenance card above stays the bigger one in both.
 *  - saved: { handle, updatedBy, updatedAt }; onSave(handle)
 */
export default function TelegramCard({ saved, onSave }) {
  const ref = useRef(null);
  const wide = useWide(ref);
  const [input, setInput] = useState(saved.handle);
  const handle = normalizeHandle(input);
  const valid = isValidHandle(handle);
  const changed = handle !== saved.handle;
  const url = telegramUrl(saved.handle);
  const status = url ? "Active" : "Hidden";

  const save = () => {
    onSave(handle);
    setInput(handle);
  };

  const statusDot = (size) => (
    <i title={status} className={cn("absolute -right-0.5 -top-0.5 rounded-full border-2 border-white", size, url ? "bg-[#22c55e]" : "bg-[#94a3b8]")} />
  );
  const statusPill = url ? (
    <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[#e6f8ee] px-2.5 py-0.5 text-[11px] font-bold text-[#15803d]">
      <i className="size-1.5 rounded-full bg-[#22c55e]" />
      Active
    </span>
  ) : (
    <span className="flex-none rounded-full bg-[#eef1f5] px-2.5 py-0.5 text-[11px] font-bold text-[#64748b]">Hidden</span>
  );

  const handleBox = (heightClass, textClass) => (
    <div
      title="Paste a full t.me link or just the handle. Leave empty and save to hide the button."
      className={cn(
        heightClass,
        "flex min-w-[150px] flex-1 overflow-hidden rounded-[10px] border bg-modal-input shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]",
        valid ? "border-modal-input-line focus-within:border-[#3b82f6]" : "border-[#ef4444] focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
      )}
    >
      <span className={cn("grid flex-none place-items-center border-r border-modal-input-line bg-[rgba(130,155,195,0.14)] px-3 font-semibold text-[#6a7fa8]", textClass)}>{TELEGRAM_BASE}</span>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="Telegram support link"
        aria-invalid={!valid}
        placeholder="yourSupportHandle"
        className={cn("min-w-0 flex-1 border-none bg-transparent px-3 text-[#111827] outline-none", textClass)}
      />
    </div>
  );

  const testLink = (className) =>
    url && (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        className={cn("inline-flex flex-none items-center justify-center gap-1.5 rounded-[10px] border border-white/80 bg-white/55 font-bold text-brand-navy hover:bg-white/75", className)}
      >
        Test link
        <ExternalLink className="size-3.5" strokeWidth={2.2} />
      </a>
    );

  const buttons = (buttonClass) => (
    <>
      <SoftButton onClick={() => setInput(saved.handle)} disabled={!changed} className={cn(buttonClass, "disabled:cursor-not-allowed disabled:opacity-50")}>
        <RotateCcw className="size-3.5" strokeWidth={2.4} />
        Reset
      </SoftButton>
      <button
        type="button"
        disabled={!changed || !valid}
        onClick={save}
        className={cn(primaryButtonClass, buttonClass, "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100")}
      >
        <Check className="size-[15px]" strokeWidth={2.5} />
        Save
      </button>
    </>
  );

  const updated = (className) => (
    <span className={cn("inline-flex flex-none items-center gap-x-3 text-dash-sub", className)}>
      <span className="inline-flex items-center gap-1.5">
        <User className="size-3.5 text-dash-faint" strokeWidth={2.2} />
        {saved.updatedBy}
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Clock className="size-3.5 text-dash-faint" strokeWidth={2.2} />
        {saved.updatedAt}
      </span>
    </span>
  );

  const invalidNote = !valid && (
    <p role="alert" className="m-0 ml-0.5 text-[12px] font-semibold text-[#dc2626]">
      Use only letters, numbers, _ - + and /.
    </p>
  );

  if (wide) {
    return (
      <section ref={ref} className={cn(PANEL_CLASS, "flex min-h-[clamp(240px,28.7dvh,322px)] flex-none flex-col justify-between gap-3 px-[clamp(12px,2dvh,18px)] pb-[clamp(14px,2.4dvh,24px)] pt-[clamp(14px,2.6dvh,26px)]")}>
        <AccentBar accent="blue" />

        <div className="flex items-center gap-2.5">
          <span className="relative flex-none">
            <CardTile icon={Send} accent="blue" className="size-[clamp(32px,4.6dvh,38px)]" />
            {statusDot("size-3")}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[clamp(15px,2.2dvh,17px)] font-extrabold leading-tight tracking-[-0.2px] text-brand-navy">Telegram Support Link</h2>
            <p className="m-0 text-[11.5px] font-medium text-[#6b7fa5]">Floating button on the login page</p>
          </div>
          {statusPill}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-[0_1_clamp(420px,28vw,560px)] items-center gap-2.5">
            {handleBox(WH, "text-[14px]")}
            {testLink(cn(WH, "px-3.5 text-[13px]"))}
          </div>
          <div className="ml-auto flex flex-none gap-2.5">{buttons(WBUTTON)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] border border-modal-line bg-white/60 px-3.5 py-2.5 text-[12px]">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#6b7fa5]">Current link</span>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-[13.5px] font-bold text-[#0b4fd0] underline">
              {url}
            </a>
          ) : (
            <span className="text-[#8a96a8]">No link set; the button is hidden on the login page.</span>
          )}
          {updated("ml-auto")}
        </div>

        {invalidNote || <p className="m-0 ml-0.5 text-[12px] text-[#6b7fa5]">Paste a full t.me link or just the handle. Leave empty and save to hide the button.</p>}
      </section>
    );
  }

  return (
    <section ref={ref} className={cn(PANEL_CLASS, "flex-none px-[clamp(12px,1.8dvh,20px)] py-[clamp(10px,1.8dvh,16px)]")}>
      <AccentBar accent="blue" />

      <div className="flex flex-wrap items-center gap-x-[clamp(8px,1.2dvh,14px)] gap-y-2.5">
        <div className="flex min-w-0 flex-none items-center gap-2.5 @max-[599px]/page:basis-full">
          <span className="relative flex-none">
            <CardTile icon={Send} accent="blue" className="size-[clamp(32px,4.4dvh,42px)] rounded-[11px]" iconClassName="size-[clamp(17px,2.2dvh,22px)]" />
            {statusDot("size-3")}
          </span>
          <div className="min-w-0">
            <h2 className="m-0 whitespace-nowrap text-[clamp(14px,2dvh,17px)] font-extrabold leading-tight tracking-[-0.2px] text-brand-navy">Telegram Support Link</h2>
            <p className="m-0 whitespace-nowrap text-[11.5px] font-medium text-[#6b7fa5] @max-[999px]/page:hidden">
              <b className={url ? "font-bold text-[#15803d]" : "font-bold text-[#64748b]"}>{status}</b>
              {" · Login page button"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] items-center gap-2.5 @min-[900px]/page:max-w-[clamp(380px,36vw,600px)] @max-[599px]/page:basis-full @max-[599px]/page:flex-wrap">
          {handleBox(cn(H, "@max-[599px]/page:basis-full"), "text-[14.5px]")}
          {testLink(cn(H, "px-3.5 text-[13px] @max-[599px]/page:flex-1"))}
        </div>

        {updated("ml-auto text-[12px] @max-[999px]/page:hidden")}

        <div className="flex flex-none gap-2.5 @max-[999px]/page:ml-auto @max-[599px]/page:w-full">{buttons(BUTTON)}</div>
      </div>

      {invalidNote && <div className="mt-2">{invalidNote}</div>}
    </section>
  );
}

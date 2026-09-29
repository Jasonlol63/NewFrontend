import { Dialog } from "radix-ui";

// Status colours per dialog type. Exposed as CSS variables so the tile,
// ripples and burst dots all follow the same tone.
const TONES = {
  error: { "--tone": "#d93a3a", "--tone-soft": "#ffe9e7", "--tone-ring": "rgba(217,58,58,0.14)", "--tone-light": "#ff9a8b" },
  warning: { "--tone": "#c27406", "--tone-soft": "#fff0d6", "--tone-ring": "rgba(194,116,6,0.14)", "--tone-light": "#ffd27a" },
  success: { "--tone": "#12925f", "--tone-soft": "#dcf5ea", "--tone-ring": "rgba(18,146,95,0.14)", "--tone-light": "#5fe0aa" },
};

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Stroke paths use pathLength=1 so the same dash animation draws any shape.
const drawFirst = "[stroke-dasharray:1] [stroke-dashoffset:1] animate-status-draw motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]";
const drawLate = "[stroke-dasharray:1] [stroke-dashoffset:1] animate-status-draw-late motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]";

function Glyph({ type }) {
  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "relative size-[26px] overflow-visible",
  };

  if (type === "warning") {
    return (
      <svg {...svgProps}>
        <path className={drawFirst} pathLength="1" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path className={drawLate} pathLength="1" d="M12 9v4" />
        <circle className="animate-status-dot opacity-0 motion-reduce:animate-none motion-reduce:opacity-100" cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <circle className={drawFirst} pathLength="1" cx="12" cy="12" r="10" transform="rotate(-90 12 12)" />
      {type === "success" ? (
        <path className={drawLate} pathLength="1" d="m8.5 12 2.5 2.5 4.5-5" />
      ) : (
        <>
          <path className={drawLate} pathLength="1" d="m15 9-6 6" />
          <path className={drawLate} pathLength="1" d="m9 9 6 6" />
        </>
      )}
    </svg>
  );
}

// Rounded-square status icon: pops in once, sends out two ripples and a burst
// of dots, then keeps a soft glow and a faint ripple. Nothing shakes.
function StatusIcon({ type }) {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-4 grid size-[72px] animate-status-pop place-items-center motion-reduce:animate-none">
      <span className="pointer-events-none absolute inset-1 animate-status-glow rounded-[22px] bg-(--tone-soft) opacity-0 blur-[10px] motion-reduce:hidden" />
      <span className="pointer-events-none absolute inset-2 animate-status-ripple-loop rounded-[18px] border-[1.5px] border-(--tone) opacity-0 motion-reduce:hidden" />
      <span className="pointer-events-none absolute inset-2 animate-status-ripple rounded-[18px] border-[1.5px] border-(--tone) opacity-0 [animation-delay:0.45s] motion-reduce:hidden" />
      {BURST_ANGLES.map((angle, i) => (
        <i
          key={angle}
          style={{ "--a": `${angle}deg` }}
          className={
            "pointer-events-none absolute left-1/2 top-1/2 animate-status-burst rounded-full opacity-0 motion-reduce:hidden " +
            (i % 2 ? "-m-0.5 size-1 bg-(--tone-light)" : "-m-[3px] size-1.5 bg-(--tone)")
          }
        />
      ))}
      <div className="absolute inset-2 z-10 grid place-items-center rounded-[18px] border border-(--tone-ring) bg-(--tone-soft) text-(--tone)">
        <Glyph type={type} />
      </div>
    </div>
  );
}

export default function StatusDialog({
  open,
  onOpenChange,
  type = "error",
  title,
  description,
  confirmText,
  onConfirm,
  cancelText,
  onCancel,
}) {
  const close = () => onOpenChange?.(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={TONES[type] ?? TONES.error}
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed left-1/2 top-1/2 z-50 w-[min(360px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 animate-dialog-in rounded-[24px] bg-gradient-to-b from-white to-[#f5f9ff] px-[26px] pb-6 pt-[30px] text-center shadow-[0_40px_80px_-24px_rgba(20,51,107,0.5),0_12px_28px_-12px_rgba(20,70,160,0.3),inset_0_1px_0_#fff] outline-none motion-reduce:animate-none"
        >
          <StatusIcon type={type} />
          <Dialog.Title className="m-0 mb-1.5 text-lg font-bold tracking-[-0.2px] text-brand-navy">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="m-0 mb-[22px] text-[13px] leading-relaxed text-[#5b74a3] [&_b]:font-semibold [&_b]:text-brand-navy">
              {description}
            </Dialog.Description>
          ) : (
            <div className="mb-4" />
          )}
          <div className="flex gap-2.5">
            {cancelText && (
              <button
                type="button"
                onClick={onCancel ?? close}
                className="h-[42px] flex-1 cursor-pointer rounded-full border border-[#d9e8fb] bg-white text-sm font-semibold text-[#4a6fa5]"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm ?? close}
              className="h-[42px] flex-1 cursor-pointer rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-bold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2"
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

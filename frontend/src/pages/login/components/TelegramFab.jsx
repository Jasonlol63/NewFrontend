// Same outline as the Telegram logo's paper plane (the cut-out of its circle), without the circle, so the button can
// carry it on the system's own blue. The viewBox is cropped to the plane so it centres exactly.
const PLANE =
  "M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z";

/**
 * Floating Telegram button of the login page (bottom right): opens the support link in a new tab, no sign-in needed.
 * A round brand-blue button with the paper plane and a soft ring that breathes now and then; on hover (or keyboard
 * focus) it lifts and a glass label slides out on its left. Phones get only the round button.
 * Only the round button takes clicks, so the empty strip where the label slides in never opens the link by accident.
 *  - href: the saved https link (the page renders this only when there is one)
 */
export default function TelegramFab({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact support on Telegram"
      className="group fixed bottom-[clamp(16px,3dvh,32px)] right-[clamp(16px,2.2vw,32px)] z-10 pointer-events-none flex flex-row-reverse items-center gap-2.5 outline-none"
    >
      <span className="pointer-events-auto relative grid size-[clamp(54px,6.4dvh,64px)] place-items-center rounded-full bg-[linear-gradient(135deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] shadow-[0_14px_26px_-10px_rgba(20,90,220,0.7),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:-translate-y-[3px] group-hover:scale-[1.04] group-focus-visible:-translate-y-[3px] group-focus-visible:scale-[1.04] group-focus-visible:ring-4 group-focus-visible:ring-brand-blue/40 motion-reduce:transition-none">
        <span aria-hidden="true" className="absolute inset-0 animate-telegram-ring rounded-full motion-reduce:animate-none" />
        <svg viewBox="4.4 5.6 13.7 12.9" aria-hidden="true" className="size-[56%] -translate-x-[2%] translate-y-[1%] fill-white drop-shadow-[0_1px_2px_rgba(0,40,120,0.3)]">
          <path d={PLANE} />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none translate-x-2 whitespace-nowrap rounded-full border border-brand-blue/25 bg-white/90 px-4 py-[9px] text-[13px] font-bold text-brand-navy opacity-0 shadow-[0_12px_24px_-12px_rgba(20,51,107,0.45)] transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 max-sm:hidden motion-reduce:transition-none"
      >
        Contact us on Telegram
      </span>
    </a>
  );
}

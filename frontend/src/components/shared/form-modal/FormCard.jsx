import { cn } from "@/lib/utils";

/**
 * A card of a form modal: blue bar + title on the left, `right` (a count, a switch...) on the
 * right, and a body that scrolls on its own when the screen is too short.
 * bodyClassName replaces the default body padding / scrolling when the card needs its own
 * (e.g. a search row above a list); `body={false}` renders children straight under the header.
 */
export default function FormCard({ title, right, className, bodyClassName, body = true, children }) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-modal-line bg-modal-card shadow-modal-card", className)}>
      <div
        className={cn(
          "flex flex-none items-center gap-2 border-b border-modal-divider px-3.5 pb-2.5 pt-3",
          "@min-[900px]/main:@max-[1099px]/main:px-2.5 @min-[900px]/main:@max-[1099px]/main:pb-2 @min-[900px]/main:@max-[1099px]/main:pt-[9px]",
          "modal-compact:px-3 modal-compact:pb-1.5 modal-compact:pt-[7px] modal-tiny:px-2.5 modal-tiny:pb-[5px] modal-tiny:pt-1.5"
        )}
      >
        <span className="h-4 w-1 flex-none rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
        <h2 className={cn("m-0 whitespace-nowrap text-[16px] font-extrabold text-brand-navy", "@min-[900px]/main:@max-[1099px]/main:text-[14.5px]", "modal-tiny:text-[14px]")}>
          {title}
        </h2>
        {right && <div className="ml-auto flex min-w-0 items-center gap-2">{right}</div>}
      </div>
      {body ? (
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5 pt-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
            "@min-[900px]/main:@max-[1099px]/main:p-2.5",
            "modal-compact:px-3 modal-compact:pb-2.5 modal-compact:pt-2 modal-tiny:px-2.5 modal-tiny:pb-2 modal-tiny:pt-1.5",
            bodyClassName
          )}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

// "3 selected" / "2/14" style count in a card header.
export function CardCount({ children }) {
  return <span className="whitespace-nowrap text-[11.5px] font-bold text-[#3b82f6]">{children}</span>;
}

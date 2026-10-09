import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "./fields.jsx";

/**
 * A text area of a form card with a small Expand button in its top-right corner: onExpand opens a TextEditorSheet with
 * a big box for the same text. It fills the height of its parent (a flex column), like the plain text areas of the cards.
 * The text is upper case when an ancestor sets it (a text area does not inherit text-transform).
 */
export default function ExpandableTextarea({ value, onChange, placeholder, onExpand, expandLabel = "Expand", className, ...props }) {
  return (
    <div className="relative flex min-h-0 flex-1">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          inputClass,
          "h-auto min-h-[40px] flex-1 resize-none py-2 pr-9 leading-snug modal-compact:h-auto modal-tiny:h-auto @min-[900px]/main:@max-[1099px]/main:h-auto",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={onExpand}
        title={expandLabel}
        aria-label={expandLabel}
        className="absolute right-1.5 top-1.5 flex size-6 cursor-pointer items-center justify-center rounded-[7px] border border-[#d5deea] bg-white/90 text-[#475569] transition-colors hover:border-[#93c5fd] hover:text-brand-navy"
      >
        <Maximize2 className="size-3" strokeWidth={2.4} />
      </button>
    </div>
  );
}

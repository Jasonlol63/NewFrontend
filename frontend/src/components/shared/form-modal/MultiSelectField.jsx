import { useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import { CheckListTools, CheckRows } from "./CheckList.jsx";
import { filterItems, toggleIn } from "./listSelection";
import { inputClass, openFieldClass, primaryButtonClass } from "./fields.jsx";

/**
 * Multi-select field: the picked values show as chips in the box (× removes one), the count on
 * the right. Clicking opens a popup with search, Select all / Clear, the tickable list and Done.
 * items: [{ value, label, hint?, tag? }]; selected: Set; onChange(nextSet).
 */
export default function MultiSelectField({ items, selected, onChange, placeholder = "Choose", searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const [query, setQuery] = useState("");
  const shown = filterItems(items, query);
  const picked = items.filter((it) => selected.has(it.value));

  const handleOpenChange = (next) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Anchor asChild>
        <div
          ref={anchorRef}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => handleOpenChange(!open)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenChange(!open);
            }
          }}
          className={cn(
            inputClass,
            "relative flex h-auto min-h-9 cursor-pointer flex-wrap items-center gap-1 py-[3px] pl-[5px] pr-16 hover:border-[#93c5fd]",
            "@min-[900px]/main:@max-[1099px]/main:min-h-8 modal-compact:min-h-[30px] modal-tiny:min-h-7",
            open && openFieldClass
          )}
        >
          {picked.length === 0 ? (
            <span className="pl-1.5 text-dash-faint">{placeholder}</span>
          ) : (
            picked.map((it) => (
              <span
                key={it.value}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-[7px] border border-[#7fb2ff] bg-row-stripe pl-2.5 pr-1 text-[12px] font-extrabold text-brand-navy modal-compact:h-[22px] modal-tiny:h-5 modal-tiny:text-[11.5px]"
              >
                {it.label}
                <button
                  type="button"
                  aria-label={`Remove ${it.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(toggleIn(selected, it.value));
                  }}
                  className="flex size-4 cursor-pointer items-center justify-center rounded-[5px] border-none bg-transparent p-0 text-[#64748b] hover:bg-white/90 hover:text-[#ef4444]"
                >
                  <X className="size-3" strokeWidth={3} />
                </button>
              </span>
            ))
          )}
          <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[11px] font-bold text-[#8a96a8]">
            {selected.size}/{items.length}
            <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180 text-[#3b82f6]")} strokeWidth={2.4} />
          </span>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          // A click on the field itself toggles it (its own onClick); don't also count it as "outside".
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target)) e.preventDefault();
          }}
          className="z-50 flex max-h-[min(380px,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-[300px] flex-col overflow-hidden rounded-xl border border-dash-line bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]"
        >
          <CheckListTools
            query={query}
            onQuery={setQuery}
            placeholder={searchPlaceholder}
            onSelectAll={() => onChange(new Set([...selected, ...shown.map((it) => it.value)]))}
            onClear={() => onChange(new Set())}
            className="border-b border-[#eef2f7] p-2"
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <CheckRows items={shown} selected={selected} onToggle={(v) => onChange(toggleIn(selected, v))} />
          </div>
          <div className="flex flex-none items-center justify-between gap-2 border-t border-[#eef2f7] bg-[#fafcff] py-[7px] pl-3.5 pr-2.5 text-[12px] font-semibold text-[#64748b]">
            <span>
              <b className="text-brand-navy">{selected.size}</b> of {items.length} selected
            </span>
            <button type="button" onClick={() => handleOpenChange(false)} className={cn(primaryButtonClass, "h-7 px-4 text-[12.5px]")}>
              Done
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

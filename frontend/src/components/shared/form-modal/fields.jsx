import { useMemo, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Plus, Search, SquarePen, X } from "lucide-react";
import { Popover, Select } from "radix-ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Form controls of the full-area form modals (Add / Edit User, Add / Edit Account).
// Sizes follow the modal tiers: @min-[900px]/main:@max-[1099px]/main = narrow content area,
// modal-compact / modal-tiny = short screens (see index.css).

export const inputClass =
  "h-9 w-full rounded-[10px] border border-modal-input-line bg-modal-input px-3 fm-input text-[#111827] shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] @min-[900px]/main:@max-[1099px]/main:h-8 modal-compact:h-[30px] modal-tiny:h-7";

// Blue outline of a field whose popup is open (Select, date, multi-select).
export const openFieldClass = "border-[#3b82f6] shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";

export function TextInput({ className, ...props }) {
  return <input className={cn(inputClass, className)} {...props} />;
}

// optional: no red star, a small "(opt.)" instead. The 320px phone layout has no room for it
// beside a long label, so it's dropped there; the missing star still marks the field optional.
// plain: neither mark (read-only boxes).
// as="div" for controls that hold several buttons (a click on a <label> is forwarded to its first button).
export function Field({ label, optional, plain, as: Tag = "label", className, children }) {
  const { t } = useTranslation();
  return (
    <Tag className={cn("block min-w-0", className)}>
      <span className="mb-1 ml-0.5 block truncate fm-label text-[#374151] modal-compact:mb-0.5 modal-tiny:mb-px">
        {label}{" "}
        {plain ? null : optional ? (
          <span className="fm-opt text-[#8a96a8] @max-[219px]/info:hidden">{t("optional")}</span>
        ) : (
          <i className="not-italic text-[#ef4444]">*</i>
        )}
      </span>
      {children}
    </Tag>
  );
}

// Password box with its own show / hide eye.
export function PasswordInput({ value, onChange, className, ...props }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-dash-faint hover:text-[#64748b]"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
      </button>
    </div>
  );
}

/**
 * Dropdown styled like the rest of the modal (a native <select> list can't be styled).
 * options: [{ value, label }]. The list is exactly as wide as the trigger, opens below it
 * (above when there's no room) and scrolls inside itself if the screen is too short.
 * onClear: while a value is chosen, a small x inside the box clears it (onClear is called).
 * capped: the list is at most 280px high (as high as a SearchSelectField list) and scrolls, for a long list; a number sets
 * that height in px instead (e.g. capped={200}).
 * uppercase: the shown value, the placeholder and the options are all upper case (the popup is outside the modal, so it
 * needs the class itself).
 */
export function SelectField({ value, onChange, options, placeholder: placeholderProp, disabled = false, onClear, uppercase = false, capped = false }) {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t("select");
  const label = options.find((o) => o.value === value)?.label;
  const clearable = Boolean(onClear && value && !disabled);
  const select = (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger
        title={label}
        className={cn(
          inputClass,
          uppercase && "uppercase",
          "group flex cursor-pointer items-center gap-2 pr-2.5 text-left hover:border-[#93c5fd]",
          "data-[state=open]:border-[#3b82f6] data-[state=open]:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] data-placeholder:text-dash-faint",
          "data-disabled:cursor-not-allowed data-disabled:bg-modal-off data-disabled:text-dash-faint data-disabled:hover:border-modal-input-line"
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", clearable && "pr-6")}>
          <Select.Value placeholder={placeholder} />
        </span>
        <Select.Icon asChild>
          <ChevronDown
            className="size-3.5 flex-none text-dash-faint transition-transform group-data-[state=open]:rotate-180 group-data-[state=open]:text-[#3b82f6] motion-reduce:transition-none"
            strokeWidth={2.4}
          />
        </Select.Icon>
      </Select.Trigger>
      {/* In full screen only the full-screen element is drawn, so the list goes inside it. */}
      <Select.Portal container={document.fullscreenElement ?? undefined}>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          style={capped ? { maxHeight: `min(${capped === true ? 280 : capped}px, var(--radix-select-content-available-height))` } : undefined}
          className={cn(
            "z-50 w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-modal-line bg-modal-float shadow-[0_14px_32px_-10px_rgba(20,51,107,0.32)] backdrop-blur-xl",
            !capped && "max-h-(--radix-select-content-available-height)",
            uppercase && "uppercase"
          )}
        >
          <Select.Viewport className="flex flex-col gap-0.5 p-[5px]">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className={cn(
                  "flex min-h-[34px] cursor-pointer select-none items-center gap-2 rounded-[9px] border border-transparent py-1.5 pl-2.5 pr-2 text-[13px] font-semibold text-[#374151] outline-none",
                  "modal-compact:min-h-[30px] modal-compact:py-1 modal-tiny:min-h-7 modal-tiny:text-[12.5px]",
                  "data-highlighted:bg-[#eef4ff]",
                  "data-[state=checked]:border-[#7fb2ff] data-[state=checked]:bg-row-stripe data-[state=checked]:font-bold data-[state=checked]:text-brand-navy"
                )}
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto flex size-4 flex-none items-center justify-center rounded-full bg-brand-sweep text-white shadow-[0_3px_8px_-3px_rgba(20,90,220,0.6)]">
                  <Check className="size-2.5" strokeWidth={4} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
  if (!onClear) return select;
  return (
    <div className="relative">
      {select}
      {clearable && (
        <button
          type="button"
          aria-label={t("clear")}
          title={t("clear")}
          onClick={onClear}
          className="absolute top-1/2 right-7 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-[#94a3b8] transition-colors hover:bg-[#fee2e2] hover:text-[#ef4444]"
        >
          <X className="size-3.5" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

/**
 * A SelectField for a long list: the list is at most 240px high and scrolls, and a search box on top narrows it
 * (typed letters show in capitals, the match ignores case; Enter picks the first match). options: [{ value, label }].
 */
export function SearchSelectField({ value, onChange, options, placeholder: placeholderProp, searchPlaceholder: searchProp, disabled = false, onClear, uppercase = false }) {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t("select");
  const searchPlaceholder = searchProp ?? t("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const label = options.find((o) => o.value === value)?.label;
  const clearable = Boolean(onClear && value && !disabled);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const pick = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const field = (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("");
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          title={label}
          className={cn(
            inputClass,
            uppercase && "uppercase",
            "group flex cursor-pointer items-center gap-2 pr-2.5 text-left hover:border-[#93c5fd]",
            open && openFieldClass,
            "disabled:cursor-not-allowed disabled:bg-modal-off disabled:text-dash-faint disabled:hover:border-modal-input-line"
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !label && "text-dash-faint", clearable && "pr-6")}>{label ?? placeholder}</span>
          <ChevronDown className={cn("size-3.5 flex-none text-dash-faint transition-transform", open && "rotate-180 text-[#3b82f6]")} strokeWidth={2.4} />
        </button>
      </Popover.Trigger>
      {/* In full screen only the full-screen element is drawn, so the list goes inside it. */}
      <Popover.Portal container={document.fullscreenElement ?? undefined}>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={cn("z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-xl border border-modal-line bg-modal-float shadow-[0_14px_32px_-10px_rgba(20,51,107,0.32)] backdrop-blur-xl", uppercase && "uppercase")}
        >
          <label className="flex items-center gap-2 border-b border-modal-input-line px-3 py-2">
            <Search className="size-3.5 flex-none text-dash-faint" strokeWidth={2.2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown[0]) pick(shown[0]);
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-transparent text-[13px] uppercase outline-none placeholder:text-dash-faint placeholder:normal-case"
            />
          </label>
          <div className="flex max-h-[min(240px,calc(var(--radix-popover-content-available-height)-48px))] flex-col gap-0.5 overflow-y-auto p-[5px] [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            {shown.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o)}
                className={cn(
                  "flex min-h-[34px] w-full flex-none cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-2.5 py-1.5 text-left text-[13px] font-semibold text-[#374151] hover:bg-[#eef4ff] modal-compact:min-h-[30px] modal-tiny:min-h-7 modal-tiny:text-[12.5px]",
                  o.value === value && "border-[#7fb2ff] bg-row-stripe font-bold text-brand-navy"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.value === value && (
                  <span className="flex size-4 flex-none items-center justify-center rounded-full bg-brand-sweep text-white shadow-[0_3px_8px_-3px_rgba(20,90,220,0.6)]">
                    <Check className="size-2.5" strokeWidth={4} />
                  </span>
                )}
              </button>
            ))}
            {shown.length === 0 && <p className="m-0 px-2.5 py-2 text-center text-[12px] text-dash-faint">{t("noResults")}</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
  if (!onClear) return field;
  return (
    <div className="relative">
      {field}
      {clearable && (
        <button
          type="button"
          aria-label={t("clear")}
          title={t("clear")}
          onClick={onClear}
          className="absolute top-1/2 right-7 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-[#94a3b8] transition-colors hover:bg-[#fee2e2] hover:text-[#ef4444]"
        >
          <X className="size-3.5" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

// The button beside a select: "+" (add a new one) while nothing is chosen, the pen (edit the chosen one) once something is.
// Both are the same pale blue button as tall as an input: same dashed outline for both (solid on hover); only the icon differs.
export function AddButton({ label, edit = false, className, ...props }) {
  const Icon = edit ? SquarePen : Plus;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-[#7fb2ff] bg-[rgba(232,242,255,0.7)] text-[#2563eb] transition-colors hover:bg-[#d6e8ff]",
        "border-dashed hover:border-solid",
        "@min-[900px]/main:@max-[1099px]/main:size-8 modal-compact:size-[30px] modal-tiny:size-7",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <Icon className="size-4" strokeWidth={edit ? 2.1 : 2.4} />
    </button>
  );
}

// Small on / off switch with its label on the right (Read only, Payment Alert On / Off).
export function ToggleSwitch({ on, onToggle, label, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "inline-flex flex-none cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 fm-btn-sm text-[#475569] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className={cn("relative h-[18px] w-8 rounded-full transition-colors", on ? "bg-brand-sweep" : "bg-[#cbd5e1]")}>
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left]",
            on ? "left-4" : "left-0.5"
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function SoftButton({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-white/80 bg-white/55 text-[13px] font-bold text-brand-navy hover:bg-white/75",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Blue gradient button (Save, Create): same look as the modal header icon.
export const primaryButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-none bg-brand-sweep font-bold text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] hover:brightness-105";

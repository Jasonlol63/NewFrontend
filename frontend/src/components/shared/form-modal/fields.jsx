import { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Plus, SquarePen, X } from "lucide-react";
import { Select } from "radix-ui";
import { cn } from "@/lib/utils";

// Form controls of the full-area form modals (Add / Edit User, Add / Edit Account).
// Sizes follow the modal tiers: @min-[900px]/main:@max-[1099px]/main = narrow content area,
// modal-compact / modal-tiny = short screens (see index.css).

export const inputClass =
  "h-9 w-full rounded-[10px] border border-modal-input-line bg-modal-input px-3 text-[13.5px] text-[#111827] shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] @min-[900px]/main:@max-[1099px]/main:h-8 @min-[900px]/main:@max-[1099px]/main:text-[13px] modal-compact:h-[30px] modal-tiny:h-7 modal-tiny:text-[12.5px]";

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
  return (
    <Tag className={cn("block min-w-0", className)}>
      <span className="mb-1 ml-0.5 block truncate text-[12.5px] font-semibold text-[#374151] modal-compact:mb-0.5 modal-compact:text-[12px] modal-tiny:mb-px modal-tiny:text-[11.5px]">
        {label}{" "}
        {plain ? null : optional ? (
          <span className="text-[10px] font-medium text-[#8a96a8] @max-[219px]/info:hidden">(opt.)</span>
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
        aria-label={visible ? "Hide password" : "Show password"}
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
 * uppercase: the shown value, the placeholder and the options are all upper case (the popup is outside the modal, so it
 * needs the class itself).
 */
export function SelectField({ value, onChange, options, placeholder = "Select", disabled = false, onClear, uppercase = false }) {
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
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-modal-line bg-modal-float shadow-[0_14px_32px_-10px_rgba(20,51,107,0.32)] backdrop-blur-xl",
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
          aria-label="Clear"
          title="Clear"
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
        "inline-flex flex-none cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[12px] font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-50",
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

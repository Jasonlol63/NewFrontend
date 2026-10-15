import { useState } from "react";
import { Dialog, Popover } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { FEMALE_AVATARS, MALE_AVATARS, sameAvatar } from "./avatarCatalog";

// The frosted blue glass of the system dialogs (Add User, Add Account...): the panel is blue-tinted, its blocks are white glass.
const GLASS =
  "border border-modal-line bg-modal-bg backdrop-blur-[22px] backdrop-saturate-[1.15] shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)]";

const TABS = [
  { key: "male", list: MALE_AVATARS },
  { key: "female", list: FEMALE_AVATARS },
];

/**
 * The profile avatar of the sidebar as a button that opens the avatar chooser: a small popover beside the avatar (an arrow
 * points at it), or a sheet from the bottom of the screen on a phone. The pick is only applied with Save.
 * children: the avatar picture(s) inside the button (`className` styles the button); value: the current avatar src;
 * onSave(src) is called with the new one; label: the button's accessible name.
 */
export default function AvatarPicker({ value, onSave, label, className, children }) {
  const [open, setOpen] = useState(false);
  // The popover opens beside the sidebar, not on top of it: its distance from the avatar is the avatar's distance to the
  // sidebar's right edge (the element marked data-avatar-boundary) plus a small gap, measured when the avatar is clicked.
  const [gap, setGap] = useState(14);
  const measure = (e) => {
    const edge = e.currentTarget.closest("[data-avatar-boundary]")?.getBoundingClientRect().right;
    setGap((edge ? Math.max(0, edge - e.currentTarget.getBoundingClientRect().right) : 0) + 14);
  };
  const sheet = useMediaQuery("(max-width: 639px)");
  const close = () => setOpen(false);
  const panel = <ChooserPanel value={value} onSave={(src) => { onSave(src); close(); }} onClose={close} />;

  const trigger = (
    <button type="button" onClick={measure} aria-label={label} aria-haspopup="dialog" aria-expanded={open} className={cn("cursor-pointer border-none p-[2px]", className)}>
      {children}
    </button>
  );

  if (sheet) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(20,51,107,0.3)] backdrop-blur-[3px] animate-dialog-overlay motion-reduce:animate-none" />
          <Dialog.Content
            aria-label={label}
            aria-describedby={undefined}
            className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[20px] px-4 pt-2 pb-4 outline-none", GLASS)}
          >
            <div aria-hidden className="mx-auto mb-2 h-1 w-9 flex-none rounded-full bg-slate-300" />
            {panel}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={gap}
          collisionPadding={10}
          aria-label={label}
          className={cn("z-50 flex w-[300px] max-h-[var(--radix-popover-content-available-height)] flex-col rounded-2xl p-3.5 outline-none animate-in fade-in-0 zoom-in-95", GLASS)}
        >
          {panel}
          <Popover.Arrow className="fill-[#dce7f5]" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Avatar({ src, className }) {
  return <img src={src} alt="" draggable={false} className={cn("rounded-full object-cover", className)} />;
}

function ChooserPanel({ value, onSave, onClose }) {
  const { t } = useTranslation("sidebar");
  const [draft, setDraft] = useState(value);
  // Open on the tab that holds the current avatar.
  const [tab, setTab] = useState(() => (FEMALE_AVATARS.some((src) => sameAvatar(src, value)) ? "female" : "male"));
  const list = TABS.find((x) => x.key === tab).list;
  const changed = !sameAvatar(draft, value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2.5 flex flex-none items-center justify-between">
        <h2 className="m-0 type-card-title font-semibold! text-brand-navy">{t("avatar.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("avatar.close")}
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-modal-input-line bg-modal-input text-brand-navy hover:bg-white/90"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      </div>

      {/* What the pick looks like in the sidebar, updated as the user clicks. Left out on short screens to keep the room for the pictures. */}
      <div className="mb-2.5 flex flex-none items-center gap-3 rounded-xl border border-modal-line bg-modal-card px-3 py-2 shadow-modal-card short:hidden">
        <span className="flex size-[46px] flex-none rounded-full p-[2px] shadow-[0_0_10px_1px_rgba(56,189,248,0.45)]" style={{ backgroundImage: "conic-gradient(from 180deg, #38bdf8, #0a3fc9, #38bdf8)" }}>
          <Avatar src={draft} className="size-full border-2 border-white" />
        </span>
        <div className="min-w-0">
          <div className="type-label font-semibold! text-brand-navy">{t("avatar.preview")}</div>
          <div className="type-caption font-medium! text-[#5b74a3]">{t("avatar.previewHint")}</div>
        </div>
      </div>

      {/* The system pill switch (as the language switch of the sidebar), centred. */}
      <div className="mb-3 flex flex-none justify-center">
        <PillSwitch options={TABS.map(({ key }) => ({ value: key, label: t(`avatar.${key}`) }))} value={tab} onChange={setTab} itemWidth={124} />
      </div>

      {/* The pictures scroll inside the popover when the screen is short. */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <div className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-3">
          {list.map((src) => {
            const selected = sameAvatar(src, draft);
            const current = sameAvatar(src, value);
            return (
              <button
                key={src}
                type="button"
                aria-pressed={selected}
                title={current ? t("avatar.current") : undefined}
                onClick={() => setDraft(src)}
                className={cn(
                  "relative size-[62px] cursor-pointer rounded-full border-none bg-white p-0 transition-transform hover:scale-105",
                  selected
                    ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_#2f8dff]"
                    : current
                      ? "shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#bcd3fb]"
                      : "shadow-[0_0_0_1px_#e5e7eb]"
                )}
              >
                <Avatar src={src} className="size-full" />
                {selected && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-white bg-brand-sweep text-white">
                    <Check className="size-2.5" strokeWidth={4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-none gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-9 flex-1 cursor-pointer rounded-[10px] border border-modal-input-line bg-modal-input type-body font-semibold! text-brand-navy hover:bg-white/90"
        >
          {t("avatar.cancel")}
        </button>
        <button
          type="button"
          disabled={!changed}
          onClick={() => onSave(draft)}
          className="h-9 flex-1 cursor-pointer rounded-[10px] border-none bg-brand-sweep type-body font-semibold! text-white shadow-[0_8px_16px_-8px_rgba(20,90,220,0.6)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100"
        >
          {t("avatar.save")}
        </button>
      </div>
    </div>
  );
}

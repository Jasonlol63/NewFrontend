import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Right-click menu of the sheet, in the same frosted style as the dropdown lists.
 * menu: { x, y, items: [{ label, icon: LucideIcon, onSelect, danger?, disabled?, separator? }] } or null.
 * It stays inside the window and closes on any outside click, Escape, scroll or resize.
 */
export default function GridContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    setPos({ left: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)), top: Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => onClose();
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={pos ?? { left: menu.x, top: menu.y, visibility: "hidden" }}
      className="fixed z-50 min-w-[176px] rounded-xl border border-modal-line bg-modal-float p-[5px] shadow-[0_14px_32px_-10px_rgba(20,51,107,0.32)] backdrop-blur-xl"
    >
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="mx-1 my-[3px] h-px bg-modal-input-line" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={cn(
              "flex min-h-[32px] w-full cursor-pointer items-center gap-2.5 rounded-[9px] border-none bg-transparent px-2.5 py-1 text-left type-body font-medium! text-[#374151] hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
              item.danger && "text-dash-down hover:bg-[#fff1f1]"
            )}
          >
            {item.icon && <item.icon className="size-4 flex-none" strokeWidth={2.1} />}
            {item.label}
          </button>
        )
      )}
    </div>,
    // In full screen only the full-screen element is drawn, so the menu goes inside it.
    document.fullscreenElement ?? document.body
  );
}

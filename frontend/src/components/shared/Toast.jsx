import { cn } from "@/lib/utils";

// What the last action did, over the top of the page; the page's useNotice() clears it by itself.
const TONE = {
  success: "border-[#a7e3c8] bg-[#e7f8f0] text-[#0f7a52]",
  error: "border-[#f7b9b9] bg-[#fdecec] text-[#b42323]",
  info: "border-[#bcd3f7] bg-[#eaf2ff] text-[#1d4ed8]",
};

/** notice = { message, level: "success" | "error" | "info", at } or null (see hooks/useNotice). Put it in a `relative` page. */
export default function Toast({ notice }) {
  if (!notice) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
      <div key={notice.at} className={cn("max-w-[min(720px,100%)] animate-dialog-in rounded-[10px] border px-3.5 py-2 text-[12.5px] font-bold shadow-[0_10px_24px_-12px_rgba(20,51,107,0.45)] motion-reduce:animate-none", TONE[notice.level] ?? TONE.info)}>
        {notice.message}
      </div>
    </div>
  );
}

// Stand-in for submenu pages that are not built yet.
export default function ComingSoonPage({ group, title }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-fluid-md text-center">
      <div className="text-[12px] font-semibold uppercase tracking-[0.6px] text-slate-400">{group}</div>
      <h1 className="text-[22px] font-extrabold text-slate-700">{title}</h1>
      <p className="text-[13px] text-slate-500">This page is not available yet.</p>
    </div>
  );
}

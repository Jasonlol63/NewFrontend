import { cn } from "@/lib/utils";

export default function StepDots({ step, total = 3 }) {
  return (
    <div className="mb-5 mt-0.5 flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((seg) => (
        <div key={seg} className="h-1 w-[30px] overflow-hidden rounded-full bg-[#dbe7f7]">
          <div
            className={cn(
              "h-full origin-left bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] transition-transform duration-[400ms] ease-out",
              seg <= step ? "scale-x-100" : "scale-x-0"
            )}
          />
        </div>
      ))}
    </div>
  );
}

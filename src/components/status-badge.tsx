import { cn } from "@/lib/utils";

const statusTone = {
  draft: "bg-white text-slate-700 border-slate-200",
  reviewed: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function StatusBadge({ status }: { status: keyof typeof statusTone }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusTone[status],
      )}
    >
      {status}
    </span>
  );
}
import { cn } from "@/lib/utils";

const statusTone = {
  draft: "bg-white text-slate-700 border-slate-200",
  curated: "bg-sky-50 text-sky-800 border-sky-200",
  artifact_complete: "bg-cyan-50 text-cyan-800 border-cyan-200",
  ready_for_projection: "bg-indigo-50 text-indigo-800 border-indigo-200",
  archived: "bg-stone-100 text-stone-700 border-stone-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  human_reviewed: "bg-orange-50 text-orange-800 border-orange-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
  not_started: "bg-slate-100 text-slate-700 border-slate-200",
  previewed: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  projected: "bg-violet-50 text-violet-800 border-violet-200",
  generated: "bg-blue-50 text-blue-800 border-blue-200",
  exported: "bg-lime-50 text-lime-800 border-lime-200",
  manual: "bg-slate-100 text-slate-800 border-slate-200",
  assisted: "bg-teal-50 text-teal-800 border-teal-200",
  write_query: "bg-cyan-50 text-cyan-900 border-cyan-200",
  rag_reply: "bg-emerald-50 text-emerald-900 border-emerald-200",
  routing: "bg-sky-50 text-sky-900 border-sky-200",
  tool_selection: "bg-amber-50 text-amber-900 border-amber-200",
  memory_write_decision: "bg-rose-50 text-rose-900 border-rose-200",
  custom: "bg-stone-100 text-stone-800 border-stone-200",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status as keyof typeof statusTone] ?? statusTone.draft;

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        tone,
      )}
    >
      {status}
    </span>
  );
}
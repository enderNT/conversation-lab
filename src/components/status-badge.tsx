import { cn } from "@/lib/utils";

const statusTone = {
  draft: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#475569",
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  curated: {
    background: "rgba(14, 165, 233, 0.14)",
    color: "#075985",
    borderColor: "rgba(14, 165, 233, 0.24)",
  },
  artifact_complete: {
    background: "rgba(6, 182, 212, 0.14)",
    color: "#155e75",
    borderColor: "rgba(6, 182, 212, 0.24)",
  },
  ready_for_projection: {
    background: "rgba(99, 102, 241, 0.14)",
    color: "#4338ca",
    borderColor: "rgba(99, 102, 241, 0.24)",
  },
  archived: {
    background: "rgba(120, 113, 108, 0.14)",
    color: "#57534e",
    borderColor: "rgba(120, 113, 108, 0.22)",
  },
  pending: {
    background: "rgba(245, 158, 11, 0.14)",
    color: "#92400e",
    borderColor: "rgba(245, 158, 11, 0.24)",
  },
  human_reviewed: {
    background: "rgba(249, 115, 22, 0.14)",
    color: "#9a3412",
    borderColor: "rgba(249, 115, 22, 0.24)",
  },
  approved: {
    background: "rgba(16, 185, 129, 0.14)",
    color: "#047857",
    borderColor: "rgba(16, 185, 129, 0.24)",
  },
  rejected: {
    background: "rgba(244, 63, 94, 0.14)",
    color: "#be123c",
    borderColor: "rgba(244, 63, 94, 0.24)",
  },
  not_started: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#475569",
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  previewed: {
    background: "rgba(217, 70, 239, 0.14)",
    color: "#a21caf",
    borderColor: "rgba(217, 70, 239, 0.24)",
  },
  projected: {
    background: "rgba(139, 92, 246, 0.14)",
    color: "#7c3aed",
    borderColor: "rgba(139, 92, 246, 0.24)",
  },
  generated: {
    background: "rgba(59, 130, 246, 0.14)",
    color: "#1d4ed8",
    borderColor: "rgba(59, 130, 246, 0.24)",
  },
  exported: {
    background: "rgba(132, 204, 22, 0.14)",
    color: "#4d7c0f",
    borderColor: "rgba(132, 204, 22, 0.24)",
  },
  manual: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#334155",
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  assisted: {
    background: "rgba(20, 184, 166, 0.14)",
    color: "#0f766e",
    borderColor: "rgba(20, 184, 166, 0.24)",
  },
  write_query: {
    background: "rgba(6, 182, 212, 0.14)",
    color: "#155e75",
    borderColor: "rgba(6, 182, 212, 0.24)",
  },
  rag_reply: {
    background: "rgba(16, 185, 129, 0.14)",
    color: "#047857",
    borderColor: "rgba(16, 185, 129, 0.24)",
  },
  routing: {
    background: "rgba(14, 165, 233, 0.14)",
    color: "#075985",
    borderColor: "rgba(14, 165, 233, 0.24)",
  },
  tool_selection: {
    background: "rgba(245, 158, 11, 0.14)",
    color: "#92400e",
    borderColor: "rgba(245, 158, 11, 0.24)",
  },
  memory_write_decision: {
    background: "rgba(244, 63, 94, 0.14)",
    color: "#be123c",
    borderColor: "rgba(244, 63, 94, 0.24)",
  },
  custom: {
    background: "rgba(120, 113, 108, 0.14)",
    color: "#57534e",
    borderColor: "rgba(120, 113, 108, 0.22)",
  },
};

const darkStatusTone = {
  draft: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#e2e8f0",
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  curated: {
    background: "rgba(14, 165, 233, 0.18)",
    color: "#c7f0ff",
    borderColor: "rgba(14, 165, 233, 0.32)",
  },
  artifact_complete: {
    background: "rgba(6, 182, 212, 0.18)",
    color: "#baf7ff",
    borderColor: "rgba(6, 182, 212, 0.32)",
  },
  ready_for_projection: {
    background: "rgba(99, 102, 241, 0.2)",
    color: "#ddd8ff",
    borderColor: "rgba(129, 140, 248, 0.34)",
  },
  archived: {
    background: "rgba(120, 113, 108, 0.18)",
    color: "#e7e5e4",
    borderColor: "rgba(168, 162, 158, 0.3)",
  },
  pending: {
    background: "rgba(245, 158, 11, 0.2)",
    color: "#fde7b0",
    borderColor: "rgba(251, 191, 36, 0.34)",
  },
  human_reviewed: {
    background: "rgba(249, 115, 22, 0.2)",
    color: "#ffd8bf",
    borderColor: "rgba(251, 146, 60, 0.34)",
  },
  approved: {
    background: "rgba(16, 185, 129, 0.2)",
    color: "#bdf7df",
    borderColor: "rgba(52, 211, 153, 0.34)",
  },
  rejected: {
    background: "rgba(244, 63, 94, 0.2)",
    color: "#ffd0d8",
    borderColor: "rgba(251, 113, 133, 0.34)",
  },
  not_started: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#e2e8f0",
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  previewed: {
    background: "rgba(217, 70, 239, 0.2)",
    color: "#f5c7ff",
    borderColor: "rgba(232, 121, 249, 0.34)",
  },
  projected: {
    background: "rgba(139, 92, 246, 0.2)",
    color: "#e7d6ff",
    borderColor: "rgba(167, 139, 250, 0.34)",
  },
  generated: {
    background: "rgba(59, 130, 246, 0.2)",
    color: "#d2e3ff",
    borderColor: "rgba(96, 165, 250, 0.34)",
  },
  exported: {
    background: "rgba(132, 204, 22, 0.2)",
    color: "#e3f8ba",
    borderColor: "rgba(163, 230, 53, 0.34)",
  },
  manual: {
    background: "rgba(148, 163, 184, 0.16)",
    color: "#e2e8f0",
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  assisted: {
    background: "rgba(20, 184, 166, 0.2)",
    color: "#c7fff7",
    borderColor: "rgba(45, 212, 191, 0.34)",
  },
  write_query: {
    background: "rgba(6, 182, 212, 0.18)",
    color: "#baf7ff",
    borderColor: "rgba(6, 182, 212, 0.32)",
  },
  rag_reply: {
    background: "rgba(16, 185, 129, 0.2)",
    color: "#bdf7df",
    borderColor: "rgba(52, 211, 153, 0.34)",
  },
  routing: {
    background: "rgba(14, 165, 233, 0.18)",
    color: "#c7f0ff",
    borderColor: "rgba(14, 165, 233, 0.32)",
  },
  tool_selection: {
    background: "rgba(245, 158, 11, 0.2)",
    color: "#fde7b0",
    borderColor: "rgba(251, 191, 36, 0.34)",
  },
  memory_write_decision: {
    background: "rgba(244, 63, 94, 0.2)",
    color: "#ffd0d8",
    borderColor: "rgba(251, 113, 133, 0.34)",
  },
  custom: {
    background: "rgba(120, 113, 108, 0.18)",
    color: "#e7e5e4",
    borderColor: "rgba(168, 162, 158, 0.3)",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const isDarkTheme =
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const toneMap = isDarkTheme ? darkStatusTone : statusTone;
  const tone = toneMap[status as keyof typeof toneMap] ?? toneMap.draft;

  return (
    <span
      className={cn("status-badge")}
      style={tone}
    >
      {status}
    </span>
  );
}
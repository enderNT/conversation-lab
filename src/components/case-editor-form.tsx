import { CaseStatus } from "@prisma/client";
import { createCase, updateCase } from "@/app/actions";
import type { CaseArtifacts, CaseLabels, ConversationSliceItem } from "@/lib/types";

type CaseEditorFormProps = {
  mode: "create" | "edit";
  projectId: string;
  sessionId: string;
  caseId?: string;
  title: string;
  lastUserMessage: string;
  labels: CaseLabels;
  artifacts: CaseArtifacts;
  notes: string;
  status: CaseStatus;
  conversationSlice: ConversationSliceItem[];
  selection?: {
    startOrderIndex: number;
    endOrderIndex: number;
  };
};

export function CaseEditorForm({
  mode,
  projectId,
  sessionId,
  caseId,
  title,
  lastUserMessage,
  labels,
  artifacts,
  notes,
  status,
  conversationSlice,
  selection,
}: CaseEditorFormProps) {
  const action =
    mode === "create"
      ? createCase.bind(null, projectId, sessionId)
      : updateCase.bind(null, caseId ?? "");

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Conversation slice</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Este slice se guarda dentro de `conversationSliceJson` cuando confirmas.
          </p>
        </div>

        <div className="space-y-3">
          {conversationSlice.map((message) => (
            <div
              key={message.id}
              className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {message.role} • Turn {message.orderIndex + 1}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Case editor</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Completa o corrige los campos antes de guardar.
          </p>
        </div>

        {selection ? (
          <>
            <input type="hidden" name="startOrderIndex" value={selection.startOrderIndex} />
            <input type="hidden" name="endOrderIndex" value={selection.endOrderIndex} />
          </>
        ) : null}

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Title</span>
            <input className="field" name="title" defaultValue={title} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Last user message</span>
            <textarea
              className="field min-h-24"
              name="lastUserMessage"
              defaultValue={lastUserMessage}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">expected_route</span>
            <input
              className="field"
              name="expectedRoute"
              defaultValue={labels.expected_route}
              placeholder="rag_subgraph"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">ideal_search_query</span>
            <textarea
              className="field min-h-24"
              name="idealSearchQuery"
              defaultValue={artifacts.ideal_search_query}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">ideal_answer</span>
            <textarea
              className="field min-h-32"
              name="idealAnswer"
              defaultValue={artifacts.ideal_answer}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">expected_tool</span>
            <input
              className="field"
              name="expectedTool"
              defaultValue={artifacts.expected_tool}
              placeholder="search_products"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Notes</span>
            <textarea className="field min-h-28" name="notes" defaultValue={notes} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Status</span>
            <select className="field" name="status" defaultValue={status}>
              <option value={CaseStatus.draft}>draft</option>
              <option value={CaseStatus.reviewed}>reviewed</option>
              <option value={CaseStatus.approved}>approved</option>
            </select>
          </label>

          <button type="submit" className="button-primary w-full">
            {mode === "create" ? "Save Case" : "Update Case"}
          </button>
        </div>
      </section>
    </form>
  );
}
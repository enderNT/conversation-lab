import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseEditorForm } from "@/components/case-editor-form";
import { deriveLastUserMessage, suggestCompatibleTaskSpecs, toConversationSlice } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { parseInteger } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { projectId, sessionId } = await params;
  const resolvedSearchParams = await searchParams;

  const start = parseInteger(resolvedSearchParams.start);
  const end = parseInteger(resolvedSearchParams.end);

  if (start === null || end === null || start > end) {
    notFound();
  }

  await ensureDefaultTaskSpecs();

  const [session, taskSpecs] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        project: true,
        messages: {
          where: {
            orderIndex: {
              gte: start,
              lte: end,
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    }),
    prisma.taskSpec.findMany({
      where: { isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        taskType: true,
        version: true,
        requiredArtifactsJson: true,
        optionalArtifactsJson: true,
      },
    }),
  ]);

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  if (session.messages.length !== end - start + 1 || session.messages.length === 0) {
    notFound();
  }

  const conversationSlice = toConversationSlice(session.messages);
  const taskSuggestions = suggestCompatibleTaskSpecs(taskSpecs, []);

  return (
    <div className="space-y-8">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <Link
          href={`/projects/${projectId}/sessions/${sessionId}`}
          className="text-sm text-[var(--muted)] underline underline-offset-4"
        >
          Back to session
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Create case from selected conversation
        </h1>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          Proyecto: {session.project.name} • Sesión: {session.title || "Untitled session"} • Turnos {start + 1} a {end + 1}
        </p>
      </section>

      <CaseEditorForm
        mode="create"
        projectId={projectId}
        projectName={session.project.name}
        sessionId={sessionId}
        sessionTitle={session.title || "Untitled session"}
        title=""
        sourceSummary=""
        lastUserMessage={deriveLastUserMessage(conversationSlice)}
        interpretation={{
          main_intent: "",
          subtask_candidates: [],
          why_this_case_is_useful: "",
          ambiguity_level: "",
          difficulty_level: "",
          notes: "",
          llm_errors_detected: [],
        }}
        artifacts={[]}
        taskCandidateIds={[]}
        status="draft"
        reviewStatus="pending"
        projectionStatus="not_started"
        conversationSlice={conversationSlice}
        surroundingContext={[]}
        sourceMetadataJson={{
          project_id: projectId,
          session_id: sessionId,
          ...(session.curationNotes?.trim()
            ? { session_notes: session.curationNotes.trim() }
            : {}),
          selected_turn_ids: session.messages.map((message) => message.id),
          selected_range: {
            start_order_index: start,
            end_order_index: end,
            turn_count: session.messages.length,
          },
          provenance: {
            source: "session_chat",
            selection_mode: "manual_range",
            conversation_version: 2,
          },
        }}
        selection={{
          startOrderIndex: start,
          endOrderIndex: end,
        }}
        taskSuggestions={taskSuggestions}
        previewTaskSpec={null}
        projectionPreview={null}
        derivedExamples={[]}
      />
    </div>
  );
}

import type {
  ArtifactType,
  CaseReviewStatus,
  CaseStatus,
  CaseArtifact,
  DerivedExample,
  Prisma,
  ProjectionRelation,
  TaskSpec,
} from "@prisma/client";
import {
  createCase,
  createDerivedExample,
  createProjectionRelation,
  updateCase,
  updateDerivedExampleReviewStatus,
} from "@/app/actions";
import {
  parseSourceMetadata,
  parseValidationState,
  stringifyJsonValue,
} from "@/lib/cases";
import {
  ARTIFACT_LABELS,
  ARTIFACT_TYPES,
  CASE_REVIEW_STATUSES,
  CASE_STATUSES,
  DERIVED_EXAMPLE_STATUSES,
  GENERATION_MODES,
  RELATION_TYPES,
  type CaseInterpretation,
  type ConversationSliceItem,
  type DerivedExamplePreview,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

type ArtifactEditorItem = Pick<
  CaseArtifact,
  "id" | "type" | "valueJson" | "notes" | "confidence" | "provenanceJson"
>;

type SuggestedTask = Pick<
  TaskSpec,
  "id" | "name" | "slug" | "taskType" | "version"
> & {
  requiredArtifacts: ArtifactType[];
  optionalArtifacts: ArtifactType[];
  missingArtifacts: ArtifactType[];
  compatible: boolean;
};

type DerivedExampleItem = DerivedExample & {
  taskSpec: Pick<TaskSpec, "id" | "name" | "slug" | "version" | "taskType">;
  outgoingRelations: Array<
    ProjectionRelation & {
      toDerivedExample: Pick<DerivedExample, "id" | "title">;
    }
  >;
  incomingRelations: Array<
    ProjectionRelation & {
      fromDerivedExample: Pick<DerivedExample, "id" | "title">;
    }
  >;
};

type CaseEditorFormProps = {
  mode: "create" | "edit";
  projectId: string;
  projectName: string;
  sessionId: string;
  sessionTitle: string;
  caseId?: string;
  title: string;
  sourceSummary: string;
  lastUserMessage: string;
  interpretation: CaseInterpretation;
  artifacts: ArtifactEditorItem[];
  taskCandidateIds: string[];
  status: CaseStatus;
  reviewStatus: CaseReviewStatus;
  projectionStatus: string;
  conversationSlice: ConversationSliceItem[];
  surroundingContext: ConversationSliceItem[];
  sourceMetadataJson: Prisma.JsonValue;
  selection?: {
    startOrderIndex: number;
    endOrderIndex: number;
  };
  taskSuggestions: SuggestedTask[];
  previewTaskSpec?: Pick<TaskSpec, "id" | "name" | "slug" | "version" | "taskType"> | null;
  projectionPreview?: DerivedExamplePreview | null;
  derivedExamples?: DerivedExampleItem[];
};

function artifactByType(
  artifacts: ArtifactEditorItem[],
  type: ArtifactType,
) {
  return artifacts.find((artifact) => artifact.type === type);
}

function ProjectionMessages({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "warning" | "error";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={
        tone === "error"
          ? "rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          : "rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      }
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

export function CaseEditorForm({
  mode,
  projectId,
  projectName,
  sessionId,
  sessionTitle,
  caseId,
  title,
  sourceSummary,
  lastUserMessage,
  interpretation,
  artifacts,
  taskCandidateIds,
  status,
  reviewStatus,
  projectionStatus,
  conversationSlice,
  surroundingContext,
  sourceMetadataJson,
  selection,
  taskSuggestions,
  previewTaskSpec,
  projectionPreview,
  derivedExamples = [],
}: CaseEditorFormProps) {
  const sourceMetadata = parseSourceMetadata(sourceMetadataJson);
  const caseAction =
    mode === "create"
      ? createCase.bind(null, projectId, sessionId)
      : updateCase.bind(null, caseId ?? "");
  const derivedExampleAction = createDerivedExample.bind(null, caseId ?? "");
  const relationAction = createProjectionRelation.bind(null, caseId ?? "");
  const previewInputJson = projectionPreview
    ? JSON.stringify(projectionPreview.inputPayload, null, 2)
    : "{}";
  const previewOutputJson = projectionPreview
    ? JSON.stringify(projectionPreview.outputPayload, null, 2)
    : "{}";

  return (
    <div className="space-y-6">
      <form action={caseAction} className="space-y-6">
        {selection ? (
          <>
            <input type="hidden" name="startOrderIndex" value={selection.startOrderIndex} />
            <input type="hidden" name="endOrderIndex" value={selection.endOrderIndex} />
          </>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">1. Source fragment</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Exact selected turns, nearby context, and source provenance.
                </p>
              </div>
              <StatusBadge status={projectionStatus} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Project
                </p>
                <p className="mt-2 text-sm font-semibold">{projectName}</p>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Session
                </p>
                <p className="mt-2 text-sm font-semibold">{sessionTitle}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted)]">
              Range {sourceMetadata.selected_range.start_order_index + 1} to {sourceMetadata.selected_range.end_order_index + 1} • {sourceMetadata.selected_range.turn_count} turn(s)
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium">Case title</span>
              <input className="field" name="title" defaultValue={title} placeholder="Retrieval request with explicit constraints" />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium">Source summary</span>
              <textarea className="field min-h-24" name="sourceSummary" defaultValue={sourceSummary} placeholder="What happens in this slice and why it matters as source material." />
            </label>

            <div className="mt-5 space-y-3">
              {conversationSlice.map((message) => (
                <div key={message.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {message.role} • Turn {message.orderIndex + 1}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.text}</p>
                </div>
              ))}
            </div>

            {surroundingContext.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-medium">Surrounding context</p>
                <div className="mt-3 space-y-3">
                  {surroundingContext.map((message) => (
                    <div key={message.id} className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/55 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {message.role} • Turn {message.orderIndex + 1}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {message.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">2. Human interpretation</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Human judgment stays central. Capture the fragment meaning before projection.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Main intent</span>
                <input className="field" name="mainIntent" defaultValue={interpretation.main_intent} placeholder="User needs retrieval-backed product guidance" />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Last user message</span>
                <textarea className="field min-h-24" name="lastUserMessage" defaultValue={lastUserMessage} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Subtask candidates</span>
                <textarea className="field min-h-24" name="subtaskCandidates" defaultValue={interpretation.subtask_candidates.join("\n")} placeholder="write_query&#10;routing&#10;tool_selection" />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Why this case is useful</span>
                <textarea className="field min-h-28" name="whyThisCaseIsUseful" defaultValue={interpretation.why_this_case_is_useful} placeholder="Good example of retrieval need plus explicit sensitivity constraints." />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Ambiguity level</span>
                  <input className="field" name="ambiguityLevel" defaultValue={interpretation.ambiguity_level} placeholder="low | medium | high" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Difficulty level</span>
                  <input className="field" name="difficultyLevel" defaultValue={interpretation.difficulty_level} placeholder="low | medium | high" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">LLM errors detected</span>
                <textarea className="field min-h-24" name="llmErrorsDetected" defaultValue={interpretation.llm_errors_detected.join("\n")} placeholder="Over-confident answer&#10;Skipped retrieval" />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Notes</span>
                <textarea className="field min-h-28" name="interpretationNotes" defaultValue={interpretation.notes} />
              </label>
            </div>
          </section>

          <section className="surface rounded-[1.75rem] p-5 sm:p-6 xl:col-span-2">
            <div>
              <h2 className="text-lg font-semibold">3. Artifacts</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Typed reusable artifacts extracted from the source case.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {ARTIFACT_TYPES.map((artifactType) => {
                const artifact = artifactByType(artifacts, artifactType);

                return (
                  <article key={artifactType} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                    <p className="text-sm font-semibold">{ARTIFACT_LABELS[artifactType]}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      {artifactType}
                    </p>

                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-medium">Value</span>
                      <textarea
                        className="field min-h-28"
                        name={`${artifactType}__value`}
                        defaultValue={stringifyJsonValue(artifact?.valueJson)}
                        placeholder="Plain text or JSON"
                      />
                    </label>

                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-medium">Notes</span>
                      <textarea
                        className="field min-h-20"
                        name={`${artifactType}__notes`}
                        defaultValue={artifact?.notes ?? ""}
                      />
                    </label>

                    <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium">Confidence</span>
                        <input
                          className="field"
                          name={`${artifactType}__confidence`}
                          defaultValue={artifact?.confidence ?? ""}
                          placeholder="0.0 - 1.0"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium">Provenance</span>
                        <textarea
                          className="field min-h-20"
                          name={`${artifactType}__provenance`}
                          defaultValue={stringifyJsonValue(artifact?.provenanceJson)}
                          placeholder="Optional JSON provenance"
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="surface rounded-[1.75rem] p-5 sm:p-6 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">4. Task projections</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Suggest compatible tasks, show missing artifacts, and prepare projections for review.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge status={status} />
                <StatusBadge status={reviewStatus} />
              </div>
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                {taskSuggestions.map((task) => {
                  const isSelected = taskCandidateIds.includes(task.id);

                  return (
                    <article key={task.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-base font-semibold">{task.name}</p>
                            <StatusBadge status={task.compatible ? "approved" : "pending"} />
                          </div>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {task.slug} • v{task.version} • {task.taskType}
                          </p>
                        </div>

                        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            name="taskCandidateIds"
                            value={task.id}
                            defaultChecked={isSelected}
                          />
                          Candidate task
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                        {task.requiredArtifacts.map((artifactType) => (
                          <span key={`${task.id}-${artifactType}`} className="rounded-full border border-[var(--line)] px-3 py-1">
                            required: {artifactType}
                          </span>
                        ))}
                      </div>

                      {task.missingArtifacts.length > 0 ? (
                        <p className="mt-4 text-sm text-amber-800">
                          Missing artifacts: {task.missingArtifacts.join(", ")}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-emerald-700">
                          Ready to preview.
                        </p>
                      )}

                      {mode === "edit" && caseId ? (
                        <a href={`/cases/${caseId}?taskSpecId=${task.id}`} className="button-secondary mt-4 inline-flex">
                          Preview projection
                        </a>
                      ) : (
                        <p className="mt-4 text-sm text-[var(--muted)]">
                          Save the case first to preview derived examples.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <h3 className="text-base font-semibold">Workflow</h3>
                <div className="mt-4 space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Case status</span>
                    <select className="field" name="status" defaultValue={status}>
                      {CASE_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Review status</span>
                    <select className="field" name="reviewStatus" defaultValue={reviewStatus}>
                      {CASE_REVIEW_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <input type="hidden" name="updatedBy" value="human" />

                  <button type="submit" className="button-primary w-full">
                    {mode === "create" ? "Save V2 case" : "Update V2 case"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </form>

      {mode === "edit" && caseId ? (
        <section className="surface rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Projection preview and derived examples</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Preview a task-specific example, edit the JSON payloads, and save only after human review.
              </p>
            </div>

            <div className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm text-[var(--muted)]">
              {derivedExamples.length} derived example(s)
            </div>
          </div>

          {previewTaskSpec && projectionPreview ? (
            <form action={derivedExampleAction} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold">{previewTaskSpec.name}</h3>
                    <StatusBadge status={previewTaskSpec.taskType} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {previewTaskSpec.slug} • v{previewTaskSpec.version}
                  </p>
                </div>

                <ProjectionMessages title="Structural validation" items={projectionPreview.structuralErrors} tone="error" />
                <ProjectionMessages title="Semantic warnings" items={projectionPreview.semanticWarnings} tone="warning" />

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Derived example title</span>
                  <input className="field" name="title" placeholder="Routing decision for retrieval request" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Input payload</span>
                  <textarea className="field min-h-72 font-mono text-sm" name="inputPayloadJson" defaultValue={previewInputJson} />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Output payload</span>
                  <textarea className="field min-h-56 font-mono text-sm" name="outputPayloadJson" defaultValue={previewOutputJson} />
                </label>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <input type="hidden" name="taskSpecId" value={previewTaskSpec.id} />
                <input type="hidden" name="usedArtifactsJson" value={projectionPreview.usedArtifacts.join(",")} />
                <input type="hidden" name="updatedBy" value="human" />

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Generation mode</span>
                  <select className="field" name="generationMode" defaultValue={GENERATION_MODES[1]}>
                    {GENERATION_MODES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Review status</span>
                  <select className="field" name="reviewStatus" defaultValue={DERIVED_EXAMPLE_STATUSES[1]}>
                    {DERIVED_EXAMPLE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Relate to existing example</span>
                  <select className="field" name="relatedDerivedExampleId" defaultValue="">
                    <option value="">No relation</option>
                    {derivedExamples.map((derivedExample) => (
                      <option key={derivedExample.id} value={derivedExample.id}>
                        {derivedExample.title || derivedExample.taskSpec.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Relation type</span>
                  <select className="field" name="relationType" defaultValue={RELATION_TYPES[0]}>
                    {RELATION_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Relation notes</span>
                  <textarea className="field min-h-24" name="relationNotes" />
                </label>

                {projectionPreview.missingArtifacts.length > 0 ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Missing artifacts: {projectionPreview.missingArtifacts.join(", ")}
                  </div>
                ) : null}

                <button type="submit" className="button-primary w-full">
                  Save derived example
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
              Select a task from the projection panel to generate a preview.
            </div>
          )}

          <div className="mt-8 space-y-4">
            {derivedExamples.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
                This case does not have derived examples yet.
              </div>
            ) : null}

            {derivedExamples.map((derivedExample) => {
              const validationState = parseValidationState(derivedExample.validationStateJson);

              return (
                <article key={derivedExample.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold">
                          {derivedExample.title || derivedExample.taskSpec.name}
                        </h3>
                        <StatusBadge status={derivedExample.reviewStatus} />
                        <StatusBadge status={derivedExample.generationMode} />
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {derivedExample.taskSpec.slug} • v{derivedExample.taskSpec.version} • Updated {formatDate(derivedExample.updatedAt)}
                      </p>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/65 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                            Input payload
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
                            {JSON.stringify(derivedExample.inputPayloadJson, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/65 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                            Output payload
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
                            {JSON.stringify(derivedExample.outputPayloadJson, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {validationState.structuralErrors.length > 0 ? (
                        <ProjectionMessages title="Structural issues" items={validationState.structuralErrors} tone="error" />
                      ) : null}
                      {validationState.semanticWarnings.length > 0 ? (
                        <ProjectionMessages title="Semantic warnings" items={validationState.semanticWarnings} tone="warning" />
                      ) : null}

                      <div className="mt-4 rounded-[1.25rem] border border-[var(--line)] bg-white/65 p-4 text-sm text-[var(--muted)]">
                        Provenance keeps the source case, session, selected turns, artifacts used, generation mode, and task-spec version inside exported metadata.
                      </div>

                      {derivedExample.outgoingRelations.length > 0 || derivedExample.incomingRelations.length > 0 ? (
                        <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                          {derivedExample.outgoingRelations.map((relation) => (
                            <p key={relation.id}>
                              {relation.relationType} → {relation.toDerivedExample.title || relation.toDerivedExample.id}
                            </p>
                          ))}
                          {derivedExample.incomingRelations.map((relation) => (
                            <p key={relation.id}>
                              {relation.fromDerivedExample.title || relation.fromDerivedExample.id} → {relation.relationType}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <form action={updateDerivedExampleReviewStatus.bind(null, derivedExample.id)} className="w-full max-w-xs rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium">Review status</span>
                        <select className="field" name="reviewStatus" defaultValue={derivedExample.reviewStatus}>
                          {DERIVED_EXAMPLE_STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="button-secondary mt-3 w-full">
                        Save status
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>

          {derivedExamples.length >= 2 ? (
            <form action={relationAction} className="mt-8 grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-5 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="block space-y-2">
                <span className="text-sm font-medium">From derived example</span>
                <select className="field" name="fromDerivedExampleId" defaultValue={derivedExamples[0]?.id}>
                  {derivedExamples.map((derivedExample) => (
                    <option key={derivedExample.id} value={derivedExample.id}>
                      {derivedExample.title || derivedExample.taskSpec.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Relation</span>
                <select className="field" name="relationType" defaultValue={RELATION_TYPES[0]}>
                  {RELATION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">To derived example</span>
                <select className="field" name="toDerivedExampleId" defaultValue={derivedExamples[1]?.id}>
                  {derivedExamples.map((derivedExample) => (
                    <option key={derivedExample.id} value={derivedExample.id}>
                      {derivedExample.title || derivedExample.taskSpec.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 lg:col-span-3">
                <span className="text-sm font-medium">Notes</span>
                <textarea className="field min-h-20" name="notes" placeholder="Optional reasoning for this task relation." />
              </label>

              <button type="submit" className="button-secondary lg:col-span-3">
                Create relation
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
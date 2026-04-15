"use client";

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
import { useActionState, useState } from "react";
import {
  createCaseWithFeedback,
  createDerivedExampleWithFeedback,
  createProjectionRelationWithFeedback,
  updateCaseWithFeedback,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { DerivedExampleReviewForm } from "@/components/derived-example-review-form";
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
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { cn, formatDate } from "@/lib/utils";
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

const PIPELINE_STEPS = [
  {
    id: "source",
    label: "Source",
    title: "Source fragment",
    description: "Selected turns, nearby context, and provenance.",
  },
  {
    id: "interpretation",
    label: "Interpretation",
    title: "Human interpretation",
    description: "Curator judgment before any projection work.",
  },
  {
    id: "artifacts",
    label: "Artifacts",
    title: "Artifacts",
    description: "Typed reusable data extracted from the case.",
  },
  {
    id: "projections",
    label: "Projections",
    title: "Task projections",
    description: "Candidate tasks, readiness, and review controls.",
  },
] as const;

type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

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

function StepPanelHeader({
  stepNumber,
  title,
  description,
  extra,
}: {
  stepNumber: number;
  title: string;
  description: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
          Step {stepNumber}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          {description}
        </p>
      </div>
      {extra}
    </div>
  );
}

function PipelinePager({
  currentStep,
  onStepChange,
}: {
  currentStep: PipelineStepId;
  onStepChange: (step: PipelineStepId) => void;
}) {
  const currentIndex = PIPELINE_STEPS.findIndex((step) => step.id === currentStep);
  const previousStep = currentIndex > 0 ? PIPELINE_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < PIPELINE_STEPS.length - 1 ? PIPELINE_STEPS[currentIndex + 1] : null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
      <div className="text-sm text-[var(--muted)]">
        {currentIndex + 1} of {PIPELINE_STEPS.length} pipeline stages
      </div>

      <div className="flex flex-wrap gap-3">
        {previousStep ? (
          <button
            type="button"
            className="button-secondary"
            onClick={() => onStepChange(previousStep.id)}
          >
            Back to {previousStep.label}
          </button>
        ) : (
          <div />
        )}

        {nextStep ? (
          <button
            type="button"
            className="button-primary"
            onClick={() => onStepChange(nextStep.id)}
          >
            Continue to {nextStep.label}
          </button>
        ) : (
          <button
            type="button"
            className="button-primary"
            onClick={() => onStepChange("projections")}
          >
            Review final step
          </button>
        )}
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
      ? createCaseWithFeedback.bind(null, projectId, sessionId)
      : updateCaseWithFeedback.bind(null, caseId ?? "");
  const derivedExampleAction = createDerivedExampleWithFeedback.bind(null, caseId ?? "");
  const relationAction = createProjectionRelationWithFeedback.bind(null, caseId ?? "");
  const previewInputJson = projectionPreview
    ? JSON.stringify(projectionPreview.inputPayload, null, 2)
    : "{}";
  const previewOutputJson = projectionPreview
    ? JSON.stringify(projectionPreview.outputPayload, null, 2)
    : "{}";
  const [caseState, caseFormAction] = useActionState(caseAction, EMPTY_ACTION_FORM_STATE);
  const [derivedExampleState, derivedExampleFormAction] = useActionState(
    derivedExampleAction,
    EMPTY_ACTION_FORM_STATE,
  );
  const [relationState, relationFormAction] = useActionState(
    relationAction,
    EMPTY_ACTION_FORM_STATE,
  );
  const [activeStep, setActiveStep] = useState<PipelineStepId>(
    previewTaskSpec ? "projections" : "source",
  );
  const readyTaskCount = taskSuggestions.filter((task) => task.compatible).length;
  const interpretationSignalCount =
    interpretation.subtask_candidates.length + interpretation.llm_errors_detected.length;
  const stepMeta = {
    source: `${conversationSlice.length} selected turn(s)`,
    interpretation:
      interpretationSignalCount > 0
        ? `${interpretationSignalCount} labels and flags`
        : "Human reading pending",
    artifacts:
      artifacts.length > 0 ? `${artifacts.length} captured artifact(s)` : "No artifacts yet",
    projections: `${readyTaskCount} ready projection(s)`,
  } satisfies Record<PipelineStepId, string>;
  const activeStepConfig = PIPELINE_STEPS.find((step) => step.id === activeStep) ?? PIPELINE_STEPS[0];

  useActionFeedbackToast(caseState, {
    errorTitle: mode === "create" ? "No fue posible crear el caso" : "No fue posible actualizar el caso",
    successTitle: mode === "create" ? "Caso creado" : "Caso actualizado",
  });
  useActionFeedbackToast(derivedExampleState, {
    errorTitle: "No fue posible guardar el derived example",
    successTitle: "Derived example guardado",
  });
  useActionFeedbackToast(relationState, {
    errorTitle: "No fue posible crear la relación",
    successTitle: "Relación creada",
  });

  return (
    <div className="space-y-6">
      <form action={caseFormAction} className="space-y-6">
        {selection ? (
          <>
            <input type="hidden" name="startOrderIndex" value={selection.startOrderIndex} />
            <input type="hidden" name="endOrderIndex" value={selection.endOrderIndex} />
          </>
        ) : null}

        <section className="surface rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                Editor V2 pipeline
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Move through the case as a sequence of review stages, not one giant form.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                Each tab keeps the same form alive underneath. You can switch stages without losing unsaved edits.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--muted)]">
                {conversationSlice.length} selected turns
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--muted)]">
                {artifacts.length} artifacts
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--muted)]">
                {readyTaskCount} ready tasks
              </span>
            </div>
          </div>

          <div
            className="mt-6 flex gap-3 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Case pipeline steps"
          >
            {PIPELINE_STEPS.map((step, index) => {
              const isActive = step.id === activeStep;

              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  id={`case-step-tab-${step.id}`}
                  aria-selected={isActive}
                  aria-controls={`case-step-panel-${step.id}`}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "min-w-[220px] rounded-[1.5rem] border px-4 py-4 text-left transition duration-150",
                    isActive
                      ? "border-transparent bg-[var(--accent)] text-white shadow-[0_18px_40px_rgba(18,79,75,0.22)]"
                      : "border-[var(--line)] bg-white/70 text-[var(--foreground)] hover:-translate-y-0.5 hover:bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                        isActive
                          ? "bg-white/18 text-white"
                          : "bg-[rgba(27,111,106,0.1)] text-[var(--accent-strong)]",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-xs uppercase tracking-[0.18em]",
                        isActive ? "text-white/72" : "text-[var(--muted)]",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>

                  <p className="mt-4 text-base font-semibold">{step.title}</p>
                  <p
                    className={cn(
                      "mt-2 text-sm leading-6",
                      isActive ? "text-white/82" : "text-[var(--muted)]",
                    )}
                  >
                    {stepMeta[step.id]}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section
              id="case-step-panel-source"
              role="tabpanel"
              aria-labelledby="case-step-tab-source"
              aria-hidden={activeStep !== "source"}
              className={cn(
                "surface rounded-[1.75rem] p-5 sm:p-6",
                activeStep !== "source" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={1}
                title="Source fragment"
                description="Exact selected turns, nearby context, and source provenance. This is the evidentiary layer for the rest of the case."
                extra={<StatusBadge status={projectionStatus} />}
              />

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

              <PipelinePager currentStep="source" onStepChange={setActiveStep} />
            </section>

            <section
              id="case-step-panel-interpretation"
              role="tabpanel"
              aria-labelledby="case-step-tab-interpretation"
              aria-hidden={activeStep !== "interpretation"}
              className={cn(
                "surface rounded-[1.75rem] p-5 sm:p-6",
                activeStep !== "interpretation" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={2}
                title="Human interpretation"
                description="Human judgment stays central. Capture the fragment meaning and its training value before projection."
              />

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

              <PipelinePager currentStep="interpretation" onStepChange={setActiveStep} />
            </section>

            <section
              id="case-step-panel-artifacts"
              role="tabpanel"
              aria-labelledby="case-step-tab-artifacts"
              aria-hidden={activeStep !== "artifacts"}
              className={cn(
                "surface rounded-[1.75rem] p-5 sm:p-6",
                activeStep !== "artifacts" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={3}
                title="Artifacts"
                description="Typed reusable artifacts extracted from the source case. Fill only what is genuinely recoverable from the evidence."
              />

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

              <PipelinePager currentStep="artifacts" onStepChange={setActiveStep} />
            </section>

            <section
              id="case-step-panel-projections"
              role="tabpanel"
              aria-labelledby="case-step-tab-projections"
              aria-hidden={activeStep !== "projections"}
              className={cn(
                "surface rounded-[1.75rem] p-5 sm:p-6",
                activeStep !== "projections" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={4}
                title="Task projections"
                description="Suggest compatible tasks, surface missing artifacts, and prepare this case for downstream review."
                extra={
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={status} />
                    <StatusBadge status={reviewStatus} />
                  </div>
                }
              />

              <div className="mt-5 space-y-4">
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

              <PipelinePager currentStep="projections" onStepChange={setActiveStep} />
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
            <section className="surface rounded-[1.75rem] p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                Current stage
              </p>
              <h3 className="mt-3 text-xl font-semibold">{activeStepConfig.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {activeStepConfig.description}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Source scope
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{conversationSlice.length}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Selected turns</p>
                </div>

                <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Artifact coverage
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{artifacts.length}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Captured artifacts</p>
                </div>

                <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Task readiness
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{readyTaskCount}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Ready projections</p>
                </div>

                <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Derived examples
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{derivedExamples.length}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Saved outputs</p>
                </div>
              </div>
            </section>

            <section className="surface rounded-[1.75rem] p-5 sm:p-6">
              <h3 className="text-base font-semibold">Workflow</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                Keep statuses and save controls visible while moving across the pipeline.
              </p>

              <div className="mt-5 space-y-4">
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

                {previewTaskSpec ? (
                  <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Previewing projection for {previewTaskSpec.name}.
                  </div>
                ) : mode === "edit" ? (
                  <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted)]">
                    Open step 4 and choose a compatible task to preview a derived example.
                  </div>
                ) : null}

                <input type="hidden" name="updatedBy" value="human" />

                <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel={mode === "create" ? "Saving case..." : "Updating case..."}>
                  {mode === "create" ? "Save V2 case" : "Update V2 case"}
                </FormSubmitButton>
              </div>
            </section>
          </aside>
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
            <form action={derivedExampleFormAction} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                  <FormLabel>Derived example title</FormLabel>
                  <input className="field" name="title" placeholder="Routing decision for retrieval request" />
                </label>

                <label className="block space-y-2">
                  <FormLabel required>Input payload</FormLabel>
                  <textarea className="field min-h-72 font-mono text-sm" name="inputPayloadJson" defaultValue={previewInputJson} required />
                </label>

                <label className="block space-y-2">
                  <FormLabel required>Output payload</FormLabel>
                  <textarea className="field min-h-56 font-mono text-sm" name="outputPayloadJson" defaultValue={previewOutputJson} required />
                </label>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <input type="hidden" name="taskSpecId" value={previewTaskSpec.id} />
                <input type="hidden" name="usedArtifactsJson" value={projectionPreview.usedArtifacts.join(",")} />
                <input type="hidden" name="updatedBy" value="human" />

                <label className="block space-y-2">
                  <FormLabel>Generation mode</FormLabel>
                  <select className="field" name="generationMode" defaultValue={GENERATION_MODES[1]}>
                    {GENERATION_MODES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <FormLabel>Review status</FormLabel>
                  <select className="field" name="reviewStatus" defaultValue={DERIVED_EXAMPLE_STATUSES[1]}>
                    {DERIVED_EXAMPLE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <FormLabel>Relate to existing example</FormLabel>
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
                  <FormLabel>Relation type</FormLabel>
                  <select className="field" name="relationType" defaultValue={RELATION_TYPES[0]}>
                    {RELATION_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <FormLabel>Relation notes</FormLabel>
                  <textarea className="field min-h-24" name="relationNotes" />
                </label>

                {projectionPreview.missingArtifacts.length > 0 ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Missing artifacts: {projectionPreview.missingArtifacts.join(", ")}
                  </div>
                ) : null}

                <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Saving derived example...">
                  Save derived example
                </FormSubmitButton>
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

                    <DerivedExampleReviewForm
                      derivedExampleId={derivedExample.id}
                      reviewStatus={derivedExample.reviewStatus}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          {derivedExamples.length >= 2 ? (
            <form action={relationFormAction} className="mt-8 grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-5 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="block space-y-2">
                <FormLabel required>From derived example</FormLabel>
                <select className="field" name="fromDerivedExampleId" defaultValue={derivedExamples[0]?.id} required>
                  {derivedExamples.map((derivedExample) => (
                    <option key={derivedExample.id} value={derivedExample.id}>
                      {derivedExample.title || derivedExample.taskSpec.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <FormLabel required>Relation</FormLabel>
                <select className="field" name="relationType" defaultValue={RELATION_TYPES[0]} required>
                  {RELATION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <FormLabel required>To derived example</FormLabel>
                <select className="field" name="toDerivedExampleId" defaultValue={derivedExamples[1]?.id} required>
                  {derivedExamples.map((derivedExample) => (
                    <option key={derivedExample.id} value={derivedExample.id}>
                      {derivedExample.title || derivedExample.taskSpec.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 lg:col-span-3">
                <FormLabel>Notes</FormLabel>
                <textarea className="field min-h-20" name="notes" placeholder="Optional reasoning for this task relation." />
              </label>

              <FormSubmitButton type="submit" className="button-secondary lg:col-span-3" pendingLabel="Creating relation...">
                Create relation
              </FormSubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
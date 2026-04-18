"use client";

import Link from "next/link";
import type {
  ArtifactType,
  CaseArtifact,
  CaseReviewStatus,
  CaseStatus,
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
import { DerivedExampleReviewForm } from "@/components/derived-example-review-form";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/status-badge";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import {
  parseSourceMetadata,
  parseValidationState,
  stringifyJsonValue,
} from "@/lib/cases";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
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
import { cn, formatDate } from "@/lib/utils";

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
    description: "Only active or needed artifacts stay in the workspace.",
  },
  {
    id: "projections",
    label: "Tasks",
    title: "Task projections",
    description: "Only selected tasks stay in the pipeline.",
  },
] as const;

const TASK_PANEL_VIEWS = [
  { id: "selected", label: "Seleccionadas" },
  { id: "compatible", label: "Compatibles" },
  { id: "all", label: "Todas" },
] as const;

const ARTIFACT_PANEL_VIEWS = [
  { id: "active", label: "Activos" },
  { id: "required", label: "Requeridos" },
  { id: "all", label: "Todos" },
] as const;

type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];
type TaskPanelView = (typeof TASK_PANEL_VIEWS)[number]["id"];
type ArtifactPanelView = (typeof ARTIFACT_PANEL_VIEWS)[number]["id"];

type ArtifactDraftState = {
  value: string;
  notes: string;
  confidence: string;
  provenance: string;
  hasValue: boolean;
};

function artifactByType(artifacts: ArtifactEditorItem[], type: ArtifactType) {
  return artifacts.find((artifact) => artifact.type === type);
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildArtifactDrafts(artifacts: ArtifactEditorItem[]) {
  return ARTIFACT_TYPES.reduce<Record<ArtifactType, ArtifactDraftState>>((accumulator, artifactType) => {
    const artifact = artifactByType(artifacts, artifactType);
    const value = stringifyJsonValue(artifact?.valueJson);

    accumulator[artifactType] = {
      value,
      notes: artifact?.notes ?? "",
      confidence:
        typeof artifact?.confidence === "number" && Number.isFinite(artifact.confidence)
          ? String(artifact.confidence)
          : "",
      provenance: stringifyJsonValue(artifact?.provenanceJson),
      hasValue: value.trim().length > 0,
    };

    return accumulator;
  }, {} as Record<ArtifactType, ArtifactDraftState>);
}

function buildInitialVisibleArtifacts(
  taskIds: string[],
  taskSuggestions: SuggestedTask[],
  drafts: Record<ArtifactType, ArtifactDraftState>,
  previewTaskId?: string | null,
) {
  const requiredFromTasks = taskSuggestions
    .filter((task) => taskIds.includes(task.id) || task.id === previewTaskId)
    .flatMap((task) => task.requiredArtifacts);
  const capturedArtifacts = ARTIFACT_TYPES.filter((artifactType) => drafts[artifactType].hasValue);

  return uniq([...capturedArtifacts, ...requiredFromTasks]);
}

function sortTasks(tasks: SuggestedTask[], selectedTaskIds: string[], previewTaskId?: string | null) {
  return [...tasks].sort((left, right) => {
    const leftSelected = selectedTaskIds.includes(left.id) || left.id === previewTaskId;
    const rightSelected = selectedTaskIds.includes(right.id) || right.id === previewTaskId;

    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    if (left.compatible !== right.compatible) {
      return left.compatible ? -1 : 1;
    }

    if (left.missingArtifacts.length !== right.missingArtifacts.length) {
      return left.missingArtifacts.length - right.missingArtifacts.length;
    }

    return left.name.localeCompare(right.name);
  });
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
          ? "rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          : "rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      }
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-sm text-[var(--muted)]">
      <span className="font-semibold text-[var(--foreground)]">{value}</span> {label}
    </div>
  );
}

function CompactBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning";
}) {
  const toneClass = {
    neutral: "border-[var(--line)] bg-white text-[var(--muted)]",
    accent: "border-[rgba(15,95,92,0.18)] bg-[rgba(15,95,92,0.08)] text-[var(--accent-strong)]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium", toneClass)}>
      {label}
    </span>
  );
}

function StepPanelHeader({
  stepNumber,
  title,
  description,
  metrics,
  action,
}: {
  stepNumber: number;
  title: string;
  description: string;
  metrics?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Step {stepNumber}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {metrics}
        {action}
      </div>
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
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
      <p className="text-sm text-[var(--muted)]">
        {currentIndex + 1} de {PIPELINE_STEPS.length} etapas
      </p>

      <div className="flex flex-wrap gap-2">
        {previousStep ? (
          <button
            type="button"
            className="button-secondary"
            onClick={() => onStepChange(previousStep.id)}
          >
            {previousStep.label}
          </button>
        ) : null}

        {nextStep ? (
          <button
            type="button"
            className="button-primary"
            onClick={() => onStepChange(nextStep.id)}
          >
            {nextStep.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DrawerTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition",
            value === option.id
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ManagementDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-[rgba(17,24,39,0.34)] backdrop-blur-[1px]">
      <button type="button" aria-label="Cerrar panel" className="flex-1" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[min(720px,100vw)] flex-col border-l border-[var(--line)] bg-[rgba(248,246,241,0.98)] shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Administración
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>

          <button type="button" className="button-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

function EmptyWorkspaceState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/55 px-4 py-6 text-sm text-[var(--muted)]">
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 leading-6">{description}</p>
      <button type="button" className="button-secondary mt-4" onClick={onAction}>
        {actionLabel}
      </button>
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
  const initialArtifactDrafts = buildArtifactDrafts(artifacts);

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
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(taskCandidateIds);
  const [artifactDrafts, setArtifactDrafts] = useState<Record<ArtifactType, ArtifactDraftState>>(
    initialArtifactDrafts,
  );
  const [workspaceArtifactTypes, setWorkspaceArtifactTypes] = useState<ArtifactType[]>(() =>
    buildInitialVisibleArtifacts(taskCandidateIds, taskSuggestions, initialArtifactDrafts, previewTaskSpec?.id),
  );
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>(() =>
    uniq([...(previewTaskSpec ? [previewTaskSpec.id] : []), ...taskCandidateIds]).slice(0, 4),
  );
  const [expandedArtifactTypes, setExpandedArtifactTypes] = useState<ArtifactType[]>(() =>
    buildInitialVisibleArtifacts(taskCandidateIds, taskSuggestions, initialArtifactDrafts, previewTaskSpec?.id).slice(0, 4),
  );
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [taskPanelView, setTaskPanelView] = useState<TaskPanelView>("selected");
  const [artifactPanelView, setArtifactPanelView] = useState<ArtifactPanelView>("active");
  const [taskSearch, setTaskSearch] = useState("");
  const [artifactSearch, setArtifactSearch] = useState("");

  const selectedTaskSet = new Set(selectedTaskIds);
  const workspaceArtifactSet = new Set(workspaceArtifactTypes);
  const artifactTypesWithValue = new Set(
    ARTIFACT_TYPES.filter((artifactType) => artifactDrafts[artifactType].hasValue),
  );
  const computedTaskSuggestions = sortTasks(
    taskSuggestions.map((task) => {
      const missingArtifacts = task.requiredArtifacts.filter(
        (artifactType) => !artifactTypesWithValue.has(artifactType),
      );

      return {
        ...task,
        missingArtifacts,
        compatible: missingArtifacts.length === 0,
      };
    }),
    selectedTaskIds,
    previewTaskSpec?.id,
  );
  const previewTask =
    computedTaskSuggestions.find((task) => task.id === previewTaskSpec?.id) ?? null;
  const requiredArtifactTypes = uniq(
    computedTaskSuggestions
      .filter((task) => selectedTaskSet.has(task.id) || task.id === previewTask?.id)
      .flatMap((task) => task.requiredArtifacts),
  );
  const derivedExamplesByTaskId = derivedExamples.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.taskSpecId] = (accumulator[item.taskSpecId] ?? 0) + 1;
    return accumulator;
  }, {});

  const readyTaskCount = computedTaskSuggestions.filter((task) => task.compatible).length;
  const selectedReadyTaskCount = computedTaskSuggestions.filter(
    (task) => selectedTaskSet.has(task.id) && task.compatible,
  ).length;
  const selectedTaskSuggestions = computedTaskSuggestions.filter((task) => selectedTaskSet.has(task.id));
  const visibleProjectionTasks = computedTaskSuggestions.filter(
    (task) => selectedTaskSet.has(task.id) || task.id === previewTaskSpec?.id,
  );
  const interpretationSignalCount =
    interpretation.subtask_candidates.length + interpretation.llm_errors_detected.length;
  const stepMeta = {
    source: `${conversationSlice.length} selected turn(s)`,
    interpretation:
      interpretationSignalCount > 0
        ? `${interpretationSignalCount} labels and flags`
        : "Human reading pending",
    artifacts:
      workspaceArtifactTypes.length > 0
        ? `${workspaceArtifactTypes.length} artifact(s) in workspace`
        : "Focused workspace",
    projections:
      selectedTaskSuggestions.length > 0
        ? `${selectedTaskSuggestions.length} selected task(s)`
        : "Select tasks to work on",
  } satisfies Record<PipelineStepId, string>;
  const activeStepConfig = PIPELINE_STEPS.find((step) => step.id === activeStep) ?? PIPELINE_STEPS[0];
  const hiddenArtifactCount = ARTIFACT_TYPES.length - workspaceArtifactTypes.length;
  const taskSearchValue = taskSearch.trim().toLowerCase();
  const artifactSearchValue = artifactSearch.trim().toLowerCase();

  const filteredTasks = computedTaskSuggestions.filter((task) => {
    if (taskPanelView === "selected" && !selectedTaskSet.has(task.id)) {
      return false;
    }

    if (taskPanelView === "compatible" && !task.compatible) {
      return false;
    }

    if (!taskSearchValue) {
      return true;
    }

    return (
      task.name.toLowerCase().includes(taskSearchValue) ||
      task.slug.toLowerCase().includes(taskSearchValue) ||
      task.taskType.toLowerCase().includes(taskSearchValue)
    );
  });

  const filteredArtifactTypes = ARTIFACT_TYPES.filter((artifactType) => {
    const isActive = artifactDrafts[artifactType].hasValue;
    const isRequired = requiredArtifactTypes.includes(artifactType);

    if (artifactPanelView === "active" && !isActive) {
      return false;
    }

    if (artifactPanelView === "required" && !isRequired) {
      return false;
    }

    if (!artifactSearchValue) {
      return true;
    }

    return (
      ARTIFACT_LABELS[artifactType].toLowerCase().includes(artifactSearchValue) ||
      artifactType.toLowerCase().includes(artifactSearchValue)
    );
  });

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

  function toggleTaskSelection(task: SuggestedTask) {
    setSelectedTaskIds((current) => {
      const isSelected = current.includes(task.id);

      if (isSelected) {
        return current.filter((taskId) => taskId !== task.id);
      }

      return uniq([...current, task.id]);
    });
    setExpandedTaskIds((current) => uniq([...current, task.id]));
    setWorkspaceArtifactTypes((current) => uniq([...current, ...task.requiredArtifacts]));
    setExpandedArtifactTypes((current) => uniq([...current, ...task.requiredArtifacts]));
  }

  function toggleArtifactWorkspaceVisibility(artifactType: ArtifactType) {
    setWorkspaceArtifactTypes((current) => {
      if (current.includes(artifactType)) {
        return current.filter((item) => item !== artifactType);
      }

      return [...current, artifactType];
    });
    setExpandedArtifactTypes((current) => uniq([...current, artifactType]));
  }

  function toggleTaskExpansion(taskId: string) {
    setExpandedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((item) => item !== taskId)
        : [...current, taskId],
    );
  }

  function toggleArtifactExpansion(artifactType: ArtifactType) {
    setExpandedArtifactTypes((current) =>
      current.includes(artifactType)
        ? current.filter((item) => item !== artifactType)
        : [...current, artifactType],
    );
  }

  function updateArtifactDraft(
    artifactType: ArtifactType,
    field: keyof Omit<ArtifactDraftState, "hasValue">,
    value: string,
  ) {
    setArtifactDrafts((current) => {
      const nextDraft = {
        ...current[artifactType],
        [field]: value,
      };

      if (field === "value") {
        nextDraft.hasValue = value.trim().length > 0;
      }

      return {
        ...current,
        [artifactType]: nextDraft,
      };
    });
  }

  return (
    <div className="space-y-6">
      <ManagementDrawer
        open={taskPanelOpen}
        title="Administrar tasks"
        description="Descubre, filtra y selecciona qué tasks viven dentro del pipeline. La edición y el preview siguen ocurriendo en el espacio principal del caso."
        onClose={() => setTaskPanelOpen(false)}
      >
        <div className="space-y-4">
          <DrawerTabs value={taskPanelView} options={TASK_PANEL_VIEWS} onChange={setTaskPanelView} />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Buscar task</span>
            <input
              className="field"
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
              placeholder="Nombre, slug o tipo"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <MetricPill label="seleccionadas" value={String(selectedTaskIds.length)} />
            <MetricPill label="compatibles" value={String(readyTaskCount)} />
            <MetricPill label="ocultas" value={String(taskSuggestions.length - selectedTaskIds.length)} />
          </div>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                No hay tasks para ese filtro.
              </div>
            ) : null}

            {filteredTasks.map((task) => {
              const isSelected = selectedTaskSet.has(task.id);

              return (
                <div
                  key={task.id}
                  className="rounded-[1rem] border border-[var(--line)] bg-white/78 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{task.name}</p>
                        {isSelected ? <CompactBadge label="en pipeline" tone="accent" /> : null}
                        {task.compatible ? (
                          <CompactBadge label="lista" tone="success" />
                        ) : (
                          <CompactBadge
                            label={`faltan ${task.missingArtifacts.length}`}
                            tone="warning"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {task.slug} • v{task.version} • {task.taskType}
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Requiere {task.requiredArtifacts.length > 0 ? task.requiredArtifacts.join(", ") : "sin artifacts obligatorios"}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={isSelected ? "button-secondary" : "button-primary"}
                      onClick={() => toggleTaskSelection(task)}
                    >
                      {isSelected ? "Quitar del pipeline" : "Agregar al pipeline"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ManagementDrawer>

      <ManagementDrawer
        open={artifactPanelOpen}
        title="Administrar artifacts"
        description="Decide qué artifacts aparecen en el espacio de trabajo. Aquí solo gestionas visibilidad y foco; la edición detallada sigue dentro del pipeline."
        onClose={() => setArtifactPanelOpen(false)}
      >
        <div className="space-y-4">
          <DrawerTabs
            value={artifactPanelView}
            options={ARTIFACT_PANEL_VIEWS}
            onChange={setArtifactPanelView}
          />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Buscar artifact</span>
            <input
              className="field"
              value={artifactSearch}
              onChange={(event) => setArtifactSearch(event.target.value)}
              placeholder="Nombre o tipo"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <MetricPill label="en workspace" value={String(workspaceArtifactTypes.length)} />
            <MetricPill label="capturados" value={String(artifactTypesWithValue.size)} />
            <MetricPill label="ocultos" value={String(hiddenArtifactCount)} />
          </div>

          <div className="space-y-2">
            {filteredArtifactTypes.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                No hay artifacts para ese filtro.
              </div>
            ) : null}

            {filteredArtifactTypes.map((artifactType) => {
              const isVisible = workspaceArtifactSet.has(artifactType);
              const isActive = artifactDrafts[artifactType].hasValue;
              const isRequired = requiredArtifactTypes.includes(artifactType);

              return (
                <div
                  key={artifactType}
                  className="rounded-[1rem] border border-[var(--line)] bg-white/78 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {ARTIFACT_LABELS[artifactType]}
                        </p>
                        {isVisible ? <CompactBadge label="visible" tone="accent" /> : null}
                        {isActive ? <CompactBadge label="capturado" tone="success" /> : null}
                        {isRequired ? <CompactBadge label="requerido" tone="warning" /> : null}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {artifactType}
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {isRequired
                          ? "Se necesita para al menos una task seleccionada o en preview."
                          : "Disponible para revelar cuando haga falta."}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={isVisible ? "button-secondary" : "button-primary"}
                      onClick={() => toggleArtifactWorkspaceVisibility(artifactType)}
                    >
                      {isVisible ? "Ocultar del workspace" : "Revelar en workspace"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ManagementDrawer>

      <form action={caseFormAction} className="space-y-6">
        {selection ? (
          <>
            <input type="hidden" name="startOrderIndex" value={selection.startOrderIndex} />
            <input type="hidden" name="endOrderIndex" value={selection.endOrderIndex} />
          </>
        ) : null}

        {selectedTaskIds.map((taskId) => (
          <input key={taskId} type="hidden" name="taskCandidateIds" value={taskId} />
        ))}

        <section className="surface rounded-[1.25rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Case pipeline
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Un espacio de trabajo enfocado para curar el caso, no un catálogo abierto.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Tasks y artifacts se administran desde paneles laterales. El pipeline principal muestra solo lo que estás editando o revisando.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <MetricPill label="turnos" value={String(conversationSlice.length)} />
              <MetricPill label="tasks en pipeline" value={String(selectedTaskIds.length)} />
              <MetricPill label="artifacts en workspace" value={String(workspaceArtifactTypes.length)} />
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Case pipeline steps">
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
                    "min-w-fit rounded-full px-4 py-2 text-left text-sm font-medium transition",
                    isActive
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--line)] bg-white/82 text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="mr-2 text-xs uppercase tracking-[0.16em] opacity-70">{index + 1}</span>
                  {step.title}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            <section
              id="case-step-panel-source"
              role="tabpanel"
              aria-labelledby="case-step-tab-source"
              aria-hidden={activeStep !== "source"}
              className={cn(
                "surface rounded-[1.25rem] p-5 sm:p-6",
                activeStep !== "source" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={1}
                title="Source fragment"
                description="Selected turns, adjacent context, and provenance remain together as the evidence layer for the rest of the case."
                metrics={<StatusBadge status={projectionStatus} />}
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-[var(--line)] bg-white/78 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Project
                  </p>
                  <p className="mt-2 text-sm font-semibold">{projectName}</p>
                </div>
                <div className="rounded-[1rem] border border-[var(--line)] bg-white/78 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Session
                  </p>
                  <p className="mt-2 text-sm font-semibold">{sessionTitle}</p>
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-[var(--line)] bg-white/72 px-4 py-3 text-sm text-[var(--muted)]">
                Range {sourceMetadata.selected_range.start_order_index + 1} to {sourceMetadata.selected_range.end_order_index + 1} • {sourceMetadata.selected_range.turn_count} turn(s)
              </div>

              {sourceMetadata.session_notes?.trim() ? (
                <div className="mt-4 rounded-[1rem] border border-[rgba(15,95,92,0.18)] bg-[rgba(15,95,92,0.06)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Session notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">
                    {sourceMetadata.session_notes}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Case title</span>
                  <input
                    className="field"
                    name="title"
                    defaultValue={title}
                    placeholder="Retrieval request with explicit constraints"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Source summary</span>
                  <textarea
                    className="field min-h-24"
                    name="sourceSummary"
                    defaultValue={sourceSummary}
                    placeholder="What happens in this slice and why it matters as source material."
                  />
                </label>
              </div>

              <div className="mt-5 space-y-2.5">
                {conversationSlice.map((message) => (
                  <div key={message.id} className="rounded-[1rem] border border-[var(--line)] bg-white/78 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {message.role} • Turn {message.orderIndex + 1}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                  </div>
                ))}
              </div>

              {surroundingContext.length > 0 ? (
                <div className="mt-5">
                  <p className="text-sm font-medium">Surrounding context</p>
                  <div className="mt-3 space-y-2.5">
                    {surroundingContext.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-[1rem] border border-dashed border-[var(--line)] bg-white/58 px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          {message.role} • Turn {message.orderIndex + 1}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
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
                "surface rounded-[1.25rem] p-5 sm:p-6",
                activeStep !== "interpretation" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={2}
                title="Human interpretation"
                description="Human judgment stays central. Capture intent, ambiguity, and curation rationale before projecting into tasks."
              />

              <div className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Main intent</span>
                  <input
                    className="field"
                    name="mainIntent"
                    defaultValue={interpretation.main_intent}
                    placeholder="User needs retrieval-backed product guidance"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Last user message</span>
                  <textarea className="field min-h-24" name="lastUserMessage" defaultValue={lastUserMessage} />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Subtask candidates</span>
                    <textarea
                      className="field min-h-24"
                      name="subtaskCandidates"
                      defaultValue={interpretation.subtask_candidates.join("\n")}
                      placeholder={"write_query\nrouting\ntool_selection"}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">LLM errors detected</span>
                    <textarea
                      className="field min-h-24"
                      name="llmErrorsDetected"
                      defaultValue={interpretation.llm_errors_detected.join("\n")}
                      placeholder={"Over-confident answer\nSkipped retrieval"}
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Why this case is useful</span>
                  <textarea
                    className="field min-h-28"
                    name="whyThisCaseIsUseful"
                    defaultValue={interpretation.why_this_case_is_useful}
                    placeholder="Good example of retrieval need plus explicit sensitivity constraints."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Ambiguity level</span>
                    <input
                      className="field"
                      name="ambiguityLevel"
                      defaultValue={interpretation.ambiguity_level}
                      placeholder="low | medium | high"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Difficulty level</span>
                    <input
                      className="field"
                      name="difficultyLevel"
                      defaultValue={interpretation.difficulty_level}
                      placeholder="low | medium | high"
                    />
                  </label>
                </div>

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
                "surface rounded-[1.25rem] p-5 sm:p-6",
                activeStep !== "artifacts" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={3}
                title="Artifacts"
                description="The workspace shows only active, required, or manually revealed artifacts. Everything else stays in the management panel until it becomes relevant."
                metrics={
                  <>
                    <MetricPill label="visibles" value={String(workspaceArtifactTypes.length)} />
                    <MetricPill label="requeridos" value={String(requiredArtifactTypes.length)} />
                  </>
                }
                action={
                  <button type="button" className="button-secondary" onClick={() => setArtifactPanelOpen(true)}>
                    Administrar artifacts
                  </button>
                }
              />

              <div className="mt-5 flex flex-wrap gap-2">
                <CompactBadge label={`${artifactTypesWithValue.size} capturados`} tone="success" />
                <CompactBadge label={`${requiredArtifactTypes.length} requeridos por tasks`} tone="warning" />
                <CompactBadge label={`${hiddenArtifactCount} ocultos del workspace`} tone="neutral" />
              </div>

              {workspaceArtifactTypes.length === 0 ? (
                <div className="mt-5">
                  <EmptyWorkspaceState
                    title="No hay artifacts abiertos en el workspace"
                    description="Revela solo los artifacts que necesites capturar o revisar. Los requeridos por tasks seleccionadas pueden abrirse desde el panel de administración."
                    actionLabel="Abrir administrador de artifacts"
                    onAction={() => setArtifactPanelOpen(true)}
                  />
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {ARTIFACT_TYPES.map((artifactType) => {
                  const draft = artifactDrafts[artifactType];
                  const isVisible = workspaceArtifactSet.has(artifactType);
                  const isExpanded = expandedArtifactTypes.includes(artifactType);
                  const isRequired = requiredArtifactTypes.includes(artifactType);

                  return (
                    <article
                      key={artifactType}
                      className={cn(
                        "rounded-[1rem] border border-[var(--line)] bg-white/80 transition",
                        isVisible ? "block" : "hidden",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleArtifactExpansion(artifactType)}
                        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{ARTIFACT_LABELS[artifactType]}</p>
                            {draft.hasValue ? <CompactBadge label="capturado" tone="success" /> : null}
                            {isRequired ? <CompactBadge label="requerido" tone="warning" /> : null}
                            {!draft.hasValue && !isRequired ? <CompactBadge label="manual" tone="neutral" /> : null}
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            {artifactType}
                          </p>
                        </div>
                        <span className="text-sm text-[var(--muted)]">{isExpanded ? "Contraer" : "Expandir"}</span>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-[var(--line)] px-4 py-4">
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                            <label className="block space-y-2">
                              <span className="text-sm font-medium">Value</span>
                              <textarea
                                className="field min-h-32"
                                name={`${artifactType}__value`}
                                value={draft.value}
                                onChange={(event) => updateArtifactDraft(artifactType, "value", event.target.value)}
                                placeholder="Plain text or JSON"
                              />
                            </label>

                            <div className="space-y-4">
                              <label className="block space-y-2">
                                <span className="text-sm font-medium">Notes</span>
                                <textarea
                                  className="field min-h-20"
                                  name={`${artifactType}__notes`}
                                  value={draft.notes}
                                  onChange={(event) => updateArtifactDraft(artifactType, "notes", event.target.value)}
                                />
                              </label>

                              <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                                <label className="block space-y-2">
                                  <span className="text-sm font-medium">Confidence</span>
                                  <input
                                    className="field"
                                    name={`${artifactType}__confidence`}
                                    value={draft.confidence}
                                    onChange={(event) => updateArtifactDraft(artifactType, "confidence", event.target.value)}
                                    placeholder="0.0 - 1.0"
                                  />
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-sm font-medium">Provenance</span>
                                  <textarea
                                    className="field min-h-20"
                                    name={`${artifactType}__provenance`}
                                    value={draft.provenance}
                                    onChange={(event) => updateArtifactDraft(artifactType, "provenance", event.target.value)}
                                    placeholder="Optional JSON provenance"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
                          {draft.hasValue
                            ? "Artifact capturado y listo para revisión."
                            : isRequired
                              ? "Requerido por tasks seleccionadas. Falta completarlo."
                              : "Visible solo para edición puntual."}
                        </div>
                      )}
                    </article>
                  );
                })}

                {ARTIFACT_TYPES.filter((artifactType) => !workspaceArtifactSet.has(artifactType)).map(
                  (artifactType) => {
                    const draft = artifactDrafts[artifactType];

                    return (
                      <div key={`${artifactType}-hidden`} className="hidden">
                        <textarea name={`${artifactType}__value`} value={draft.value} readOnly />
                        <textarea name={`${artifactType}__notes`} value={draft.notes} readOnly />
                        <input name={`${artifactType}__confidence`} value={draft.confidence} readOnly />
                        <textarea name={`${artifactType}__provenance`} value={draft.provenance} readOnly />
                      </div>
                    );
                  },
                )}
              </div>

              <PipelinePager currentStep="artifacts" onStepChange={setActiveStep} />
            </section>

            <section
              id="case-step-panel-projections"
              role="tabpanel"
              aria-labelledby="case-step-tab-projections"
              aria-hidden={activeStep !== "projections"}
              className={cn(
                "surface rounded-[1.25rem] p-5 sm:p-6",
                activeStep !== "projections" && "hidden",
              )}
            >
              <StepPanelHeader
                stepNumber={4}
                title="Task projections"
                description="The pipeline shows only selected tasks and the current preview target. Use the management panel to discover the rest without cluttering this workspace."
                metrics={
                  <>
                    <StatusBadge status={status} />
                    <StatusBadge status={reviewStatus} />
                  </>
                }
                action={
                  <button type="button" className="button-secondary" onClick={() => setTaskPanelOpen(true)}>
                    Administrar tasks
                  </button>
                }
              />

              <div className="mt-5 flex flex-wrap gap-2">
                <CompactBadge label={`${selectedTaskIds.length} en pipeline`} tone="accent" />
                <CompactBadge label={`${selectedReadyTaskCount} listas para preview`} tone="success" />
                <CompactBadge label={`${taskSuggestions.length - selectedTaskIds.length} fuera del foco`} tone="neutral" />
              </div>

              {visibleProjectionTasks.length === 0 ? (
                <div className="mt-5">
                  <EmptyWorkspaceState
                    title="No hay tasks en el pipeline"
                    description="Selecciona solo las tasks que realmente quieras trabajar en este caso. Las compatibles y el catálogo completo están disponibles en el panel de administración."
                    actionLabel="Abrir administrador de tasks"
                    onAction={() => setTaskPanelOpen(true)}
                  />
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {visibleProjectionTasks.map((task) => {
                  const isExpanded = expandedTaskIds.includes(task.id);
                  const isSelected = selectedTaskSet.has(task.id);
                  const isPreviewing = previewTaskSpec?.id === task.id;
                  const derivedExampleCount = derivedExamplesByTaskId[task.id] ?? 0;

                  return (
                    <article key={task.id} className="rounded-[1rem] border border-[var(--line)] bg-white/80">
                      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                        <button
                          type="button"
                          onClick={() => toggleTaskExpansion(task.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{task.name}</p>
                            {isSelected ? <CompactBadge label="seleccionada" tone="accent" /> : null}
                            {isPreviewing ? <CompactBadge label="preview" tone="accent" /> : null}
                            {task.compatible ? (
                              <CompactBadge label="lista" tone="success" />
                            ) : (
                              <CompactBadge
                                label={`faltan ${task.missingArtifacts.length}`}
                                tone="warning"
                              />
                            )}
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            {task.slug} • v{task.version} • {task.taskType}
                          </p>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {task.compatible
                              ? "Ready to preview and derive examples."
                              : `Missing artifacts: ${task.missingArtifacts.join(", ")}`}
                          </p>
                        </button>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {mode === "edit" && caseId ? (
                            <Link href={`/cases/${caseId}?taskSpecId=${task.id}`} className="button-secondary">
                              {task.compatible ? "Preview" : "Revisar faltantes"}
                            </Link>
                          ) : (
                            <span className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
                              Guarda el caso para preview
                            </span>
                          )}
                          <button type="button" className="button-secondary" onClick={() => toggleTaskExpansion(task.id)}>
                            {isExpanded ? "Contraer" : "Expandir"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="border-t border-[var(--line)] px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {task.requiredArtifacts.map((artifactType) => (
                              <CompactBadge
                                key={`${task.id}-${artifactType}`}
                                label={`required: ${artifactType}`}
                                tone={task.missingArtifacts.includes(artifactType) ? "warning" : "success"}
                              />
                            ))}
                            {task.optionalArtifacts.map((artifactType) => (
                              <CompactBadge
                                key={`${task.id}-${artifactType}-optional`}
                                label={`optional: ${artifactType}`}
                                tone="neutral"
                              />
                            ))}
                            <CompactBadge
                              label={`${derivedExampleCount} derived example(s)`}
                              tone="accent"
                            />
                          </div>

                          {task.missingArtifacts.length > 0 ? (
                            <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                              Esta task sigue seleccionada, pero no está lista: faltan {task.missingArtifacts.join(", ")}. Usa el administrador de artifacts para revelar solo lo necesario en el workspace.
                            </div>
                          ) : (
                            <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                              La task está lista para preview y para crear derived examples desde el editor del caso.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <PipelinePager currentStep="projections" onStepChange={setActiveStep} />
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="surface rounded-[1.25rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Current stage
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{activeStepConfig.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{activeStepConfig.description}</p>

              <div className="mt-4 space-y-2">
                {PIPELINE_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[0.9rem] px-3 py-2 text-left transition",
                      activeStep === step.id
                        ? "bg-[rgba(15,95,92,0.08)] text-[var(--foreground)]"
                        : "hover:bg-white/75",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {step.label}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{stepMeta[step.id]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="surface rounded-[1.25rem] p-5">
              <h3 className="text-base font-semibold">Workflow</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Status controls stay visible while the main column remains focused on editing.
              </p>

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

                {previewTaskSpec ? (
                  <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Previewing projection for {previewTaskSpec.name}.
                  </div>
                ) : mode === "edit" ? (
                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)]">
                    Abre una task del pipeline para generar su preview y crear derived examples.
                  </div>
                ) : null}

                {mode === "edit" ? (
                  <div className="rounded-[1rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)]">
                    {derivedExamples.length} derived example(s) connected to this case.
                  </div>
                ) : null}

                <input type="hidden" name="updatedBy" value="human" />

                <FormSubmitButton
                  type="submit"
                  className="button-primary w-full"
                  pendingLabel={mode === "create" ? "Saving case..." : "Updating case..."}
                >
                  {mode === "create" ? "Save V2 case" : "Update V2 case"}
                </FormSubmitButton>
              </div>
            </section>
          </aside>
        </div>
      </form>

      {mode === "edit" && caseId ? (
        <section className="surface rounded-[1.25rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <h2 className="text-lg font-semibold">Projection preview and derived examples</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Preview and creation stay in the main editor. Management panels never become a second editor.
              </p>
            </div>

            <div className="rounded-full border border-[var(--line)] bg-white/75 px-4 py-2 text-sm text-[var(--muted)]">
              {derivedExamples.length} derived example(s)
            </div>
          </div>

          {previewTaskSpec && projectionPreview ? (
            <form action={derivedExampleFormAction} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-[1rem] border border-[var(--line)] bg-white/78 p-4">
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

              <div className="space-y-4 rounded-[1rem] border border-[var(--line)] bg-white/78 p-4">
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
                  <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Missing artifacts: {projectionPreview.missingArtifacts.join(", ")}
                  </div>
                ) : null}

                <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Saving derived example...">
                  Save derived example
                </FormSubmitButton>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-[1rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
              Select a task from the pipeline to generate a preview.
            </div>
          )}

          <div className="mt-8 space-y-4">
            {derivedExamples.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
                This case does not have derived examples yet.
              </div>
            ) : null}

            {derivedExamples.map((derivedExample) => {
              const validationState = parseValidationState(derivedExample.validationStateJson);

              return (
                <article key={derivedExample.id} className="rounded-[1rem] border border-[var(--line)] bg-white/80 p-4">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold">
                          {derivedExample.title || derivedExample.taskSpec.name}
                        </h3>
                        <StatusBadge status={derivedExample.reviewStatus} />
                        <StatusBadge status={derivedExample.generationMode} />
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {derivedExample.taskSpec.slug} • v{derivedExample.taskSpec.version} • Updated {formatDate(derivedExample.updatedAt)}
                      </p>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[0.95rem] border border-[var(--line)] bg-white/70 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            Input payload
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
                            {JSON.stringify(derivedExample.inputPayloadJson, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-[0.95rem] border border-[var(--line)] bg-white/70 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            Output payload
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
                            {JSON.stringify(derivedExample.outputPayloadJson, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {validationState.structuralErrors.length > 0 ? (
                        <div className="mt-4">
                          <ProjectionMessages title="Structural issues" items={validationState.structuralErrors} tone="error" />
                        </div>
                      ) : null}
                      {validationState.semanticWarnings.length > 0 ? (
                        <div className="mt-4">
                          <ProjectionMessages title="Semantic warnings" items={validationState.semanticWarnings} tone="warning" />
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-[0.95rem] border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted)]">
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
            <form action={relationFormAction} className="mt-8 grid gap-4 rounded-[1rem] border border-[var(--line)] bg-white/78 p-5 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
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

"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TaskSpecDeleteButton } from "@/components/task-spec-delete-button";
import {
  TaskSpecForm,
  type TaskSpecCatalogRecord,
} from "@/components/task-spec-form";
import { TASK_TYPES } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export type { TaskSpecCatalogRecord } from "@/components/task-spec-form";

function formatTaskTypeLabel(taskType: string) {
  return taskType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
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

function TaskCatalogDrawer({
  open,
  mode,
  taskSpec,
  taskSchemaPlaceholder,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  taskSpec: TaskSpecCatalogRecord | null;
  taskSchemaPlaceholder: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const isEditing = mode === "edit" && taskSpec;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-[rgba(17,24,39,0.32)] backdrop-blur-[1px]">
      <button type="button" aria-label="Cerrar panel" className="flex-1" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[min(760px,100vw)] flex-col border-l border-[var(--line)] bg-[rgba(248,246,241,0.98)] shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Task Manager
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {isEditing ? `Edit ${taskSpec.name}` : "Create task spec"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {isEditing
                  ? "Adjust schemas, artifacts, and export behavior in a focused editing panel."
                  : "Add a new task spec without losing context from the manager view."}
              </p>
            </div>

            <button type="button" className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DrawerTabs
              value={mode}
              options={[
                { id: "create", label: "Create" },
                { id: "edit", label: "Edit" },
              ]}
              onChange={() => {}}
            />
            {isEditing ? <StatusBadge status={taskSpec.isActive ? "approved" : "archived"} /> : null}
            {isEditing ? <StatusBadge status={taskSpec.taskType} /> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <TaskSpecForm
            mode={mode}
            taskSchemaPlaceholder={taskSchemaPlaceholder}
            taskSpec={taskSpec}
            onCancel={onClose}
            onSuccess={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export function TaskCatalogManager({
  taskSpecs,
  taskSchemaPlaceholder,
}: {
  taskSpecs: TaskSpecCatalogRecord[];
  taskSchemaPlaceholder: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | (typeof TASK_TYPES)[number]>("all");
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    taskSpecId: string | null;
  }>({ open: false, mode: "create", taskSpecId: null });
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredTaskSpecs = taskSpecs.filter((taskSpec) => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      taskSpec.name.toLowerCase().includes(query) ||
      taskSpec.slug.toLowerCase().includes(query) ||
      taskSpec.description.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? taskSpec.isActive : !taskSpec.isActive);
    const matchesType = typeFilter === "all" || taskSpec.taskType === typeFilter;

    return matchesQuery && matchesStatus && matchesType;
  });

  const selectedTaskSpec =
    drawerState.mode === "edit"
      ? taskSpecs.find((taskSpec) => taskSpec.id === drawerState.taskSpecId) ?? null
      : null;
  const activeCount = taskSpecs.filter((taskSpec) => taskSpec.isActive).length;
  const inactiveCount = taskSpecs.length - activeCount;
  const derivedExampleCount = taskSpecs.reduce(
    (total, taskSpec) => total + taskSpec.derivedExampleCount,
    0,
  );

  return (
    <div className="space-y-8">
      <section className="surface relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_right,rgba(15,95,92,0.18),transparent_48%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Task Catalog</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[2.8rem]">
              Manage task specs like an operational catalog, not a stacked wall of forms.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
              Organize reusable task specs, inspect status at a glance, and move creation or editing into a focused side panel that returns you directly to the manager view.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="button-primary"
              onClick={() => setDrawerState({ open: true, mode: "create", taskSpecId: null })}
            >
              New task spec
            </button>
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CompactMetric label="Catalog size" value={taskSpecs.length} />
          <CompactMetric label="Active" value={activeCount} />
          <CompactMetric label="Inactive" value={inactiveCount} />
          <CompactMetric label="Derived examples" value={derivedExampleCount} />
        </div>
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Browse and administrate
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Filter by activation state and task type, then open a focused panel to create or edit without losing the catalog context.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Search</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="field"
                placeholder="Search by name, slug, or description"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | "active" | "inactive")
                }
                className="field"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Task type</span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "all" | (typeof TASK_TYPES)[number])
                }
                className="field"
              >
                <option value="all">All types</option>
                {TASK_TYPES.map((taskType) => (
                  <option key={taskType} value={taskType}>
                    {formatTaskTypeLabel(taskType)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Catalog list
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Showing {filteredTaskSpecs.length} of {taskSpecs.length} task specs.
            </p>
          </div>

          {(searchQuery || statusFilter !== "all" || typeFilter !== "all") && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredTaskSpecs.length === 0 ? (
          <div className="surface rounded-[1.75rem] px-6 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              No task specs match this view.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Adjust the search or filters, or create a new task spec from the manager action.
            </p>
            <button
              type="button"
              className="button-primary mt-6"
              onClick={() => setDrawerState({ open: true, mode: "create", taskSpecId: null })}
            >
              Create task spec
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTaskSpecs.map((taskSpec) => (
              <article key={taskSpec.id} className="surface rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={taskSpec.isActive ? "approved" : "archived"} />
                      <StatusBadge status={taskSpec.taskType} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                          {taskSpec.name}
                        </h2>
                        <p className="mt-2 mono text-sm text-[var(--muted)]">{taskSpec.slug}</p>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                          {taskSpec.description || "No description provided yet."}
                        </p>
                      </div>

                      <div className="grid min-w-[240px] gap-3 sm:grid-cols-2 xl:w-[320px]">
                        <CompactMetric label="Version" value={taskSpec.version} />
                        <CompactMetric label="Examples" value={taskSpec.derivedExampleCount} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {taskSpec.requiredArtifactsText ? (
                        taskSpec.requiredArtifactsText.split(",").map((artifact) => (
                          <span
                            key={`${taskSpec.id}-${artifact}`}
                            className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/80"
                          >
                            {artifact.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          No required artifacts
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="xl:w-[280px] xl:pl-4">
                    <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Last update
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        {formatDate(taskSpec.updatedAt)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Type: {formatTaskTypeLabel(taskSpec.taskType)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Created: {formatDate(taskSpec.createdAt)}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() =>
                            setDrawerState({
                              open: true,
                              mode: "edit",
                              taskSpecId: taskSpec.id,
                            })
                          }
                        >
                          Edit
                        </button>
                        <TaskSpecDeleteButton taskSpecId={taskSpec.id} taskSpecName={taskSpec.name} />
                      </div>

                      {taskSpec.derivedExampleCount > 0 ? (
                        <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                          Delete is blocked when the spec already powers derived examples.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <TaskCatalogDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        taskSpec={selectedTaskSpec}
        taskSchemaPlaceholder={taskSchemaPlaceholder}
        onClose={() => setDrawerState((currentState) => ({ ...currentState, open: false }))}
      />
    </div>
  );
}
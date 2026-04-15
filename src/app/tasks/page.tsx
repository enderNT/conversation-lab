import { createTaskSpec, updateTaskSpec } from "@/app/actions";
import { stringifyJsonValue } from "@/lib/cases";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { prisma } from "@/lib/prisma";
import { ARTIFACT_TYPES, TASK_TYPES } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

const TASK_SCHEMA_PLACEHOLDER = JSON.stringify(
  [
    {
      key: "last_user_message",
      type: "string",
      required: true,
      description: "The latest user message.",
    },
  ],
  null,
  2,
);

export default async function TaskCatalogPage() {
  await ensureDefaultTaskSpecs();

  const taskSpecs = await prisma.taskSpec.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Task Catalog
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Define reusable task specs that project source cases into task-specific dataset rows.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Task specs declare input and output schemas, required artifacts, validation rules, export shape, activation state, and version.
          </p>
        </div>

        <form action={createTaskSpec} className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Create task spec</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Name</span>
              <input name="name" className="field" placeholder="Escalation routing" required />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Slug</span>
                <input name="slug" className="field" placeholder="escalation_routing" required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Task type</span>
                <select name="taskType" className="field" defaultValue={TASK_TYPES[0]}>
                  {TASK_TYPES.map((taskType) => (
                    <option key={taskType} value={taskType}>
                      {taskType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Description</span>
              <textarea name="description" className="field min-h-24" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Input schema JSON</span>
              <textarea name="inputSchemaJson" className="field min-h-40 font-mono text-sm" defaultValue={TASK_SCHEMA_PLACEHOLDER} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Output schema JSON</span>
              <textarea name="outputSchemaJson" className="field min-h-32 font-mono text-sm" defaultValue={TASK_SCHEMA_PLACEHOLDER} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Required artifacts</span>
              <input name="requiredArtifacts" className="field" placeholder={ARTIFACT_TYPES.join(", ")} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Optional artifacts</span>
              <input name="optionalArtifacts" className="field" placeholder="policy_flags, state_assumptions" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Validation rules JSON</span>
              <textarea name="validationRulesJson" className="field min-h-28 font-mono text-sm" defaultValue="{}" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Export shape JSON</span>
              <textarea name="exportShapeJson" className="field min-h-24 font-mono text-sm" defaultValue='{"format":"conversation_lab_v2","shape":"{ input, output, metadata }"}' />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Version</span>
              <input name="version" className="field" defaultValue="1" />
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="isActive" defaultChecked />
              Active
            </label>
            <input type="hidden" name="updatedBy" value="human" />
            <button type="submit" className="button-primary w-full">
              Create task spec
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {taskSpecs.map((taskSpec) => (
          <form key={taskSpec.id} action={updateTaskSpec.bind(null, taskSpec.id)} className="surface rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">{taskSpec.name}</h2>
                <StatusBadge status={taskSpec.isActive ? "approved" : "archived"} />
              </div>
              <p className="text-sm text-[var(--muted)]">
                {taskSpec.slug} • v{taskSpec.version} • {taskSpec.taskType}
              </p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Name</span>
                <input name="name" className="field" defaultValue={taskSpec.name} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Slug</span>
                <input name="slug" className="field" defaultValue={taskSpec.slug} />
              </label>
              <label className="block space-y-2 xl:col-span-2">
                <span className="text-sm font-medium">Description</span>
                <textarea name="description" className="field min-h-24" defaultValue={taskSpec.description} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Task type</span>
                <select name="taskType" className="field" defaultValue={taskSpec.taskType}>
                  {TASK_TYPES.map((taskType) => (
                    <option key={taskType} value={taskType}>
                      {taskType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Version</span>
                <input name="version" className="field" defaultValue={taskSpec.version} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Required artifacts</span>
                <input name="requiredArtifacts" className="field" defaultValue={Array.isArray(taskSpec.requiredArtifactsJson) ? taskSpec.requiredArtifactsJson.join(", ") : ""} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Optional artifacts</span>
                <input name="optionalArtifacts" className="field" defaultValue={Array.isArray(taskSpec.optionalArtifactsJson) ? taskSpec.optionalArtifactsJson.join(", ") : ""} />
              </label>
              <label className="block space-y-2 xl:col-span-2">
                <span className="text-sm font-medium">Input schema JSON</span>
                <textarea name="inputSchemaJson" className="field min-h-40 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.inputSchemaJson)} />
              </label>
              <label className="block space-y-2 xl:col-span-2">
                <span className="text-sm font-medium">Output schema JSON</span>
                <textarea name="outputSchemaJson" className="field min-h-32 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.outputSchemaJson)} />
              </label>
              <label className="block space-y-2 xl:col-span-2">
                <span className="text-sm font-medium">Validation rules JSON</span>
                <textarea name="validationRulesJson" className="field min-h-24 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.validationRulesJson)} />
              </label>
              <label className="block space-y-2 xl:col-span-2">
                <span className="text-sm font-medium">Export shape JSON</span>
                <textarea name="exportShapeJson" className="field min-h-24 font-mono text-sm" defaultValue={stringifyJsonValue(taskSpec.exportShapeJson)} />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="isActive" defaultChecked={taskSpec.isActive} />
                Active
              </label>
              <input type="hidden" name="updatedBy" value="human" />
              <button type="submit" className="button-secondary">
                Save task spec
              </button>
            </div>
          </form>
        ))}
      </section>
    </div>
  );
}
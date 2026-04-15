import { TaskSpecCreateForm } from "@/components/task-spec-create-form";
import { TaskSpecEditForm } from "@/components/task-spec-edit-form";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { prisma } from "@/lib/prisma";

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

        <TaskSpecCreateForm taskSchemaPlaceholder={TASK_SCHEMA_PLACEHOLDER} />
      </section>

      <section className="space-y-4">
        {taskSpecs.map((taskSpec) => (
          <TaskSpecEditForm key={taskSpec.id} taskSpec={taskSpec} />
        ))}
      </section>
    </div>
  );
}
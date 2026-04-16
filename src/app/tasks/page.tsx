import { stringifyJsonValue } from "@/lib/cases";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";
import { prisma } from "@/lib/prisma";
import { TaskCatalogManager, type TaskSpecCatalogRecord } from "@/components/task-catalog-manager";

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
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      taskType: true,
      inputSchemaJson: true,
      outputSchemaJson: true,
      requiredArtifactsJson: true,
      optionalArtifactsJson: true,
      validationRulesJson: true,
      exportShapeJson: true,
      isActive: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          derivedExamples: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const taskCatalog = taskSpecs.map<TaskSpecCatalogRecord>((taskSpec) => ({
    id: taskSpec.id,
    name: taskSpec.name,
    slug: taskSpec.slug,
    description: taskSpec.description,
    taskType: taskSpec.taskType,
    inputSchemaText: stringifyJsonValue(taskSpec.inputSchemaJson),
    outputSchemaText: stringifyJsonValue(taskSpec.outputSchemaJson),
    requiredArtifactsText: Array.isArray(taskSpec.requiredArtifactsJson)
      ? taskSpec.requiredArtifactsJson.join(", ")
      : "",
    optionalArtifactsText: Array.isArray(taskSpec.optionalArtifactsJson)
      ? taskSpec.optionalArtifactsJson.join(", ")
      : "",
    validationRulesText: stringifyJsonValue(taskSpec.validationRulesJson),
    exportShapeText: stringifyJsonValue(taskSpec.exportShapeJson),
    isActive: taskSpec.isActive,
    version: taskSpec.version,
    createdAt: taskSpec.createdAt.toISOString(),
    updatedAt: taskSpec.updatedAt.toISOString(),
    derivedExampleCount: taskSpec._count.derivedExamples,
  }));

  return (
    <TaskCatalogManager
      taskSchemaPlaceholder={TASK_SCHEMA_PLACEHOLDER}
      taskSpecs={taskCatalog}
    />
  );
}
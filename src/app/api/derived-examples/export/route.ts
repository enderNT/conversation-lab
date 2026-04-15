import { DerivedExampleStatus } from "@prisma/client";
import { toExportDerivedExample } from "@/lib/cases";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTaskSpecs } from "@/lib/task-specs";

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  await ensureDefaultTaskSpecs();

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const taskSpecId = url.searchParams.get("taskSpecId") || undefined;
  const requestedStatus = url.searchParams.get("reviewStatus");
  const approvedOnly = url.searchParams.get("approvedOnly") === "true";
  const format = url.searchParams.get("format") === "jsonl" ? "jsonl" : "json";
  const version = url.searchParams.get("version");
  const fromDate = parseDate(url.searchParams.get("from"));
  const toDate = parseDate(url.searchParams.get("to"));
  const reviewStatus = approvedOnly
    ? DerivedExampleStatus.approved
    : requestedStatus && Object.values(DerivedExampleStatus).includes(requestedStatus as DerivedExampleStatus)
      ? (requestedStatus as DerivedExampleStatus)
      : undefined;

  const derivedExamples = await prisma.derivedExample.findMany({
    where: {
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(taskSpecId ? { taskSpecId } : {}),
      ...(version ? { version: Number.parseInt(version, 10) } : {}),
      ...(fromDate || toDate
        ? {
            updatedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(projectId
        ? {
            case: {
              projectId,
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      taskSpec: {
        select: {
          id: true,
          slug: true,
          name: true,
          version: true,
          taskType: true,
          exportShapeJson: true,
        },
      },
      case: {
        select: {
          projectId: true,
          sessionId: true,
        },
      },
    },
  });

  const payload = derivedExamples.map((derivedExample) => {
    const exported = toExportDerivedExample(derivedExample);
    const provenanceRecord =
      exported.provenance &&
      typeof exported.provenance === "object" &&
      !Array.isArray(exported.provenance)
        ? exported.provenance
        : { raw_provenance: exported.provenance };

    return {
      input: exported.input,
      output: exported.output,
      metadata: {
        ...provenanceRecord,
        case_id: exported.case_id,
        project_id: derivedExample.case.projectId,
        session_id: derivedExample.case.sessionId,
        review_status: exported.review_status,
        generation_mode: exported.generation_mode,
        validation_state: exported.validation_state,
        task_spec: exported.task_spec,
        export_shape: derivedExample.taskSpec.exportShapeJson,
        exported_at: exported.exported_at,
      },
    };
  });

  const filenameParts = [
    "conversation-lab-v2",
    projectId || "all-projects",
    taskSpecId || "all-tasks",
    reviewStatus || "all-statuses",
  ];
  const filename = `${filenameParts.join("-")}.${format}`;

  if (format === "jsonl") {
    const jsonl = payload.map((item) => JSON.stringify(item)).join("\n");

    return new Response(jsonl, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  }

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
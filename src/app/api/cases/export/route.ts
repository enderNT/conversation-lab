import { CaseStatus } from "@prisma/client";
import { toExportCase } from "@/lib/cases";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const requestedStatus = url.searchParams.get("status");
  const status =
    requestedStatus && Object.values(CaseStatus).includes(requestedStatus as CaseStatus)
      ? (requestedStatus as CaseStatus)
      : CaseStatus.approved;

  const cases = await prisma.case.findMany({
    where: {
      status,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const payload = cases.map(toExportCase);
  const filename = projectId
    ? `conversation-lab-${projectId}-${status}-cases.json`
    : `conversation-lab-${status}-cases.json`;

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
import { toExportCase } from "@/lib/cases";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const cases = await prisma.case.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      artifacts: true,
      derivedExamples: {
        select: { id: true },
      },
    },
  });

  const payload = cases.map(toExportCase);
  const filename = projectId
    ? `conversation-lab-v2-${projectId}-${status || "all"}-cases.json`
    : `conversation-lab-v2-${status || "all"}-cases.json`;

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
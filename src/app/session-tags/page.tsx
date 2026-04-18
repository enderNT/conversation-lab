import { SessionTagManager } from "@/components/session-tag-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SessionTagsPage() {
  const tags = await prisma.sessionTag.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });

  return (
    <SessionTagManager
      tags={tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        sessionCount: tag._count.sessions,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      }))}
    />
  );
}
